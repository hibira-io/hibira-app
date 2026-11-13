# Store screenshots

`../ios/screenshots/<App Store locale>/*.jpg` are 1320×2868 (6.9" iPhone) shots of the real Hibira pages as the
app shows them (iPhone user agent with `HibiraApp/ios`), in a brand frame with a headline per language. Actions →
app-store → `screenshots` uploads them.

To take them again (Linux or macOS, Go, Node with Playwright, Python 3 with requests and Pillow, Noto Sans CJK
and Thai fonts):

1. In a pusher-server checkout: build the web bundles (`cd web && npm ci && npm run build`), then
   `go build -o <this folder>/hbdemo ./cmd/pusher` and `go build -o <this folder>/loadtest ./cmd/loadtest`.
2. Here: `python3 smtpsink.py mail &` (sign-in codes land in `mail/`), `./run.sh &` (a local server with the
   portal, Live Chat and Approvals in memory), `python3 seed.py` (the "Sakura Tea" account on a larger plan with
   three apps, and an Approvals workspace), `./traffic.sh &` (real connections and events on the apps).
3. `./all.sh en ja ko zh-TW zh-CN th vi` switches the account's language, gives the inbox that language's four
   requests (`texts.json`) and saves `raw/<lang>/*.png`.
4. `node compose.cjs ../ios/screenshots en ja ko zh-TW zh-CN th vi` adds the frame and the headlines.

Nothing here talks to production; `state.json`, `mail/`, `raw/` and the binaries stay local.
