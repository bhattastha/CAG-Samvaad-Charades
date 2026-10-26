#!/usr/bin/env bash
# Runs the UI smoke matrix: one background process per engine, viewports sequential
cd /app/tests/load
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pwb
run() { eng=$1; shift; for pair in "$@"; do vp=${pair%%:*}; em=${pair##*:}; timeout 150 /tmp/pwv/bin/python ui_matrix.py $eng $vp qa.$em@gmail.com >> ui_$eng.log 2>&1; done; echo DONE >> ui_$eng.log; }
rm -f ui_*.log
run chromium 1366x768:load22 1920x1080:load22 768x1024:load23 390x844:load23 360x740:load24 &
run firefox 1366x768:load24 1920x1080:load25 768x1024:load25 390x844:load11 360x740:load12 &
run webkit 1366x768:load13 1920x1080:load14 768x1024:load15 390x844:load16 360x740:load17 &
wait
