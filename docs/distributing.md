# Distributing AvieBaby to family

This is the operational runbook for shipping AvieBaby to family members and pushing new books to them over the air. The architecture and rationale are in `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md`.

---

## One-time per machine: install the EAS CLI

You need this on whichever machine is running builds and pushing OTA updates.

```bash
npm install --global eas-cli
```

Or use it on the fly with `npx eas-cli ...`. Either works. The rest of this doc assumes `npx eas-cli` so it works without a global install.

---

## One-time per project: link to EAS

You only do this once for the repo.

```bash
npx eas-cli login           # Ryan's Expo account credentials (browser opens)
npx eas-cli init            # writes the project id into app.json
npx eas-cli update:configure   # writes the updates.url into app.json
```

Commit the `app.json` changes after.

---

## One-time per family member: install the preview build

### iOS (TestFlight)

**Use the `preview-ios` profile, NOT `preview`.** The `preview` profile is `distribution: internal`, which for iOS means an ad-hoc build that needs every device's UDID registered and *cannot* be submitted to TestFlight. `preview-ios` (`distribution: store`, extends `preview` so it keeps `channel: preview` and the same OTA loop) produces a TestFlight-submittable build with no UDIDs required — testers are invited by email.

1. **Run the first build in a real terminal, not through any tooling/agent.** First-time iOS credential setup (Distribution Certificate + Provisioning Profile) requires an interactive TTY. Non-interactive shells fail with *"Run this command again in interactive mode."* Open Windows Terminal / PowerShell in the repo and run:
   ```bash
   npx eas-cli build --platform ios --profile preview-ios --auto-submit
   ```
   When prompted: log in to your Apple account (Apple ID + 2FA), let **EAS manage credentials**, and say **Yes** to generating the Distribution Certificate / Provisioning Profile and registering the bundle id.
2. **Apple account gates (first time only).** New submissions can be blocked until, at https://developer.apple.com/account (as Account Holder), you accept the current **Apple Developer Program License Agreement**, and in App Store Connect you provide **DSA trader status** (an individual shipping a free family app can declare *non-trader*). If either is outstanding, the build succeeds but `--auto-submit` fails — clear them, then submit separately (step 3).
3. **If auto-submit fails but the build succeeded**, don't rebuild — submit the finished build on its own (needs the `submit.preview-ios` profile in `eas.json`):
   ```bash
   npx eas-cli submit --platform ios --profile preview-ios --latest
   ```
4. Wait ~30–45 minutes for the cloud build, then ~10–15 minutes for Apple to process the upload. Watch the URL the CLI prints, or visit `https://expo.dev/accounts/<you>/projects/aviebaby/builds`.
5. Visit https://appstoreconnect.apple.com → AvieBaby → TestFlight.
6. **Smoke-test first:** add your own Apple ID as an **Internal** tester — internal testers install immediately, no review.
7. Under **External Testing**, create the **Family** group if it doesn't exist, and add the tester's email to it.
8. **First external build only**: Apple does a one-time Beta App Review (~24 hours, sometimes faster). Subsequent builds within the same major version skip this review. Internal testers are unaffected by this review.
9. Tester receives an email invite. They install the free **TestFlight** app from the App Store, tap the invite link in the email, and AvieBaby installs. (See the ready-to-send message under "Message to send a new tester" below.)

### Android (direct APK)

1. From your machine:
   ```bash
   eas build --platform android --profile preview
   ```
2. When the build finishes, EAS provides a download URL.
3. Share the URL with the tester however you like (email, text, signal).
4. Tester taps the URL on their phone. Android prompts "Allow install from this source" — they accept once per source.
5. APK installs.

There's no store involvement. No "internal track" paperwork, no Play Console enrollment.

---

## Message to send a new tester (iOS)

Copy-paste and personalize this when inviting a family member:

> Hi! I made a little app for Ava and I'd love you to put it on your phone. It's called **AvieBaby**. Here's how:
>
> 1. First install Apple's **TestFlight** app from the App Store (it's free — it's just how Apple lets people try apps before they're public).
> 2. You'll get an **email invite from Apple** (check spam if you don't see it). Tap **"View in TestFlight"** — or tap the link I text you.
> 3. In TestFlight, tap **Install** next to AvieBaby.
> 4. Open it like any normal app from your home screen. That's it! 💛
>
> A few things to know:
> - It's completely safe — it's just Ava's play-and-books app, no ads, no sign-in, nothing collected.
> - **To open the grown-up settings:** press and hold the **top-left corner** for about 2 seconds.
> - I'll be adding new books and features over time — they'll show up automatically next time you fully close and reopen the app, no reinstalling needed.
> - If anything looks off or won't install, just text me a screenshot.

---

## The daily workflow: adding a book

You, your wife, or your parents finish recording a book in the book-tool. From any machine that has the repo synced:

```bash
node scripts/book-register.js
eas update --channel preview --message "Added Goodnight Moon (Mom)"
```

Or wrapped into the single npm script:

```bash
npm run publish-update -- --message "Added Goodnight Moon (Mom)"
```

That ships the new JS bundle + asset diff to Expo's CDN under the `preview` channel. Family devices fetch on next cold launch.

### How the update reaches the device

Two cold launches needed on the recipient's phone:

1. **First cold launch** after publish — `expo-updates` checks the CDN, detects a newer bundle, downloads it in the background. The app still uses the cached (older) bundle for the current session.
2. **Second cold launch** — the new bundle applies. New books are visible.

A toddler-driven device usually hits both within hours. Worst-case, a few days if the app isn't opened often.

---

## TestFlight 90-day expiry

TestFlight builds disappear from testers' devices after 90 days. Set a calendar reminder every ~85 days:

```bash
npx eas-cli build --platform ios --profile preview-ios --auto-submit
```

Cached OTA books survive the binary refresh — testers don't lose any state.

---

## When you need a new binary build (not just OTA)

OTA covers: new books, new JS code, new bundled assets, theme changes, layout tweaks.

You need a fresh binary build (and family must re-install) when:

- Bumping Expo SDK to a new major version
- Adding or removing a native Expo module (e.g., `expo-notifications`, a new `expo-*` plugin)
- Changing app permissions (microphone, camera, etc.)
- Modifying any `app.json` field that affects native config (bundle id, icon paths, splash, plugins list, etc.)
- Editing any native code under `ios/` or `android/` (we don't have any custom native code today, but if you ever add some)

For any of those, rebuild each platform with its own profile (iOS and Android use different distribution methods, so there's no single `--platform all` command):

```bash
npx eas-cli build --platform android --profile preview               # sideload APK
npx eas-cli build --platform ios --profile preview-ios --auto-submit  # TestFlight
```

Then share the new Android APK link. iOS testers get the new build automatically through TestFlight (after the ~10 minute Apple processing).

---

## Tester onboarding checklist

For each new family member:

| Step | iOS | Android |
|---|---|---|
| 1 | Add Apple ID email to "Family" group in App Store Connect | Share latest EAS APK download URL |
| 2 | Confirm tester received invite email (sometimes lands in spam) | Confirm tester received the URL |
| 3 | Tester installs TestFlight from App Store, taps invite link, installs AvieBaby | Tester taps URL, accepts "install from unknown source" prompt, installs |
| 4 | Walk through opening the app twice (greeting, magic button, adult panel) | Same |
| 5 | Verify expo-updates ran on launch (no error toasts) | Same |

---

## Troubleshooting

### OTA update didn't appear after two cold launches

Likely causes, in order of probability:

- **The phone never opened the app between publish and the test.** `expo-updates` only checks on cold launch. Confirm the app was actually closed and reopened, not just backgrounded.
- **Runtime version mismatch.** The `fingerprint` runtime version policy hashes native code + config. If the installed binary's fingerprint differs from the latest update's, the device won't apply the update. Diagnose:
  ```bash
  npx eas-cli update:list --channel preview --json | jq '.[0].runtimeVersion'
  ```
  Compare to the installed binary's runtimeVersion (visible on the EAS build page for that build). If they differ, you need a new binary build — the OTA can't bridge native changes.
- **Phone had no internet during cold launch.** Update checks fail silently and the app uses the cached bundle. Confirm connectivity and retry.

### `eas build` fails with provisioning profile errors (iOS)

Usually a credential drift between EAS and Apple. Run:

```bash
npx eas-cli credentials --platform ios --profile preview
```

Accept EAS-managed credentials. EAS will sync with Apple and regenerate if needed.

### Apple flags the binary in Beta App Review

Usually a description / privacy field issue, not the app itself. Update the TestFlight metadata in App Store Connect:

- Beta App Description: "Private family beta of AvieBaby. No data collection. No external sharing."
- Privacy Policy URL: if required, post a one-paragraph statement on a public gist or GitHub README and link to it. The truthful statement is short: AvieBaby collects no data, makes no network calls except `expo-updates`' own cold-launch check.

### Android tester's phone refuses to install the APK

- Check the URL hasn't expired (EAS download URLs have a TTL — usually 30 days. Re-share if so).
- Confirm Android version is >= what `eas.json` declares as `minSdkVersion`.
- If "Install from unknown source" is denied: Settings → Apps → Special access → Install unknown apps → enable for whichever browser/app delivered the link.

### `eas update` publishes succeed but `eas update:list` shows nothing

Usually a misconfigured channel. Confirm `app.json`'s `updates.url` is set, and the runtimeVersion matches an existing build. Without `eas update:configure` having been run, OTA publishes go into the void.

### `npm run publish-update -- --message "..."` doesn't forward the message correctly

The `--` separator is npm's argument forwarding. If your shell strips it, use the explicit command:

```bash
node scripts/book-register.js && eas update --channel preview --message "your message"
```

---

## Quick reference: what each command does

| Command | What it does |
|---|---|
| `npx eas-cli login` | One-time browser auth to your Expo account |
| `npx eas-cli init` | One-time link of this repo to an EAS project |
| `npx eas-cli update:configure` | One-time write of updates URL into app.json |
| `eas build --platform android --profile preview` | Cloud-builds the sideload APK; ~30 minutes |
| `eas build --platform ios --profile preview-ios --auto-submit` | Build iOS (store distribution) + upload to App Store Connect for TestFlight |
| `eas submit --platform ios --profile preview-ios --latest` | Submit the latest finished iOS build to TestFlight (if `--auto-submit` was skipped or failed) |
| `eas update --channel preview --message "..."` | Publish OTA update to the preview channel |
| `npm run publish-update -- --message "..."` | Regenerate book registry + publish OTA in one step |
| `npx eas-cli update:list --channel preview` | List recent OTA updates on the preview channel |
| `npx eas-cli credentials --platform ios --profile preview-ios` | Inspect / repair iOS signing credentials |
