#!/usr/bin/env python3
"""============================================================
fetch_openmoji.py — pulls the approved OpenMoji icons for the
Matching image sets, processes them through the standard pipeline
(matching_images.py) and optionally uploads to storage.

  python3 scripts/matching-images/fetch_openmoji.py            # fetch + process to out/
  python3 scripts/matching-images/fetch_openmoji.py --upload   # …and upload
  python3 scripts/matching-images/fetch_openmoji.py --upload --dry

OpenMoji (https://openmoji.org) — CC BY-SA 4.0.
Attribution line for the app: "Icons by OpenMoji (CC BY-SA 4.0)".
============================================================"""

import argparse, io, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matching_images import process, save_webp, upload  # noqa: E402
from PIL import Image  # noqa: E402

BASE = "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618"

# word → OpenMoji hexcode. Filenames keep spaces, matching existing
# storage convention ("plug socket.png").
WORDS = {
    # Travel — getting there (A1)
    "aeroplane": "2708",  "train": "1F686",     "taxi": "1F695",
    "ticket": "1F3AB",    "map": "1F5FA",       "camera": "1F4F7",
    "sunglasses": "1F576","beach": "1F3D6",     "mountain": "26F0",
    # In the hotel room (A1–A2)
    "bed": "1F6CF",       "door": "1F6AA",      "shower": "1F6BF",
    "mirror": "1FA9E",    "toothbrush": "1FAA5","soap": "1F9FC",
    "television": "1F4FA","light bulb": "1F4A1","telephone": "260E",
    # At the restaurant (A1)
    "cup": "2615",        "wine glass": "1F377","bottle": "1F37E",
    "spoon": "1F944",     "ice": "1F9CA",       "cake": "1F370",
    "teapot": "1FAD6",    "salt": "1F9C2",      "egg": "1F95A",
}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--upload", action="store_true")
    p.add_argument("--dry", action="store_true")
    args = p.parse_args()

    print(f"Fetching {len(WORDS)} OpenMoji icons…\n")
    for word, code in WORDS.items():
        url = f"{BASE}/{code}.png"
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
        except Exception as e:
            sys.exit(f"Failed to fetch {word} ({code}): {e}")
        img = Image.open(io.BytesIO(data))
        out = save_webp(process(img), word)
        print(f"  {word}  →  out/{word}.webp  ({os.path.getsize(out)/1024:.0f} KB)")
        if args.upload:
            upload(out, f"{word}.webp", dry=args.dry)
    print("\nDone. Files are in scripts/matching-images/out/ for a visual check.")
