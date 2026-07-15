#!/usr/bin/env python3
"""============================================================
matching_images.py — image pipeline for the Matching exercise

Turns any source image (ChatGPT render, OpenMoji icon, photo…)
into a lightweight, transparent, square 256px WebP and uploads it
to Supabase Storage at  audio/matching/<name>.webp

── Requirements ────────────────────────────────────────────
  pip install Pillow requests
  pip install rembg onnxruntime        # only for --strip-bg
  Env vars (via .env.local + run script):
    SUPABASE_SERVICE_ROLE_KEY   — required for --upload
    SUPABASE_URL                — optional, defaults to project URL

── Usage ───────────────────────────────────────────────────
  # 1. Process a folder of new images (already transparent):
  python3 scripts/matching-images/matching_images.py --input ~/Desktop/new-imgs

  # 2. Process AI images generated on a white/plain background:
  python3 scripts/matching-images/matching_images.py --input ~/Desktop/new-imgs --strip-bg

  # 3. Same, and upload straight to storage:
  python3 scripts/matching-images/matching_images.py --input ~/Desktop/new-imgs --strip-bg --upload

  # 4. One-off: shrink the 15 existing heavy PNGs already in storage
  #    (downloads them, converts to .webp, uploads alongside — originals untouched):
  python3 scripts/matching-images/matching_images.py --normalise-existing --upload

  Output always lands in scripts/matching-images/out/ so you can
  eyeball everything before (or after) upload. Add --dry to any
  upload command to print what WOULD upload without sending it.
============================================================"""

import argparse, os, sys, io, urllib.parse

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow missing — run: pip install Pillow")

PROJECT_URL = os.environ.get("SUPABASE_URL", "https://dyxmgicedabvmsbuvxny.supabase.co")
BUCKET      = "audio"
PREFIX      = "matching"
OUT_DIR     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
SIZE        = 256
MARGIN      = 1.08   # 8% breathing room around the trimmed object
EXTS        = (".png", ".jpg", ".jpeg", ".webp")


def strip_background(img):
    """Remove background with rembg (U2-Net). Lazy import so the
    dependency is only needed when --strip-bg is used."""
    try:
        from rembg import remove
    except ImportError:
        sys.exit("--strip-bg needs rembg — run: pip install rembg onnxruntime")
    return remove(img)


def process(img, size=SIZE):
    """Trim transparent border, pad square with margin, resize, return RGBA."""
    img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    side = max(1, int(max(img.size) * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas.resize((size, size), Image.LANCZOS)


def save_webp(img, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{name}.webp")
    img.save(out_path, "WEBP", quality=85, method=6)
    return out_path


def auth_headers():
    """Correct auth headers for either key generation.
    New sb_secret_... keys go in the apikey header ONLY — putting them in
    Authorization: Bearer makes Supabase parse them as a JWT and fail with
    'Invalid Compact JWS'. Legacy JWT keys use both headers."""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY not set — add it to .env.local\n"
                 "(Supabase dashboard → Project Settings → API Keys → secret key)")
    if key.startswith("sb_"):
        return {"apikey": key}
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def upload(path, dest_name, dry=False):
    import requests
    object_path = f"{PREFIX}/{dest_name}"
    url = f"{PROJECT_URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(object_path)}"
    if dry:
        print(f"  [dry] would upload → {BUCKET}/{object_path}")
        return
    with open(path, "rb") as f:
        r = requests.post(url, data=f.read(), headers={
            **auth_headers(),
            "Content-Type": "image/webp",
            "x-upsert": "true",
        })
    if r.status_code not in (200, 201):
        sys.exit(f"Upload failed for {dest_name}: {r.status_code} {r.text}")
    print(f"  ✓ uploaded → {BUCKET}/{object_path}")


def public_url(dest_name):
    return f"{PROJECT_URL}/storage/v1/object/public/{BUCKET}/{PREFIX}/{urllib.parse.quote(dest_name)}"


def run_input_folder(args):
    files = [f for f in sorted(os.listdir(args.input)) if f.lower().endswith(EXTS)]
    if not files:
        sys.exit(f"No images found in {args.input}")
    print(f"Processing {len(files)} image(s) from {args.input}\n")
    for f in files:
        name = os.path.splitext(f)[0].strip().lower()
        img = Image.open(os.path.join(args.input, f))
        if args.strip_bg:
            img = strip_background(img)
        out = save_webp(process(img, args.size), name)
        kb = os.path.getsize(out) / 1024
        print(f"  {f}  →  out/{name}.webp  ({kb:.0f} KB)")
        if args.upload:
            upload(out, f"{name}.webp", dry=args.dry)
    print("\nPublic URL pattern for the question bank:")
    print(f"  {PROJECT_URL}/storage/v1/object/public/{BUCKET}/{PREFIX}/<name>.webp")


def run_normalise_existing(args):
    """Fetch every existing matching/*.png from the PUBLIC bucket,
    convert to webp, upload alongside. Originals are not deleted."""
    import requests
    list_url = f"{PROJECT_URL}/storage/v1/object/list/{BUCKET}"
    r = requests.post(list_url,
                      json={"prefix": PREFIX, "limit": 200},
                      headers=auth_headers())
    if r.status_code != 200:
        sys.exit(f"Could not list {BUCKET}/{PREFIX}: {r.status_code} {r.text}")
    pngs = [o["name"] for o in r.json() if o["name"].lower().endswith(".png")]
    print(f"Found {len(pngs)} PNG(s) in {BUCKET}/{PREFIX}\n")
    for name in pngs:
        src = f"{PROJECT_URL}/storage/v1/object/public/{BUCKET}/{PREFIX}/{urllib.parse.quote(name)}"
        data = requests.get(src).content
        base = os.path.splitext(name)[0].strip().lower()
        img = Image.open(io.BytesIO(data))
        out = save_webp(process(img, args.size), base)
        old_kb = len(data) / 1024
        new_kb = os.path.getsize(out) / 1024
        print(f"  {name}: {old_kb:.0f} KB → {new_kb:.0f} KB ({100 - new_kb/old_kb*100:.0f}% smaller)")
        if args.upload:
            upload(out, f"{base}.webp", dry=args.dry)
    print("\nOriginal .png files were left in place. Once the question_bank")
    print("URLs are switched to .webp and verified in-app, the .png files")
    print("can be deleted from the dashboard (or ask Claude to list them).")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Matching exercise image pipeline")
    p.add_argument("--input", help="folder of source images to process")
    p.add_argument("--strip-bg", action="store_true", help="remove background with rembg first")
    p.add_argument("--upload", action="store_true", help="upload processed files to storage")
    p.add_argument("--dry", action="store_true", help="with --upload: print instead of sending")
    p.add_argument("--size", type=int, default=SIZE, help=f"output px (default {SIZE})")
    p.add_argument("--normalise-existing", action="store_true",
                   help="shrink the existing matching/*.png files in storage")
    args = p.parse_args()

    if args.normalise_existing:
        run_normalise_existing(args)
    elif args.input:
        run_input_folder(args)
    else:
        p.print_help()
