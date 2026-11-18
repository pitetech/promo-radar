#!/usr/bin/env sh
# Entry point for cron on Linux/macOS. Example crontab (every 20 minutes):
#   */20 * * * * /path/to/promo-radar/scripts/run.sh
cd "$(dirname "$0")/.." || exit 1
mkdir -p data
node src/cli.mjs run >> data/run.log 2>&1
