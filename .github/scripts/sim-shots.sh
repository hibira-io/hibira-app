#!/bin/bash
# sim-shots.sh: builds the app for the iPhone simulator and saves screenshots
# to shots/ (see .github/workflows/sim-shots.yml). PAGE overrides the start page.
set -euo pipefail
mkdir -p shots

build() { # $1 = start URL ("" keeps the app's own), $2 = derived data folder
  cp capacitor.config.json /tmp/capacitor.config.json
  if [ -n "$1" ]; then
    node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync("capacitor.config.json"));c.server.url=process.argv[1];fs.writeFileSync("capacitor.config.json",JSON.stringify(c,null,2))' "$1"
  fi
  npx cap sync ios
  xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
    -derivedDataPath "$2" CODE_SIGNING_ALLOWED=NO build | tail -3
  cp /tmp/capacitor.config.json capacitor.config.json
}

shoot() { # $1 = device name, $2 = app path, $3 = file prefix
  local id
  id=$(xcrun simctl list devices available | grep -F "$1 (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)
  if [ -z "$id" ]; then echo "no simulator named $1"; return 0; fi
  xcrun simctl boot "$id" || true
  xcrun simctl bootstatus "$id" -b
  xcrun simctl status_bar "$id" override --time "9:41" --batteryState charged --batteryLevel 100 || true
  xcrun simctl install "$id" "$2"
  for look in light dark; do
    xcrun simctl ui "$id" appearance "$look"
    xcrun simctl terminate "$id" io.hibira.app 2>/dev/null || true
    xcrun simctl launch "$id" io.hibira.app
    sleep 20
    xcrun simctl io "$id" screenshot "shots/$3-$look.png"
  done
  xcrun simctl shutdown "$id"
}

xcrun simctl list devices available | grep -i iphone || true
build "${PAGE:-}" build/app
APP=$(find build/app/Build/Products -name "App.app" -maxdepth 2 | head -1)
shoot "iPhone 17 Pro Max" "$APP" start-large
shoot "iPhone 17 Pro" "$APP" start
shoot "iPhone 16e" "$APP" start-small

# No network path to the start page: the app's own offline page.
build "https://offline.invalid/" build/offline
APP=$(find build/offline/Build/Products -name "App.app" -maxdepth 2 | head -1)
shoot "iPhone 17 Pro" "$APP" offline
ls -la shots
