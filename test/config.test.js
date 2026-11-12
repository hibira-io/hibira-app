// The app's IDs, host and link paths live in several native files; these
// checks keep them in step with each other and with hibira.io
// (pusher-server internal/billing/mobileapp.go serves the association files).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const config = JSON.parse(read("capacitor.config.json"));
const HOST = "hibira.io";
const APP_ID = "io.hibira.app";

test("one app ID everywhere", () => {
  assert.equal(config.appId, APP_ID);
  assert.match(read("ios/App/App.xcodeproj/project.pbxproj"), /PRODUCT_BUNDLE_IDENTIFIER = io\.hibira\.app;/);
  assert.match(read("android/app/build.gradle"), /applicationId "io\.hibira\.app"/);
});

test("the web view opens the portal and stays on Hibira's hosts", () => {
  const url = new URL(config.server.url);
  assert.equal(url.host, HOST);
  assert.equal(url.pathname, "/portal/dashboard");
  // Live Chat's inbox (chat.hibira.io) opens in the app too.
  assert.deepEqual(config.server.allowNavigation, [HOST, "chat.hibira.io"]);
  assert.equal(config.ios.appendUserAgent, "HibiraApp/ios");
  assert.equal(config.android.appendUserAgent, "HibiraApp/android");
});

test("portal links open the app", () => {
  const ent = read("ios/App/App/App.entitlements");
  assert.match(ent, new RegExp(`applinks:${HOST.replace(".", "\\.")}`));
  assert.match(ent, /aps-environment/);
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /android:autoVerify="true"/);
  for (const path of ['android:pathPrefix="/portal/dashboard"', 'android:pathPrefix="/portal/approvals"', 'android:path="/portal/reset-password"']) {
    assert.ok(manifest.includes(path), path);
  }
  // Billing stays in the browser: nothing is sold in the app.
  assert.ok(!/\/billing|\/pricing/.test(manifest));
});

test("the plugins only open links on hibira.io", () => {
  const swift = read("plugins/hibira-app-push/ios/Sources/HibiraAppPushPlugin/HibiraAppPushPlugin.swift");
  const java = read("plugins/hibira-app-push/android/src/main/java/io/hibira/app/push/HibiraAppPushPlugin.java");
  assert.match(swift, /static let host = "hibira\.io"/);
  assert.match(java, /HOST = "hibira\.io"/);
  assert.match(swift, /url\.scheme == "https", url\.host == Self\.host/);
});

test("provider sign-ins come back on the app's scheme", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.ok(manifest.includes('android:scheme="io.hibira.app" android:host="auth"'));
  const swift = read("plugins/hibira-app-push/ios/Sources/HibiraAppPushPlugin/HibiraAppAuthPlugin.swift");
  const java = read("plugins/hibira-app-push/android/src/main/java/io/hibira/app/push/HibiraAppAuthPlugin.java");
  assert.match(swift, /static let scheme = "io\.hibira\.app"/);
  assert.match(java, /SCHEME = "io\.hibira\.app"/);
  // Only hibira.io's provider sign-in starts open in the browser.
  assert.match(swift, /url\.host == HibiraAppPushPlugin\.host, url\.path\.hasPrefix\("\/api\/v1\/oauth\/"\)/);
  assert.match(java, /startsWith\("\/api\/v1\/oauth\/"\)/);
});
