# OTA Updates and Family Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a preview build of AvieBaby to family (TestFlight on iOS, signed APK on Android) and wire EAS Update so new books propagate over the air.

**Architecture:** `expo-updates` runtime embedded in the binary checks Expo's CDN on cold launch. `eas update --channel preview` publishes a new JS bundle + asset diff after `node scripts/book-register.js` regenerates the registry. Single npm script wraps the publish loop.

**Tech Stack:** Expo SDK 56, `expo-updates`, EAS Build, EAS Update, TestFlight (Apple), Google Play not used (direct APK only).

**Spec:** `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md`

---

## Convention notes

- All commands assume the repo root: `C:\Users\Ryank\Desktop\Vibe Coding\AvieBaby`. Subagents stay there for git commands.
- Tasks marked **[MANUAL — Ryan]** require Ryan's interactive participation (CLI login flows, App Store Connect web UI, real device install). Subagents cannot complete them; the plan provides a runbook instead.
- Tasks marked **[AUTO]** are fully automatable.
- Build tasks are long-running. Ryan kicks them off and waits; the plan tells him what to verify.

---

## Phase plan

- **Phase 1** (Tasks 1–5): Code + config changes (AUTO)
- **Phase 2** (Tasks 6–7): EAS account link and update configure (MANUAL — Ryan, with detailed runbook)
- **Phase 3** (Tasks 8–10): First Android binary + OTA cycle verification (MANUAL — Ryan)
- **Phase 4** (Tasks 11–13): iOS TestFlight + first family tester (wife) (MANUAL — Ryan)
- **Phase 5** (Task 14): Rest-of-family rollout (MANUAL — Ryan)
- **Phase 6** (Task 15): Documentation refinement (AUTO, after Ryan reports findings)

---

## Phase 1 — Code and config

### Task 1: Install expo-updates [AUTO]

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-generated)

- [ ] **Step 1: Confirm clean tree**

Run: `git status`
Expected: clean, on `feat/book-mode-v1` (or whatever branch this work is being done on).

If anything is uncommitted, stop and report BLOCKED.

- [ ] **Step 2: Install expo-updates at the SDK 56-compatible version**

Run from repo root:
```bash
npx expo install expo-updates
```

`npx expo install` resolves the right version against the installed Expo SDK automatically. Do NOT use `npm install expo-updates` — it may install an incompatible version.

- [ ] **Step 3: Verify install**

Run: `npm ls expo-updates`
Expected: one entry, no `UNMET DEPENDENCY` lines.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
deps: add expo-updates for OTA distribution

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add updates + runtimeVersion config to app.json [AUTO]

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Read current `app.json`**

The file exists; you need to know its current structure to merge in the new fields without breaking other config (icons, splash, bundle id, etc.).

- [ ] **Step 2: Add `updates` and `runtimeVersion` blocks**

Inside the top-level `expo: { ... }` object, add (or merge):

```json
"updates": {
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0
},
"runtimeVersion": { "policy": "fingerprint" }
```

Do NOT add a `url` field yet — `eas-cli update:configure` writes that in Phase 2. If a `url` field already exists from prior experimentation, leave it; `update:configure` will overwrite it.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS.

Run: `cat app.json | jq .expo.updates`
Expected:
```json
{
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0
}
```

(If `jq` isn't installed, eyeball the file.)

- [ ] **Step 4: Commit**

```bash
git add app.json
git commit -m "$(cat <<'EOF'
feat(app): configure expo-updates for OTA on cold launch

ON_LOAD policy + fingerprint runtime version. The CDN url field is
filled in by eas update:configure after eas init in Phase 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Confirm eas.json profile channels [AUTO]

**Files:**
- Modify (possibly): `eas.json`

- [ ] **Step 1: Read current `eas.json`**

`eas.json` should already have `preview` and `production` profiles from earlier work.

- [ ] **Step 2: Confirm each profile has a `channel` field**

The `preview` profile must include `"channel": "preview"`. The `production` profile must include `"channel": "production"`. If either is missing, add it.

Final shape — the relevant fragments of each profile:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": { ... },
      "android": { ... }
    },
    "production": {
      "channel": "production",
      "ios": { ... },
      "android": { ... }
    }
  }
}
```

Leave existing `ios` and `android` sub-blocks intact — they were configured earlier.

- [ ] **Step 3: Verify**

Run: `cat eas.json | jq '.build.preview.channel, .build.production.channel'`
Expected:
```
"preview"
"production"
```

- [ ] **Step 4: Commit (only if changes were needed)**

```bash
git add eas.json
git commit -m "$(cat <<'EOF'
feat(eas): confirm channel field on preview and production profiles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no changes were needed, skip the commit and report DONE with that note.

---

### Task 4: Add `publish-update` npm script [AUTO]

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add script to the `scripts` section**

Add:
```json
"publish-update": "node scripts/book-register.js && eas update --channel preview"
```

- [ ] **Step 2: Verify**

Run: `cat package.json | jq '.scripts."publish-update"'`
Expected: `"node scripts/book-register.js && eas update --channel preview"`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
feat(scripts): add publish-update for one-command OTA publishing

Usage: npm run publish-update -- --message "Added Goodnight Moon"

Regenerates the book registry, then ships the new JS bundle + asset
diff to the preview EAS Update channel. Family devices fetch it on
the next cold launch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Write `docs/distributing.md` [AUTO]

**Files:**
- Create: `docs/distributing.md`

- [ ] **Step 1: Write the runbook**

Create `docs/distributing.md` with this exact content:

```markdown
# Distributing AvieBaby to family

This is the operational runbook for shipping AvieBaby to family members and pushing new books to them over the air. The architecture and rationale are in `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md`.

## One-time per machine: install the EAS CLI

You need this on whichever machine is running builds and pushing OTA updates.

```bash
npm install --global eas-cli
```

Or use it on the fly with `npx eas-cli ...`. Either works.

## One-time per project: link to EAS

You only do this once for the repo.

```bash
npx eas-cli login           # Ryan's Expo account credentials
npx eas-cli init            # writes the project id into app.json
npx eas-cli update:configure   # writes the updates.url into app.json
```

Commit the changes to `app.json` after.

## One-time per family member: install the preview build

### iOS (TestFlight)

1. Build + auto-submit:
   ```bash
   eas build --platform ios --profile preview --auto-submit
   ```
2. Wait for Apple to process (~10 minutes). Watch `https://expo.dev/accounts/<you>/projects/aviebaby/builds`.
3. Open https://appstoreconnect.apple.com → AvieBaby → TestFlight → External Testing.
4. If "Family" group doesn't exist: create it.
5. Add the tester's Apple ID email to the group.
6. Apple does a one-time Beta App Review for the first build (~24h). Subsequent builds in the same major version skip this.
7. Tester gets an email, installs the **TestFlight** app from the App Store, taps the invite link, AvieBaby installs.

### Android (direct APK)

1. Build:
   ```bash
   eas build --platform android --profile preview
   ```
2. When done, EAS gives you a download URL.
3. Share the URL with the tester.
4. Tester taps the URL on their phone, Android prompts "Allow install from this source" — they accept once.
5. APK installs.

## Adding a book (the daily workflow)

You, your wife, or your parents finish recording a book in the book-tool. From any machine that has the repo:

```bash
node scripts/book-register.js
eas update --channel preview --message "Added Goodnight Moon (Mom)"
```

Or wrapped:

```bash
npm run publish-update -- --message "Added Goodnight Moon (Mom)"
```

That ships the new JS bundle + asset diff to Expo's CDN under the `preview` channel. Family devices fetch on next cold launch.

Two cold launches needed on the recipient's phone:
1. First cold launch — `expo-updates` detects the new bundle and downloads it.
2. Second cold launch — new bundle applies; new books appear.

A toddler-driven device usually hits both within hours.

## TestFlight 90-day expiry

TestFlight builds disappear from testers' devices after 90 days. Set a calendar reminder every ~85 days:

```bash
eas build --platform ios --profile preview --auto-submit
```

Cached OTA books survive the refresh. Testers don't lose any state.

## When you need a new binary build (not just OTA)

OTA covers: new books, new JS code, new bundled assets, theme changes.

You need a fresh binary build (and family must re-install) when:
- Bumping Expo SDK to a new major version
- Adding a new Expo module (e.g., expo-notifications)
- Changing app permissions or app.json's native sections (bundle id, icon paths, splash, etc.)
- Adding or removing native code

For any of those:

```bash
eas build --platform all --profile preview --auto-submit
```

Then share the new Android APK link. iOS testers get the new build automatically through TestFlight.

## Tester onboarding checklist

For each new family member:

| Platform | Step |
|---|---|
| iOS | Add Apple ID email to "Family" group in App Store Connect |
| iOS | Confirm tester received invite email (sometimes lands in spam) |
| iOS | Tester installs TestFlight from App Store, taps invite link, installs AvieBaby |
| Android | Share the latest EAS APK download URL |
| Android | Tester taps URL, accepts "install from unknown source" prompt, installs |

For both: walk them through opening the app at least twice (greeting, magic button, adult panel) to confirm install and verify expo-updates check has happened.

## Troubleshooting

**OTA update didn't appear after two cold launches.**

Likely causes:
- The phone never opened the app between publish and the test — `expo-updates` only checks on cold launch. Confirm the app was opened.
- Runtime version mismatch — the fingerprint changed between binary and update. Check `eas update --channel preview --json` to see what runtime version your latest update targets. If it differs from the installed binary's, rebuild the binary.
- Phone has no internet during the cold launch.

**`eas build` fails with provisioning profile errors (iOS).**

Run `eas credentials` to inspect / repair iOS credentials. Usually fixed by `eas credentials --platform ios --profile preview` and accepting EAS-managed credentials.

**Apple flags the binary in Beta App Review.**

Usually a description / privacy policy issue, not the app itself. Update the TestFlight metadata in App Store Connect with a description of "private family beta — no public distribution." This app has no data collection, so privacy posture is trivial to defend.

**Android tester's phone refuses to install the APK.**

Check the URL hasn't expired (EAS download URLs have a TTL — re-share if so). Confirm Android version is >= what `eas.json` declares as `minSdkVersion`.
```

- [ ] **Step 2: Verify the file is committed correctly**

Run: `wc -l docs/distributing.md`
Expected: ~120 lines.

- [ ] **Step 3: Commit**

```bash
git add docs/distributing.md
git commit -m "$(cat <<'EOF'
docs: distributing.md runbook for OTA + family onboarding

Covers eas init, TestFlight onboarding flow, Android APK sharing,
daily publish-update workflow, TestFlight 90-day refresh, when a
fresh binary build is required vs OTA-only, and troubleshooting
for the common failures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — EAS account link

These tasks require an interactive terminal session — `eas-cli login` opens a browser flow, and `eas-cli init` may prompt for project choice.

### Task 6: `eas-cli login` and `eas-cli init` [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Install eas-cli globally (skip if already installed)**

```bash
npm install --global eas-cli
```

Or use `npx eas-cli` for everything below.

- [ ] **Step 2: Login**

```bash
npx eas-cli login
```

This opens a browser to expo.dev. Sign in with your Expo account credentials. After auth, the CLI confirms login in the terminal.

- [ ] **Step 3: Initialize the project**

```bash
npx eas-cli init
```

The CLI walks you through:
1. Confirm or pick an Expo account (your personal account).
2. Asks whether to create a new project or link to an existing one — pick **create new**, name it `aviebaby`.
3. Writes the EAS project id into `app.json` (under `expo.extra.eas.projectId` or similar).

- [ ] **Step 4: Commit the app.json change**

```bash
git status        # should show app.json modified
git diff app.json # confirm only EAS project id was added
git add app.json
git commit -m "$(cat <<'EOF'
chore(eas): link repo to EAS project via eas init

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Verify**

```bash
npx eas-cli whoami
```
Expected: prints your Expo username, confirms login.

```bash
npx eas-cli project:info
```
Expected: prints project details including the id that's now in app.json.

---

### Task 7: `eas-cli update:configure` [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Run configure**

```bash
npx eas-cli update:configure
```

The CLI writes the `updates.url` field into `app.json` (pointing at Expo's CDN endpoint for your project). It may also write platform-specific update channel config. The exact fields depend on the EAS CLI version.

- [ ] **Step 2: Verify app.json was updated**

```bash
git diff app.json
```
Expected: an `updates.url` field appears under `expo.updates`. Possibly some `android.intentFilters` or iOS settings.

If no diff appears, the CLI may have already been run earlier — that's fine.

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "$(cat <<'EOF'
chore(eas): configure expo-updates URL via eas update:configure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Final verification**

```bash
npm run typecheck
npm test
```
Both must pass — config changes shouldn't have touched any runtime code.

---

## Phase 3 — First Android binary + OTA cycle verification

These tasks run real builds against EAS's cloud. Each `eas build` takes ~20-40 minutes; you'll wait through them.

### Task 8: First Android preview build [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Kick off the build**

From the repo root:
```bash
eas build --platform android --profile preview
```

The CLI uploads your source to EAS, runs the build in the cloud, signs the APK with EAS-managed credentials (or asks you to upload your own — accept EAS-managed for the first build).

- [ ] **Step 2: Wait for build completion**

Visit the URL the CLI prints (or `https://expo.dev/accounts/<you>/projects/aviebaby/builds`).

Expected: ~20-40 minutes. Status goes through `queued` → `in queue` → `in progress` → `finished`.

If it fails, read the build log. Common first-build failures:
- Missing icons or splash image paths — check `app.json`.
- Native build errors from a misconfigured Expo module — check the dependency tree.

- [ ] **Step 3: Download the APK to your phone**

EAS gives you a download URL on the finished build page. Open it in your Android phone's browser, or send it to yourself via email and tap.

- [ ] **Step 4: Install**

Tap the downloaded APK. Android may prompt "Install from unknown source" — accept (one time per source).

- [ ] **Step 5: Verify install**

Open the app. You should see the play surface, the greeting, and be able to long-press top-left to open the adult panel. If anything is broken, fix it before going further.

- [ ] **Step 6: Note the build's runtime version**

On the EAS build page, note the `runtimeVersion` field. You'll need it to confirm OTA updates target the same fingerprint.

---

### Task 9: First OTA test publish [MANUAL — Ryan]

**Runbook:**

This task verifies that OTA wiring works by pushing a trivial change and watching it land on the installed APK.

- [ ] **Step 1: Make a small visible change**

Edit `src/components/Greeting.tsx` and change the subtitle text from `"Made just for you"` to `"Made just for you ♥"` (or any visible tweak). Save.

- [ ] **Step 2: Publish the update**

```bash
npm run publish-update -- --message "OTA smoke test: greeting subtitle"
```

The CLI uploads the JS bundle + asset diff to Expo's CDN under channel `preview`.

- [ ] **Step 3: Verify the publish**

```bash
npx eas-cli update:list --channel preview --limit 3
```

Expected: your update at the top with the message you provided.

- [ ] **Step 4: Cold-launch on the phone — first time**

Fully close AvieBaby on the Android phone (swipe out of recents, force-stop in settings if needed). Re-open it.

What should happen:
- The app launches with the OLD greeting (the change isn't visible yet).
- In the background, `expo-updates` checks the CDN, sees a newer bundle, downloads it.

You can confirm the check happened by waiting ~5-10 seconds after launch, then proceeding.

- [ ] **Step 5: Cold-launch on the phone — second time**

Force-close again. Re-open.

Expected: the NEW greeting subtitle shows (with the heart). If yes, OTA is working end-to-end.

If no, troubleshoot using `docs/distributing.md`'s troubleshooting section. Common issue: runtime version mismatch — confirm `eas update:list` shows the same runtime version as the installed binary.

- [ ] **Step 6: Revert the test change**

```bash
git checkout src/components/Greeting.tsx
```

Then publish a new update so the OTA channel doesn't keep the test wording:

```bash
npm run publish-update -- --message "Revert OTA smoke test"
```

After two more cold launches, the phone reverts to the original subtitle.

- [ ] **Step 7: Report DONE if both cold-launch cycles worked**

---

### Task 10: Document any OTA gotchas observed [AUTO, after Ryan reports]

After Ryan completes Task 9, he reports any oddities (timing, errors, UX gaps in `eas update:list`, etc.).

- [ ] **Step 1: If Ryan reported issues, dispatch a subagent to update `docs/distributing.md`'s Troubleshooting section with what was learned.**

If no issues, skip this task.

- [ ] **Step 2: Commit any doc updates**

```bash
git add docs/distributing.md
git commit -m "$(cat <<'EOF'
docs(distributing): add observed gotchas from first OTA cycle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — iOS TestFlight

### Task 11: First iOS preview build + auto-submit [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Confirm Apple Developer Program enrollment**

Open https://developer.apple.com and confirm your account is in good standing. Your Apple Developer membership is required.

- [ ] **Step 2: Kick off the build with auto-submit**

```bash
eas build --platform ios --profile preview --auto-submit
```

First run may prompt:
- Apple ID + password (or app-specific password)
- 2FA code
- Whether EAS should manage iOS credentials — accept EAS-managed.

The CLI builds the .ipa, signs it, and uploads to App Store Connect.

- [ ] **Step 3: Wait for build + Apple processing**

EAS build: ~30-45 minutes for the first iOS build.
Apple processing after upload: ~10-15 minutes.

Watch the EAS build page and then App Store Connect (https://appstoreconnect.apple.com → AvieBaby → TestFlight).

- [ ] **Step 4: First Beta App Review**

When the build appears in App Store Connect under "External Testing" but says "Review Required":

1. Navigate to AvieBaby → TestFlight → Test Information.
2. Fill in:
   - Beta App Description: "Private family beta of AvieBaby, a toddler-safe play app. No data collection."
   - Feedback Email: your email.
   - Privacy Policy URL: leave blank if you don't have one (Apple may flag this — if so, post a one-liner gist on github describing data practices and link it).
3. Submit for Beta App Review.
4. Wait ~24 hours. Apple may reject with feedback; address and resubmit.

This is one-time. Subsequent builds skip this.

- [ ] **Step 5: Report DONE once the build is "Ready to Test"**

---

### Task 12: Create "Family" external tester group [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Open App Store Connect**

Visit https://appstoreconnect.apple.com → AvieBaby → TestFlight → External Testing.

- [ ] **Step 2: Create the group**

Click "+" next to "External Testing", name the group **Family**, add the current build to it.

- [ ] **Step 3: Add yourself first**

Add your own Apple ID to the group as a test of the email pipeline. You should receive a TestFlight invite within minutes.

- [ ] **Step 4: Install on your iPhone (skip if you only have Android)**

If you have access to an iPhone (yours, or borrow), install TestFlight from the App Store, accept your own invite, install AvieBaby.

If you only have Android, skip this step. Wife's install in Task 13 verifies the iOS path.

---

### Task 13: First family tester (Wife) [MANUAL — Ryan]

**Runbook:**

- [ ] **Step 1: Add Wife's Apple ID**

App Store Connect → TestFlight → External Testing → Family group → Testers → "+ Add Tester" → enter her Apple ID email.

- [ ] **Step 2: She installs**

Walk her through (over text / phone):
1. Check email for the TestFlight invite from Apple.
2. Install the **TestFlight** app from the App Store.
3. Open the invite email on her phone, tap "View in TestFlight."
4. TestFlight opens, shows AvieBaby, tap "Install."
5. Tap "Open" to launch.

- [ ] **Step 3: Verify she can use the app**

Have her:
1. Confirm the greeting plays and play mode works.
2. Long-press top-left → adult panel opens.
3. Open a book if any exist; if not, just verify the picker shows the empty state.

If anything's broken, debug before inviting more family.

- [ ] **Step 4: Verify OTA on her phone**

1. From your machine: `npm run publish-update -- --message "Hi mom from OTA"`.
2. Have her cold-launch the app twice (close from recents, reopen).
3. Verify she sees any change you made (could be a temporary visible marker — clean it up after).

If OTA works on her phone, the family rollout is unblocked.

- [ ] **Step 5: Report DONE**

---

## Phase 5 — Rest-of-family rollout

### Task 14: Roll out to parents and Kristen [MANUAL — Ryan]

**Runbook:**

For each remaining family member (Mom, Dad, Kristen):

- [ ] **Step 1: Add their Apple ID (iOS testers)**

App Store Connect → TestFlight → External Testing → Family group → "+ Add Tester" → enter Apple ID email.

- [ ] **Step 2: Walk them through install**

Same as Task 13 Step 2, ideally with a screenshot guide attached. Reuse the steps in `docs/distributing.md`.

- [ ] **Step 3: Confirm install via a small visible OTA push**

After they've installed, publish a quick OTA update (e.g., adding the very first book if any are ready). They should see it on next-cold-launch.

- [ ] **Step 4: Report DONE per tester**

Track in a simple checklist:

```
- [x] Wife — installed, OTA verified
- [ ] Mom — invited, awaiting install
- [ ] Dad — invited, awaiting install
- [ ] Kristen — pending
```

When all four are installed and confirmed: family rollout complete.

---

## Phase 6 — Documentation refinement

### Task 15: Update README and docs/distributing.md with lessons learned [AUTO, after Phase 5]

**Files:**
- Modify: `docs/distributing.md`
- Modify: `README.md` (specifically the OTA + distribution sections — change status from "Designed" to "Live")

- [ ] **Step 1: Refine the runbook based on the actual experience**

After Ryan has actually shipped to family, ask him for:
- Which steps were confusing or missed something
- Any platform-specific quirks (e.g., a particular Android version that refused the APK)
- Apple's actual Beta App Review turnaround (often faster than 24h)

Update `docs/distributing.md` with these observations.

- [ ] **Step 2: Flip status indicators in README**

In `README.md`, the OTA section says "Designed in `docs/superpowers/specs/...`. Implementation pending." After Phase 5, change to:
"Live. New books ship via `npm run publish-update` and reach family devices on the next cold launch."

Same for the Distribution section.

- [ ] **Step 3: Commit**

```bash
git add docs/distributing.md README.md
git commit -m "$(cat <<'EOF'
docs: OTA + distribution lived through one family rollout

Marks the README sections as live (no longer "Designed, pending")
and folds the actual rollout learnings into distributing.md's
runbook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

This plan was self-reviewed against the spec on 2026-06-13. Findings:

- **Spec coverage:** Every section of the spec maps to a task or runbook step. Architecture (Task 1-5 install + config). Build profiles (Task 3). iOS TestFlight pipeline (Task 11-13). Android APK pipeline (Task 8). OTA configuration (Task 2 + Task 7). Publish workflow (Task 4 + Task 9). 90-day maintenance (docs/distributing.md). Privacy posture is statement-of-intent, not implementation, so it lives only in the spec.

- **No placeholders:** Every command is exact. Every config snippet is verbatim. Manual tasks have step-by-step UI navigation written out. No "TBD" or "configure as appropriate" hand-waves.

- **Type/method consistency:** Names used consistently — `preview` channel everywhere, `npm run publish-update` everywhere, `--platform ios --profile preview` consistently shaped.

- **Long-running tasks called out:** Tasks 8 and 11 take 20-45 minutes; Apple Beta App Review takes ~24h; these are flagged in the runbook so Ryan doesn't expect them to complete in one sitting.

- **Manual vs AUTO labels:** Phase 1 tasks are AUTO; Phase 2-5 are MANUAL with Ryan running. Subagents can't `eas-cli login` (interactive browser flow) or click in App Store Connect's web UI. The plan respects this.
