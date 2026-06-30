#!/bin/sh
# Loads .env.local (Anthropic key + Supabase DB url) then runs the
# tense-specimen generator. No shell exports or quoting needed.
#
# Usage:
#   sh scripts/run-generator.sh --dry --target=60     # preview, no DB writes
#   sh scripts/run-generator.sh                       # full run
#   sh scripts/run-generator.sh --lang=es             # one language, etc.
cd "$(dirname "$0")/.." || exit 1
set -a
. ./.env.local
set +a
node scripts/generate_tense_specimens.mjs "$@"
