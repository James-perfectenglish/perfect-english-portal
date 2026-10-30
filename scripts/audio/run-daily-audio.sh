#!/bin/sh
# Loads .env.local then runs the Word of the Day / Phrasal Verb of the Day audio
# generator. Dry run unless you pass --commit. See generate_daily_audio.py for options.
#
# Usage:
#   sh scripts/audio/run-daily-audio.sh                     # preview + character count
#   sh scripts/audio/run-daily-audio.sh --commit            # English, everything still missing audio
#   sh scripts/audio/run-daily-audio.sh --review            # word clips waiting for a listen
cd "$(dirname "$0")/../.." || exit 1
set -a
. ./.env.local
set +a
python3 scripts/audio/generate_daily_audio.py "$@"
