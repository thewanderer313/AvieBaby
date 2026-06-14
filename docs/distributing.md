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

1. From your machine, kick off the build:
   ```bash
   eas build --platform ios --profile preview --auto-submit
   ```
2. Wait ~30–45 minutes for the cloud build. Then ~10–15 minutes for Apple to process the upload. Watch the URL the CLI prints, or visit `https://expo.dev/accounts/<you>/projects/aviebaby/builds`.
3. Visit https://appstoreconnect.apple.com → AvieBaby → TestFlight → External Testing.
4. If the **Family** group doesn't exist yet, create it.
5. Add the tester's Apple ID email to the group.
6. **First build only**: Apple does a one-time Beta App Review (~24 hours, sometimes faster). Subsequent builds within the same major version skip this review.
7. Tester receives an email invite. They install the free **TestFlight** app from the App Store, tap the invite link in the email, and AvieBaby installs.

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
eas build --platform ios --profile preview --auto-submit
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

For any of those:

```bash
eas build --platform all --profile preview --auto-submit
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
| `eas build --platform <ios\|android\|all> --profile preview` | Cloud-builds binaries; ~30 minutes |
| `eas build --platform ios --profile preview --auto-submit` | Build iOS + upload to App Store Connect for TestFlight |
| `eas update --channel preview --message "..."` | Publish OTA update to the preview channel |
| `npm run publish-update -- --message "..."` | Regenerate book registry + publish OTA in one step |
| `npx eas-cli update:list --channel preview` | List recent OTA updates on the preview channel |
| `npx eas-cli credentials --platform ios --profile preview` | Inspect / repair iOS signing credentials |
