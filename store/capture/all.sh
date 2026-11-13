#!/bin/bash
cd "$(dirname "$0")"; export NODE_PATH=$(npm root -g)
for L in "$@"; do python3 prep.py $L >prep-$L.log 2>&1 && node shot.cjs $L raw/$L 3 && echo "shot $L" || echo "FAIL $L"; done
