#!/bin/sh
# Loads .env.local (ElevenLabs key, Supabase DB url, service-role key) then runs
# the Call My Bluff audio generator. Dry run unless you pass --commit.
#
# Usage:
#   sh scripts/bluff/run-bluff-audio.sh                                   # preview + character count
#   sh scripts/bluff/run-bluff-audio.sh --commit --limit 3 --save-local ~/Desktop/bluff-test
#   sh scripts/bluff/run-bluff-audio.sh --commit                          # everything still missing audio
cd "$(dirname "$0")/../.." || exit 1
set -a
. ./.env.local
set +a
python3 scripts/bluff/generate_bluff_audio.py "$@"
