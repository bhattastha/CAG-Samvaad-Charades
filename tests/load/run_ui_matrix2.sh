#!/usr/bin/env bash
# Runs the cross-browser matrix v2: one background process per engine, viewports sequential (priority 1366x768, 390x844 first)
cd /app/tests/load
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pwb
run() { eng=$1; shift; for pair in "$@"; do vp=${pair%%:*}; em=${pair##*:}; timeout 170 /tmp/pwv/bin/python ui_matrix2.py $eng $vp qa.$em@gmail.com >> ui2_$eng.log 2>&1; done; echo DONE >> ui2_$eng.log; }
rm -f ui2_*.log
run chromium 390x844:xb02 1920x1080:xb03 768x1024:xb04 360x740:xb05 &
run firefox 1366x768:xb06 390x844:xb07 1920x1080:xb08 768x1024:xb09 360x740:xb10 &
run webkit 1366x768:xb11 390x844:xb12 1920x1080:xb13 768x1024:xb14 360x740:xb15 &
wait
