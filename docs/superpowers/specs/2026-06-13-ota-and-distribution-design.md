# OTA Updates and Family Distribution — Design

**Status:** Draft for review
**Author:** Ryan + Claude (brainstorm, 2026-06-13)

## Motivation

Once the library-and-readings work merges to `main`, the next concrete step is shipping a preview build to family — Ryan, his wife, his parents, and his sister Kristen (Ava's mom). Kristen lives in another state, so the goal is: install once, then have new books appear automatically on her phone whenever Ryan (or any other family adult) finishes recording one.

The app already has zero data collection and no network calls at runtime. We need to add OTA (over-the-air) updates and a distribution pipeline without changing that property at runtime — the only network traffic should be `expo-updates`' own update-check on cold launch.

## Goals

- One-time install per family member; subsequent book additions land without re-install.
- The publish loop is one command: regenerate registry + push update.
- Apple is in the loop only for iOS binary distribution (TestFlight) — no Apple involvement for OTA payloads.
- Expo's hosted CDN handles OTA payloads; no self-hosting required.
- Ava is never recorded, photographed, or tracked at runtime. This was true in v1 and stays true.

## Non-goals (this milestone)

- App Store proper (production track) — deferred until the family has lived with the preview for a while.
- Silent push notifications for instant updates — relies on next-cold-launch checks (Expo default).
- Per-recipient OTA channels — single `preview` channel; staged rollout can be added later.
- Self-hosted update server — Expo's hosted service is acceptable for the family-app threat model.
- A backend server, accounts, or analytics.

## Architecture

Three layers:

1. **Distribution** — Binary builds via EAS Build. iOS auto-submits to App Store Connect → TestFlight. Android downloads as a signed `.apk` from EAS and is shared as a link. One-time install per family member.
2. **OTA** — `expo-updates` runtime embedded in the binary. `eas update --channel preview` publishes a new JS bundle + asset diff to Expo's CDN. Family devices fetch on next cold launch.
3. **Asset pipeline** — Unchanged from the book-tool work. New addition: a single npm script wrapping `book-register.js` + `eas update`.

## Build profiles (`eas.json`)

Two profiles, already present and to be extended:

- **`preview`** — `distribution: "internal"`, `channel: "preview"`. Used for the family. iOS .ipa auto-submits to App Store Connect. Android .apk downloads via EAS.
- **`production`** — `channel: "production"`. Reserved for future App Store release; not used in v1 distribution.

## Binary distribution flow

### iOS (TestFlight)

Pipeline:
1. `eas build --platform ios --profile preview --auto-submit` builds .ipa and uploads to App Store Connect.
2. Apple processes the build (~10 minutes typical).
3. Build appears in App Store Connect → TestFlight section.
4. Ryan adds external testers in the "Family" group (web UI, not CLI). One-time setup: invite Wife, Mom, Dad, Kristen by email.
5. First build triggers a one-time Beta App Review by Apple (~24h, sometimes faster). Subsequent builds within the same major version do not re-review.
6. Testers receive an email invite, install the TestFlight app from the App Store, accept invite, install AvieBaby.

90-day expiry: TestFlight builds disappear from testers' devices after 90 days. Mitigation: calendar reminder every ~85 days to rebuild + auto-submit. Local OTA-cached books survive the binary refresh (the app's persistent storage isn't reset).

### Android (signed APK)

Pipeline:
1. `eas build --platform android --profile preview` builds the .apk and exposes it on a download URL EAS provides.
2. Ryan shares the link with family.
3. First-time tap: Android prompts "Allow install from this source" — tester accepts once per source.
4. APK installs.

No store involvement. Subsequent Android binary rebuilds (e.g., for SDK bump) require re-sharing the new link. OTA updates flow without involving the link.

### Family tester onboarding

One-time, manual:
- iOS: Add each Apple ID email to the "Family" external tester group in App Store Connect.
- Android: Send each recipient the EAS APK download URL.
- Both: brief instructions in `docs/distributing.md` for first-install ("tap link, tap allow, open app").

## OTA configuration

### `app.json` changes

```json
{
  "expo": {
    "updates": {
      "url": "<auto-filled by `eas update:configure`>",
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0
    },
    "runtimeVersion": { "policy": "fingerprint" }
  }
}
```

- `checkAutomatically: "ON_LOAD"` — each cold launch fires an update check. If a newer bundle exists, it downloads in the background. The new bundle is applied on the *next* cold launch, not the current one.
- `fallbackToCacheTimeout: 0` — don't block app startup waiting for the update fetch; render from cache immediately, fetch in background.
- `runtimeVersion: { policy: "fingerprint" }` — Expo hashes native code + config to produce a runtime version. Updates only flow to binaries with the matching fingerprint. If you add a new native module or change permissions, the fingerprint changes; old binaries stop receiving updates until they're rebuilt.

### Dependency

Add `expo-updates` to `package.json` at the version matching Expo SDK 56. The package is provided by Expo and slots into the build automatically — no native config files to hand-edit.

### EAS project link

One-time setup:
1. `npx eas-cli login` (Ryan's Expo account)
2. `npx eas-cli init` writes the EAS project id into `app.json`
3. `npx eas-cli update:configure` writes the OTA URL into `app.json` and prepares iOS/Android update channel config

## Publish workflow

The publish loop, run by any family adult who's finished recording a book:

```bash
node scripts/book-register.js
eas update --channel preview --message "Added Goodnight Moon (Mom)"
```

Wrapped into one npm script in `package.json`:

```json
"publish-update": "node scripts/book-register.js && eas update --channel preview"
```

Usage: `npm run publish-update -- --message "Added Goodnight Moon (Mom)"` (the `--` forwards args to `eas update`).

After publish, Kristen's phone:
1. Next cold launch — `expo-updates` checks Expo CDN for a newer bundle.
2. Bundle found — downloads in background while she's using the cached (older) version.
3. Cold launch after that — new bundle applies, new books are present.

Worst case from publish to visible-on-device: two cold launches (the first detects + downloads, the second applies). If she opens the app twice in a day, she has the book within hours. If she only opens it once a week, it's a week.

For "surprise" deliveries: publish in the evening, sister sees new book during her next-day toddler bedtime routine. That matches the "appears as a surprise" semantics requested.

## Asset size and bandwidth

Each book adds roughly:
- Page images: ~5–15 page PNGs × ~200KB each = 1–3 MB
- Audio: ~10 pages × ~50KB each (96 kbps mp3, ~5s clips) = ~500 KB per reader
- Cover thumbnail: ~50 KB

A typical 10-page book read by one parent: ~2 MB on disk. A book with three readers: ~3.5 MB.

Family library projection: 20 books over the first year × 2-3 readers average × ~3 MB = ~120 MB total. Five family members downloading each book at most once = ~600 MB cumulative over the year. Expected to fit comfortably in EAS Update's free tier for a 5-MAU project; if Expo's tier limits change or the library balloons, the upgrade path is a small monthly EAS subscription.

## Privacy posture (explicit)

What sits on third-party infrastructure:
- **Apple (App Store Connect / TestFlight)**: the iOS `.ipa` binary, which includes whatever assets are bundled into the original binary build. Apple stores this for the duration the build is active in TestFlight (90 days max).
- **Expo (EAS Update CDN)**: every OTA-shipped JS bundle and asset. Hosted on Expo's infra (Cloudflare-backed CDN). Stored as long as the channel is active.

What's in those payloads:
- Page photographs (book pages, not people)
- Adult voice recordings (Ryan, wife, parents, anyone who records) reading book pages
- Theme assets (AI-generated Veo videos, Suno music, Nano Banana characters, prior family-recorded character voice labels)
- The launch greeting in Ryan's voice

What is explicitly *not* anywhere outside Ryan's machine:
- Any recording of Ava
- Any photograph of Ava
- Any data about Ava's app usage (no analytics, no telemetry)
- Any account, login, or PII

Network traffic from the family devices, post-install:
- `expo-updates` cold-launch check: HTTPS GET to the Expo update server
- If update available: HTTPS GET for the new bundle + asset diffs
- Nothing else. The app makes no other network calls.

## Changes to the codebase

| Path | Change |
|---|---|
| `package.json` | Add `expo-updates` dep; add `publish-update` script |
| `app.json` | Add `updates` + `runtimeVersion` blocks |
| `eas.json` | Confirm `channel` field on each profile |
| `docs/distributing.md` | New: short runbook for shipping a new book and onboarding a tester |

No changes to runtime app code. No new components, no new providers, no new tests for runtime behavior. `expo-updates` does its work without touching the React tree.

## Testing strategy

This is configuration + ops work, not feature work. The verification is end-to-end:

1. **Local preview build** — run `eas build --profile preview --platform android --local` (or remote) and install the .apk on Ryan's Android. Confirm the app launches and the book mode works.
2. **First OTA cycle** — modify a tiny piece of the app (e.g., bump greeting text), run `npm run publish-update`, cold-launch the installed .apk twice. The second launch should show the change. If the change doesn't appear, OTA isn't wired right.
3. **iOS TestFlight roundtrip** — once OTA is verified on Android, build and submit iOS, send invite to a test email (or Ryan's secondary Apple ID), install, repeat the update test.
4. **First real family test** — invite Wife as the first external iOS tester. Have her install, then publish a new book and confirm it appears.
5. **Sister rollout** — only after the above passes.

No unit tests added. The only thing meaningful to test would be `runtimeVersion` fingerprinting, which is an EAS internal.

## Prerequisites

Before building the first preview binary:
1. **Task 24** of the library-and-readings work must pass — on-device smoke test of book mode and the book-tool.
2. **`feat/book-mode-v1` must be merged to `main`** — preview ships from a stable main.

Otherwise we'd be inviting Kristen to install an in-flight beta.

## Operational runbook (preview)

| When | What | Command |
|---|---|---|
| Adding a book | After saving in book-tool | `npm run publish-update -- --message "..."` |
| TestFlight expiring (~ every 85 days) | Rebuild + resubmit iOS | `eas build --platform ios --profile preview --auto-submit` |
| Bumping Expo SDK or adding native module | Rebuild both binaries; family re-installs | `eas build --platform all --profile preview --auto-submit`, then re-share Android link |
| Adding a new tester | Apple ID email → App Store Connect "Family" group | (manual, web UI) |

## Out of scope for v1.1+

- Silent push notifications (requires `expo-notifications` + APNs setup)
- Per-recipient channels (`kristen-preview` vs `parents-preview`) for staged rollout
- App Store production submission
- Crashlytics / analytics
- Self-hosted update server
