"""
Wordsearch puzzle generator for Perfect English Portal.

Pipeline per puzzle:
  1. Pick a theme (round-robin from the bank for variety across days)
  2. Sample 10 words from that theme's pool
  3. Pick a key word for the post-game sentence challenge
  4. Pick a grid size variant
  5. Place words with backtracking, allowing letter overlaps
  6. Fill empty cells with random letters
  7. Scan grid against word_lists for bonus words (≥4 letters)
  8. Identify shadow words (paths fully inside a theme word's path)
  9. Reject + regenerate if estimated_bonus_words < MIN_BONUS_TARGET

Run mode:
  python3 generate_wordsearch.py             # dry run, prints to console
  python3 generate_wordsearch.py --commit    # actually writes to DB
  python3 generate_wordsearch.py --days 14   # generate N days starting tomorrow

Requires:
  - $SUPABASE_DB env var (the pooler connection string)
  - psycopg2 installed
"""

import os
import sys
import random
import argparse
from datetime import date, timedelta
from itertools import product

import psycopg2
from psycopg2.extras import Json


# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

DIRECTIONS = [
    (-1,  0), (-1,  1), (0,  1), (1,  1),
    ( 1,  0), ( 1, -1), (0, -1), (-1, -1),
]

# Grid size variants — adds visual variety day-to-day without complicating
# placement. All rectangular; non-rectangular shapes are a v2 concern.
GRID_VARIANTS = [(12, 12), (11, 13), (13, 11), (10, 14), (14, 10)]

MIN_BONUS_TARGET = 5    # regenerate if fewer than this — keeps hint mechanic alive
MAX_REGEN_ATTEMPTS = 8  # if we still can't hit it, ship anyway

ALPHABET_EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
ALPHABET_ES = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"


# -----------------------------------------------------------------------------
# Theme banks — extend over time. ~15-20 candidates per theme so the daily
# 10-word sample stays varied across appearances.
# -----------------------------------------------------------------------------

THEMES_EN = {
    "In the Kitchen": [
        "FRIDGE", "OVEN", "KETTLE", "TOASTER", "BLENDER", "MICROWAVE",
        "SPOON", "FORK", "KNIFE", "PLATE", "BOWL", "MUG",
        "WHISK", "GRATER", "PEELER", "SINK", "TAP", "DRAWER",
    ],
    "Weather": [
        "SUNNY", "CLOUDY", "RAINY", "WINDY", "STORMY", "FOGGY",
        "SNOWY", "ICY", "WARM", "COOL", "FREEZING",
        "HUMID", "BREEZY", "MILD", "DRIZZLE", "THUNDER", "LIGHTNING",
    ],
    "Body Parts": [
        "HEAD", "NECK", "SHOULDER", "ELBOW", "WRIST", "HAND",
        "FINGER", "THUMB", "CHEST", "WAIST", "KNEE",
        "ANKLE", "FOOT", "MOUTH", "CHIN", "FOREHEAD", "STOMACH",
    ],
    "Clothes": [
        "SHIRT", "TROUSERS", "JEANS", "JACKET", "COAT", "JUMPER",
        "DRESS", "SKIRT", "SHOES", "BOOTS", "SOCKS", "SCARF",
        "GLOVES", "BELT", "TIE", "HAT", "COLLAR", "POCKET",
    ],
    "Animals": [
        "DOG", "HORSE", "RABBIT", "MOUSE", "ELEPHANT", "TIGER",
        "MONKEY", "PARROT", "DOLPHIN", "WHALE", "SHARK", "SNAKE",
        "EAGLE", "PENGUIN", "GIRAFFE", "ZEBRA", "PANDA", "KANGAROO",
    ],
    "Food": [
        "BREAD", "CHEESE", "BUTTER", "PASTA", "RICE", "SOUP",
        "SALAD", "PIZZA", "CHICKEN", "STEAK", "FISH",
        "APPLE", "BANANA", "ORANGE", "GRAPE", "TOMATO", "POTATO",
    ],
    "Verbs of Movement": [
        "WALK", "RUN", "JUMP", "CLIMB", "SWIM", "DANCE",
        "CRAWL", "SKIP", "HOP", "STROLL", "SPRINT", "TIPTOE",
        "WANDER", "MARCH", "STRIDE", "GALLOP", "STAGGER",
    ],
    "Office": [
        "DESK", "CHAIR", "LAPTOP", "MONITOR", "KEYBOARD", "PRINTER",
        "FOLDER", "REPORT", "MEETING", "DEADLINE", "PROJECT",
        "EMAIL", "PHONE", "CALENDAR", "BUDGET", "CLIENT",
    ],
    "Travel": [
        "AIRPORT", "TICKET", "PASSPORT", "LUGGAGE", "HOTEL",
        "BEACH", "MOUNTAIN", "MUSEUM", "TOURIST", "HOLIDAY",
        "FLIGHT", "TRAIN", "STATION", "JOURNEY", "SUITCASE",
    ],
    "Sports": [
        "FOOTBALL", "TENNIS", "RUGBY", "CRICKET", "BOXING",
        "RUNNING", "CYCLING", "SWIMMING", "GOLF", "HOCKEY",
        "SKIING", "SURFING", "CLIMBING", "BASKETBALL", "VOLLEYBALL",
    ],
    "Feelings": [
        "HAPPY", "SAD", "ANGRY", "TIRED", "EXCITED", "BORED",
        "NERVOUS", "CALM", "PROUD", "SHY", "GRUMPY", "JEALOUS",
        "RELAXED", "WORRIED", "CONFIDENT", "GRATEFUL", "ASHAMED",
    ],
    "House": [
        "BEDROOM", "KITCHEN", "BATHROOM", "GARDEN", "ATTIC",
        "BASEMENT", "GARAGE", "BALCONY", "STAIRS", "WINDOW",
        "DOOR", "ROOF", "FLOOR", "WALL", "CHIMNEY", "CORRIDOR",
    ],
    "Hotel": [
        "RECEPTION", "LOBBY", "KEY", "GUEST", "PORTER", "LIFT",
        "CONCIERGE", "BELLBOY", "SUITE", "BREAKFAST", "CHECKOUT",
        "BOOKING", "PILLOW", "MINIBAR", "BALCONY", "TOWEL", "VIEW",
    ],
    "Restaurant": [
        "WAITER", "MENU", "STARTER", "DESSERT", "BILL", "TABLE",
        "ORDER", "CHEF", "NAPKIN", "COURSE", "DRINK", "SPECIAL",
        "CUSTOMER", "WINE", "TIP", "BOOKING", "RESERVE",
    ],
    "The City": [
        "PARK", "MUSEUM", "SQUARE", "BRIDGE", "MARKET", "LIBRARY",
        "AVENUE", "CHURCH", "TOWER", "CINEMA", "THEATRE", "GALLERY",
        "FOUNTAIN", "CATHEDRAL", "STREET", "METRO", "MONUMENT",
    ],
    "Hobbies": [
        "READING", "COOKING", "PAINTING", "KNITTING", "FISHING",
        "GARDENING", "DANCING", "CHESS", "YOGA", "BAKING", "POTTERY",
        "HIKING", "SEWING", "DRAWING", "BIRDING", "COLLECTING", "PUZZLES",
    ],
    "Health": [
        "DOCTOR", "NURSE", "PILL", "FEVER", "COUGH", "BANDAGE",
        "COLD", "HEALTHY", "EXERCISE", "VITAMIN", "CHEMIST", "MEDICINE",
        "SYMPTOM", "PATIENT", "CLINIC", "SURGEON", "REMEDY",
    ],
    "Money": [
        "BANK", "COIN", "NOTE", "CARD", "WALLET", "PURSE", "CASH",
        "CHEQUE", "ACCOUNT", "INTEREST", "LOAN", "BUDGET", "INVOICE",
        "RECEIPT", "SAVINGS", "PAYMENT", "REFUND",
    ],
    "School": [
        "TEACHER", "STUDENT", "PEN", "RULER", "BLACKBOARD", "EXAM",
        "LESSON", "HOMEWORK", "BREAK", "CHALK", "NOTEBOOK", "TIMETABLE",
        "UNIFORM", "PUPIL", "PLAYGROUND", "TEXTBOOK", "PENCIL",
    ],
    "Music": [
        "GUITAR", "PIANO", "VIOLIN", "DRUMS", "SINGER", "BAND", "ALBUM",
        "CONCERT", "MELODY", "RHYTHM", "SONG", "LYRICS", "CHOIR", "FLUTE",
        "TRUMPET", "ORCHESTRA", "SYMPHONY",
    ],
    "Nature": [
        "TREE", "RIVER", "MOUNTAIN", "FOREST", "LAKE", "FIELD", "FLOWER",
        "GRASS", "ROCK", "OCEAN", "VALLEY", "HILL", "MEADOW", "STREAM",
        "CAVE", "DESERT", "ISLAND",
    ],
    "Time": [
        "MONDAY", "TUESDAY", "JANUARY", "SPRING", "SUMMER", "WINTER",
        "MORNING", "EVENING", "MIDNIGHT", "NOON", "HOUR", "MINUTE",
        "SECOND", "WEEK", "YEAR", "MONTH", "AUTUMN",
    ],
    "Technology": [
        "COMPUTER", "PHONE", "INTERNET", "SCREEN", "KEYBOARD", "MOUSE",
        "LAPTOP", "TABLET", "BROWSER", "BATTERY", "ROUTER", "BLUETOOTH",
        "CABLE", "DEVICE", "DOWNLOAD", "PASSWORD", "WIFI",
    ],
    "Jobs": [
        "BAKER", "BUTCHER", "DENTIST", "ENGINEER", "FARMER", "LAWYER",
        "PILOT", "PLUMBER", "SOLDIER", "MECHANIC", "ARCHITECT",
        "JOURNALIST", "ELECTRICIAN", "SCIENTIST", "ARTIST", "WRITER",
        "POLICE",
    ],
    "Personality": [
        "KIND", "SHY", "BRAVE", "FUNNY", "HONEST", "LAZY", "RUDE",
        "POLITE", "CLEVER", "PATIENT", "FRIENDLY", "GENEROUS", "CAREFUL",
        "MEAN", "CONFIDENT", "CHEERFUL", "MODEST",
    ],
    "Family": [
        "PARENT", "MOTHER", "FATHER", "BROTHER", "SISTER", "COUSIN",
        "NEPHEW", "NIECE", "UNCLE", "AUNT", "HUSBAND", "WIFE",
        "CHILD", "FAMILY", "TWIN", "GRANDMA", "GRANDPA",
    ],
    "Beach": [
        "SAND", "WAVE", "SHELL", "TOWEL", "PARASOL", "BIKINI",
        "SUNSCREEN", "SHORE", "SURFBOARD", "SUNGLASSES", "SWIMSUIT",
        "PEBBLE", "COCONUT", "SEAGULL", "LIFEGUARD", "BUCKET", "FLIPPER",
    ],
    "Shopping": [
        "TROLLEY", "BASKET", "BARGAIN", "DISCOUNT", "AISLE", "CASHIER",
        "BRAND", "SALE", "COUPON", "BOUTIQUE", "SHOPPER", "PURCHASE",
        "QUEUE", "CART", "RACK", "TILL", "SCANNER", "OUTLET",
    ],
    "Transport": [
        "TRAIN", "BIKE", "MOTORBIKE", "SCOOTER", "LORRY", "TAXI",
        "TRAM", "FERRY", "BOAT", "AEROPLANE", "HELICOPTER", "COACH",
        "METRO", "CARAVAN", "TRUCK", "SHIP", "YACHT", "CYCLE",
    ],
    "Garden": [
        "LAWN", "HOSE", "SPADE", "RAKE", "FENCE", "GATE",
        "PATIO", "SHED", "GREENHOUSE", "HEDGE", "BUSH", "SEED",
        "ROSE", "POND", "BENCH", "COMPOST", "GNOME", "TULIP",
    ],
    "Cooking": [
        "CHOP", "SLICE", "DICE", "GRATE", "WHISK", "STIR",
        "BOIL", "ROAST", "BAKE", "GRILL", "SIMMER", "STEAM",
        "KNEAD", "MARINATE", "SEASON", "CHILL", "GLAZE", "BRAISE",
    ],
}

THEMES_ES = {
    "En la cocina": [
        "NEVERA", "HORNO", "TETERA", "TOSTADORA", "BATIDORA",
        "CUCHARA", "TENEDOR", "CUCHILLO", "PLATO", "TAZA",
        "SARTEN", "OLLA", "FREGADERO", "GRIFO", "CAZUELA",
    ],
    "El tiempo": [
        "SOL", "LLUVIA", "NUBE", "VIENTO", "NIEVE", "TORMENTA",
        "FRIO", "CALOR", "NIEBLA", "TRUENO", "GRANIZO", "HUMEDAD",
    ],
    "Partes del cuerpo": [
        "CABEZA", "CUELLO", "HOMBRO", "CODO", "MUÑECA", "MANO",
        "DEDO", "PECHO", "RODILLA", "TOBILLO", "PIE", "BOCA",
        "FRENTE", "BARBILLA", "ESPALDA",
    ],
    "Ropa": [
        "CAMISA", "PANTALON", "VAQUEROS", "CHAQUETA", "ABRIGO",
        "VESTIDO", "FALDA", "ZAPATOS", "BOTAS", "CALCETINES",
        "BUFANDA", "GUANTES", "CINTURON", "CORBATA", "SOMBRERO",
    ],
    "Animales": [
        "PERRO", "GATO", "CABALLO", "CONEJO", "RATON", "ELEFANTE",
        "TIGRE", "MONO", "DELFIN", "BALLENA", "TIBURON",
        "AGUILA", "PINGUINO", "JIRAFA", "CEBRA",
    ],
    "Comida": [
        "PAN", "QUESO", "MANTEQUILLA", "PASTA", "ARROZ", "SOPA",
        "ENSALADA", "PIZZA", "POLLO", "PESCADO",
        "MANZANA", "PLATANO", "NARANJA", "TOMATE", "PATATA",
    ],
    "La casa": [
        "SALON", "COCINA", "BAÑO", "DORMITORIO", "JARDIN", "GARAJE",
        "PASILLO", "BALCON", "TERRAZA", "VENTANA", "PUERTA", "MUEBLE",
        "SUELO", "TECHO", "ESCALERA", "CHIMENEA", "ALFOMBRA",
    ],
    "La familia": [
        "MADRE", "PADRE", "HERMANO", "HERMANA", "ABUELA", "ABUELO",
        "PRIMO", "SOBRINO", "NIETO", "ESPOSO", "ESPOSA", "HIJO", "HIJA",
        "MARIDO", "MUJER", "SUEGRA", "CUÑADO",
    ],
    "Trabajos": [
        "MEDICO", "PROFESOR", "ABOGADO", "COCINERO", "ARTISTA",
        "CAMARERO", "BOMBERO", "POLICIA", "INGENIERO", "GRANJERO",
        "PESCADOR", "OBRERO", "JEFE", "EMPLEADO", "PINTOR", "PANADERO",
        "ENFERMERO",
    ],
    "Deportes": [
        "FUTBOL", "BALONCESTO", "TENIS", "NATACION", "CICLISMO", "BOXEO",
        "ATLETISMO", "GIMNASIA", "ESQUI", "RUGBY", "VOLEIBOL", "GOLF",
        "KARATE", "JUDO", "CORRER", "NADAR", "SALTAR",
    ],
    "La ciudad": [
        "PARQUE", "IGLESIA", "MUSEO", "BANCO", "TIENDA", "MERCADO",
        "CALLE", "PLAZA", "ESTACION", "CINE", "BIBLIOTECA", "FARMACIA",
        "HOSPITAL", "COLEGIO", "AVENIDA", "PUENTE", "FUENTE",
    ],
    "Verbos comunes": [
        "HABLAR", "COMER", "DORMIR", "BEBER", "CORRER", "ANDAR", "JUGAR",
        "ESCRIBIR", "LEER", "CANTAR", "BAILAR", "ESCUCHAR", "MIRAR",
        "TRABAJAR", "VIVIR", "SOÑAR", "COMPRAR",
    ],
    "Hotel": [
        "RECEPCION", "LLAVE", "HUESPED", "RESERVA", "CONSERJE", "MALETERO",
        "BOTONES", "SUITE", "DESAYUNO", "ALMOHADA", "MINIBAR", "BALCON",
        "TOALLA", "VISTA", "ASCENSOR", "REGISTRO", "CAMARERA", "PERSIANA",
    ],
    "Restaurante": [
        "CAMARERO", "MENU", "ENTRANTE", "POSTRE", "CUENTA", "MESA",
        "COMANDA", "COCINERO", "SERVILLETA", "BEBIDA", "PROPINA", "COPA",
        "VINO", "PEDIDO", "CLIENTE", "TAPA", "CARTA", "RACION",
    ],
    "Naturaleza": [
        "ARBOL", "MONTAÑA", "BOSQUE", "LAGO", "CAMPO", "FLOR",
        "HIERBA", "ROCA", "OCEANO", "VALLE", "COLINA", "PRADERA",
        "ARROYO", "CUEVA", "DESIERTO", "ISLA", "PLAYA", "SELVA",
    ],
    "Sentimientos": [
        "ALEGRIA", "TRISTEZA", "MIEDO", "AMOR", "ODIO", "CARIÑO",
        "SORPRESA", "ORGULLO", "VERGUENZA", "ENFADO", "ALIVIO", "ESPERANZA",
        "EMOCION", "NOSTALGIA", "RESPETO", "ASOMBRO", "ANGUSTIA", "ILUSION",
    ],
    "Música": [
        "GUITARRA", "PIANO", "VIOLIN", "TAMBOR", "CANCION", "CANTANTE",
        "BANDA", "ALBUM", "CONCIERTO", "MELODIA", "RITMO", "LETRA",
        "CORO", "FLAUTA", "TROMPETA", "ORQUESTA", "SINFONIA", "BATERIA",
    ],
    "Salud": [
        "MEDICO", "ENFERMERA", "PASTILLA", "FIEBRE", "VENDA", "RESFRIADO",
        "SANO", "EJERCICIO", "VITAMINA", "FARMACIA", "MEDICINA", "SINTOMA",
        "PACIENTE", "CLINICA", "CIRUJANO", "REMEDIO", "ALERGIA", "DOLOR",
    ],
}


# -----------------------------------------------------------------------------
# Placement
# -----------------------------------------------------------------------------

def place_word(grid, word, rng, max_attempts=300):
    """Place a word in a random direction, allowing matching-letter overlap."""
    rows, cols = len(grid), len(grid[0])
    for _ in range(max_attempts):
        dr, dc = rng.choice(DIRECTIONS)
        if dr > 0:
            r0 = rng.randint(0, rows - len(word))
        elif dr < 0:
            r0 = rng.randint(len(word) - 1, rows - 1)
        else:
            r0 = rng.randint(0, rows - 1)
        if dc > 0:
            c0 = rng.randint(0, cols - len(word))
        elif dc < 0:
            c0 = rng.randint(len(word) - 1, cols - 1)
        else:
            c0 = rng.randint(0, cols - 1)

        ok = True
        for i, ch in enumerate(word):
            r, c = r0 + dr * i, c0 + dc * i
            if grid[r][c] not in (None, ch):
                ok = False
                break
        if not ok:
            continue

        for i, ch in enumerate(word):
            r, c = r0 + dr * i, c0 + dc * i
            grid[r][c] = ch

        end_r = r0 + dr * (len(word) - 1)
        end_c = c0 + dc * (len(word) - 1)
        return ((r0, c0), (end_r, end_c))
    return None


def build_grid(words, rows, cols, rng, max_restarts=80):
    """Place all words; on failure, restart with a new random ordering."""
    for _ in range(max_restarts):
        grid = [[None] * cols for _ in range(rows)]
        placements = {}
        # Longest first — easier to fit on an empty grid
        ordered = sorted(words, key=len, reverse=True)
        success = True
        for word in ordered:
            placement = place_word(grid, word, rng)
            if placement is None:
                success = False
                break
            placements[word] = placement
        if success:
            return grid, placements
    raise RuntimeError(f"Could not place all words after {max_restarts} restarts")


def fill_blanks(grid, rng, language='en'):
    alphabet = ALPHABET_ES if language == 'es' else ALPHABET_EN
    rows, cols = len(grid), len(grid[0])
    for r, c in product(range(rows), range(cols)):
        if grid[r][c] is None:
            grid[r][c] = rng.choice(alphabet)


# -----------------------------------------------------------------------------
# Bonus + shadow word scanning
# -----------------------------------------------------------------------------

def path_cells(start, end):
    r0, c0 = start
    r1, c1 = end
    length = max(abs(r1 - r0), abs(c1 - c0)) + 1
    dr = 0 if r1 == r0 else (1 if r1 > r0 else -1)
    dc = 0 if c1 == c0 else (1 if c1 > c0 else -1)
    return [(r0 + dr * i, c0 + dc * i) for i in range(length)]


def scan_bonus_words(grid, theme_words, valid_word_set, min_length=4):
    """Every starting cell, every direction, every length ≥ min_length."""
    rows, cols = len(grid), len(grid[0])
    found = []
    seen = set()
    theme_set = set(theme_words)
    for r0, c0 in product(range(rows), range(cols)):
        for dr, dc in DIRECTIONS:
            buf = []
            r, c = r0, c0
            while 0 <= r < rows and 0 <= c < cols:
                buf.append(grid[r][c])
                if len(buf) >= min_length:
                    word = ''.join(buf)
                    if (word in valid_word_set
                            and word not in theme_set
                            and word not in seen):
                        seen.add(word)
                        found.append({"word": word, "start": [r0, c0], "end": [r, c]})
                r += dr
                c += dc
    return found


def split_real_and_shadow(bonus_words, theme_placements):
    theme_paths = [set(path_cells(p[0], p[1])) for p in theme_placements.values()]
    real_bonus, shadows = [], []
    for bw in bonus_words:
        bw_path = set(path_cells(tuple(bw["start"]), tuple(bw["end"])))
        is_shadow = any(bw_path.issubset(tp) for tp in theme_paths)
        (shadows if is_shadow else real_bonus).append(bw)
    return real_bonus, shadows


# -----------------------------------------------------------------------------
# Generation + DB
# -----------------------------------------------------------------------------

def load_word_list(conn, language):
    with conn.cursor() as cur:
        cur.execute("SELECT word FROM word_lists WHERE language = %s", (language,))
        return {row[0].upper() for row in cur.fetchall()}


def generate_one(theme_name, theme_pool, language, rng, valid_word_set):
    """Generate, regenerating up to MAX_REGEN_ATTEMPTS for bonus density."""
    best = None
    for _ in range(MAX_REGEN_ATTEMPTS):
        words = rng.sample(theme_pool, min(10, len(theme_pool)))
        rows, cols = rng.choice(GRID_VARIANTS)
        grid, placements = build_grid(words, rows, cols, rng)
        fill_blanks(grid, rng, language)

        bonus = scan_bonus_words(grid, words, valid_word_set)
        real_bonus, _ = split_real_and_shadow(bonus, placements)

        candidate = {
            "theme": theme_name,
            "language": language,
            "theme_words": words,
            "key_word": rng.choice(words),
            "grid": grid,
            "grid_rows": rows,
            "grid_cols": cols,
            "word_placements": [
                {"word": w, "start": list(p[0]), "end": list(p[1])}
                for w, p in placements.items()
            ],
            "estimated_bonus_words": len(real_bonus),
        }
        if len(real_bonus) >= MIN_BONUS_TARGET:
            return candidate
        if best is None or candidate["estimated_bonus_words"] > best["estimated_bonus_words"]:
            best = candidate
    return best  # ship best-effort if we never hit MIN_BONUS_TARGET


def insert_puzzle(conn, puzzle, play_date):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO wordsearch_puzzles (
                play_date, language, theme, theme_words, key_word,
                grid, grid_rows, grid_cols, word_placements, estimated_bonus_words
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (play_date, language) DO NOTHING
            RETURNING id;
            """,
            (
                play_date, puzzle["language"], puzzle["theme"],
                puzzle["theme_words"], puzzle["key_word"],
                Json(puzzle["grid"]), puzzle["grid_rows"], puzzle["grid_cols"],
                Json(puzzle["word_placements"]), puzzle["estimated_bonus_words"],
            ),
        )
        row = cur.fetchone()
        return row[0] if row else None


def print_summary(play_date, puzzle, inserted_id=None):
    flag = "✓" if puzzle["estimated_bonus_words"] >= MIN_BONUS_TARGET else "⚠"
    suffix = f" → id={inserted_id}" if inserted_id else " (dry-run)"
    print(f"{play_date} {puzzle['language'].upper()} {flag} "
          f"{puzzle['theme']} · key={puzzle['key_word']} · "
          f"{puzzle['estimated_bonus_words']} bonus est{suffix}")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Actually write to DB")
    parser.add_argument("--days", type=int, default=7, help="Days to generate (default 7)")
    parser.add_argument("--start", type=str, default=None, help="Start date YYYY-MM-DD (default tomorrow)")
    parser.add_argument("--seed", type=int, default=None, help="RNG seed for reproducibility")
    parser.add_argument("--language", choices=["en", "es", "both"], default="both")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    conn = psycopg2.connect(os.environ["SUPABASE_DB"])

    if args.start:
        start = date.fromisoformat(args.start)
    else:
        start = date.today() + timedelta(days=1)

    en_words = load_word_list(conn, 'en') if args.language in ("en", "both") else set()
    es_words = load_word_list(conn, 'es') if args.language in ("es", "both") else set()
    print(f"Loaded {len(en_words):,} EN words, {len(es_words):,} ES words")
    print(f"Mode: {'COMMIT' if args.commit else 'DRY RUN'}")
    print()

    en_themes = list(THEMES_EN.items()); rng.shuffle(en_themes)
    es_themes = list(THEMES_ES.items()); rng.shuffle(es_themes)

    for i in range(args.days):
        play_date = start + timedelta(days=i)

        if args.language in ("en", "both"):
            theme_name, pool = en_themes[i % len(en_themes)]
            puzzle = generate_one(theme_name, pool, 'en', rng, en_words)
            if args.commit:
                pid = insert_puzzle(conn, puzzle, play_date)
                print_summary(play_date, puzzle, pid)
            else:
                print_summary(play_date, puzzle)

        if args.language in ("es", "both") and es_themes:
            theme_name, pool = es_themes[i % len(es_themes)]
            puzzle = generate_one(theme_name, pool, 'es', rng, es_words)
            if args.commit:
                pid = insert_puzzle(conn, puzzle, play_date)
                print_summary(play_date, puzzle, pid)
            else:
                print_summary(play_date, puzzle)

    if args.commit:
        conn.commit()
        print("\nCommitted.")
    else:
        print("\nDry run complete. Re-run with --commit to write.")
    conn.close()


if __name__ == "__main__":
    main()
