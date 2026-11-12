# Hibira (iPhone and Android app)

One app for everything on [Hibira](https://hibira.io): your Realtime apps, approval requests, waiting rooms and
the Live Chat inbox. It opens [hibira.io/portal/dashboard](https://hibira.io/portal/dashboard) in a native shell
([Capacitor](https://capacitorjs.com) 8). The site does the work. The app adds what a phone needs: notifications,
sign-in that works with Google, and links that open in the app.

[Hibira Chat](https://github.com/hibira-io/livechat-app) (`io.hibira.chat`), the app for Live Chat agents, stays a
separate app. Agents who only answer chats keep using it; account owners and developers use this one.

| | |
| --- | --- |
| App ID | `io.hibira.app` (iOS bundle ID and Android package), name "Hibira" |
| Opens | `https://hibira.io/portal/dashboard`; the user agent ends in `HibiraApp/ios` or `HibiraApp/android`. `chat.hibira.io` (the Live Chat inbox) and `approvals.hibira.io` (the Approvals inbox) also open inside the app. |
| Sign-in | Email and password in the web view. Apple, Google, Microsoft or GitHub open in the system browser (`HibiraAppAuth`, below), because Google refuses web views; Sign in with Apple is offered per App Store guideline 4.8. |
| Notifications | [Hibira Push](https://hibira.io/guides/push-notifications): [hibira-push-ios](https://github.com/hibira-io/hibira-push-ios) (APNs) and [hibira-push-android](https://github.com/hibira-io/hibira-push-android) (FCM). Every notice the portal sends to browsers also reaches the phone: approval requests, usage alerts, service status, failed payments and failing webhooks. A tap opens the page it is about (`approvals.hibira.io/inbox/<id>`, `/portal/apps/<id>`, …). |
| Sold in the app | Nothing. Plans are bought on the website; the portal hides billing in the app. |
| Server side | pusher-server `internal/billing/mobileapp.go`: `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`, `POST /api/v1/login/app`, `POST /api/v1/me/app-push`. The portal's side is `web/portal/src/lib/nativeApp.ts`. |

## How it fits together

```
portal (hibira.io)                                   this app
  signed in → POST /api/v1/me/app-push ─────────▶  HibiraAppPush.register({instance_id, endpoint, user_id, token})
                                                     → Hibira Push registers the phone as that account
  sign out → HibiraAppPush.signOut()
pusher-server notice (notifyBrowsers) ──────────▶  push with data.url = https://hibira.io/portal/…  → tap opens it
portal link in an email ────────────────────────▶  app opens, web view loads the link
```

Provider sign-in: the sign-in page calls `HibiraAppAuth.open({url})` with
`https://hibira.io/api/v1/oauth/<provider>?app=ios|android&app_challenge=<S256 of a secret>&next=…`. iOS opens it
in an `ASWebAuthenticationSession`, Android in the browser. The server ends on `io.hibira.app://auth#token=…`
(or `#error=…`); the plugin returns that URL and the page posts the token with its secret to `/api/v1/login/app`,
which starts the session (or the two-factor step) in the web view. A token without the secret does nothing, so
another app that claims the scheme gains nothing.

`plugins/hibira-app-push` is the only native code: `ios/Sources/HibiraAppPushPlugin/` and
`android/src/main/java/io/hibira/app/push/`. The page finds it at `window.Capacitor.Plugins.HibiraAppPush` and
`HibiraAppAuth`; in a browser they are absent, so the page's calls do nothing.

## One-time setup

1. **Apple** (Team ID `6XM26CXAA2`). Apple Developer → Identifiers: add the App ID `io.hibira.app` with
   **Associated Domains** and **Push Notifications**. App Store Connect: add a new app with that bundle ID, named
   "Hibira".
2. **APNs key.** The team's key "Hibira APNs" (Key ID `732CWQ4Y8S`) works for every app on the team. Upload the
   `.p8` in the hibira.io console: search for the app `hibira-mobile`, open Push notifications, bundle ID
   `io.hibira.app`. The app is created the first time a phone signs in.
3. **Firebase** (Android notifications). Add an Android app `io.hibira.app` to a Firebase project (the one Hibira
   Chat uses is fine). Save its `google-services.json` as the secret `GOOGLE_SERVICES_JSON`, and upload a service
   account key on the same `hibira-mobile` push page.
4. **Play Console.** Create the app `io.hibira.app`. The very first bundle must be uploaded by hand.
5. **Secrets and variables** (org-level secrets need this repo added to their selected repositories):
   - iPhone: variable `APPLE_TEAM_ID` (org). Secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the team's
     App Store Connect API key, Admin role).
   - Android: `ANDROID_UPLOAD_KEYSTORE` (base64 of an upload `.jks`), `ANDROID_UPLOAD_PASSWORD`,
     `GOOGLE_SERVICES_JSON`. Optional `PLAY_SERVICE_ACCOUNT_JSON` uploads to internal testing. To make the key:
     `keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Hibira, O=Hibira, C=TW"`,
     then `base64 -i upload.jks | gh secret set ANDROID_UPLOAD_KEYSTORE -R hibira-io/hibira-app`.
6. **Android App Links.** Put the SHA-256 of Play's app signing key (Play Console → Test and release → App
   integrity) and of the upload key (each release run's summary) in pusher-server's Terraform variable
   `app_android_sha256` (`BILLING_APP_ANDROID_SHA256`). iOS needs nothing: the server lists
   `6XM26CXAA2.io.hibira.app` by default.

## Releasing

Push a tag: `v1.2.3` builds version `1.2.3`, build number `1002003`. Each tag can go to a store once.

- **iPhone:** Xcode signs in the cloud with the API key, archives, and uploads to TestFlight. The Apple Development certificate Xcode makes on each fresh runner is revoked at the end of the job, so they don't pile up on the team. Store text in seven
  languages is in `store/ios/metadata/` (review notes in `app.json`; add the demo account's sign-in there in App
  Store Connect).
- **Android:** builds and signs the `.aab` and keeps it as the run's artifact; with `PLAY_SERVICE_ACCOUNT_JSON` it
  also uploads to internal testing. An individual Play account needs a closed test with 12 testers for 14 days
  before production.

The App Store listing (texts in all seven languages, categories, age rating, review details, free price) is filled by Actions → **app-store** → Run workflow, from `store/ios/metadata/`.

Screenshots must be real ones of the app; they are not in the repo yet.

Pull requests build both apps without signing (`ci.yml`), and `npm test` checks that the IDs, hosts and link paths
agree across the native files.

## Working on it

```sh
npm ci
npx cap sync          # after changing capacitor.config.json or the plugin
npx cap open ios      # Xcode, on a Mac
npx cap open android  # Android Studio
```

New portal features reach both apps without a release. A release is needed only for native changes: the plugin,
icons, permissions, link paths or the app ID.

## 中文摘要

Hibira 的统一 App（iPhone 和 Android），用 Capacitor 打开 hibira.io/portal/dashboard，Realtime 应用、审批、等候室和
Live Chat 收件箱都在里面。Hibira Chat（客服专用 App）继续独立存在。

- 登录：邮箱密码在 App 内；Apple / Google / Microsoft / GitHub 在系统浏览器完成后回到 App。
- 推送：通过 Hibira Push（隐藏应用 `hibira-mobile`）。控制台发给浏览器的通知（审批请求、用量提醒、服务状态、付款失败、
  Webhook 失败）都会同时推到手机，点开直接进入对应页面。
- 购买：App 里不卖任何东西，账单页面在 App 内隐藏。

第一次需要做的事：在 Apple 建 App ID `io.hibira.app` 和 App Store Connect 的 App；把 APNs 金钥上传到 `hibira-mobile` 的推送设置；
Firebase 加 Android App 并设置 `GOOGLE_SERVICES_JSON`；在 Play 建 App；把本仓库加进组织 Secrets；Android 签名指纹填到 pusher-server
的 Terraform 变量 `app_android_sha256`。

发版：推送 tag `v1.2.3`，iPhone 自动送 TestFlight，Android 产出 .aab。
