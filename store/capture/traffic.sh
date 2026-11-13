#!/bin/bash
# traffic.sh: real WebSocket clients and events on the three demo apps (pusher-server's cmd/loadtest as ./loadtest).
cd "$(dirname "$0")"
python3 - <<'PY' > traffic-run.sh
import json
st=json.load(open('state.json'))
cfg={'Storefront':(320,'store',40,25),'Order tracking':(180,'order',60,12),'Live auction':(140,'lot',8,30)}
for r in st['apps']:
    c,p,ch,rate=cfg[r['name']]
    print(f"./loadtest -app-id {r['id']} -key {r['key']} -secret {r['secret']} -connections {c} -channels {ch} -prefix {p} -rate {rate} -duration 120m -ramp 40s > lt-{p}.log 2>&1 &")
print('wait')
PY
exec bash traffic-run.sh
