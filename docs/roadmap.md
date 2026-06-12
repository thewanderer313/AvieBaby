# Roadmap — future ideas not yet scoped

Ideas worth exploring after current work ships. Each entry is a one-paragraph sketch, not a spec — when one becomes the next thing, brainstorm it properly first.

## Book authoring companion (web app, Supabase scratch space)

A small web app where family members (Ryan, Kristen, Kyle, others) sign in via Supabase Auth and collaboratively author a book: upload page images, record voice tracks per page, name pages. The in-progress book lives in Supabase Storage + Postgres so anyone with a browser can contribute from any device, no install needed. When the book is "done," someone clicks Export → downloads a zip → runs a script that drops it into the `aviebaby` repo and appends to `BookRegistry.ts`. App distribution still goes through TestFlight + Android sideload. **Keeps the app fully offline; just makes authoring easier and multi-contributor.** Build this when book #3 is on the way.

## Over-the-air book delivery (Supabase + EAS Update)

Builds on the companion above. The AvieBaby app itself fetches the book catalog from Supabase at launch; new books appear on Ava's phone within seconds of being published, no rebuild needed. Big upgrade in dynamism, but it breaks the current spec's "zero network calls" guarantee and means personalized family content lives in a cloud database. Worth doing only if same-day book delivery becomes a real need. Mind privacy carefully — Ava's images and family voices in a cloud bucket need explicit consent from everyone recording.

## Authoring-only desktop tool (Tauri or Electron)

Alternative to the web companion. A small desktop app installed on Ryan's PC and Kyle's Mac. Same UI flow (upload pages, record audio, export book), but writes directly into a local clone of the repo — no service costs, no internet. Only worth it if multi-contributor + browser access isn't important, since git clone friction is real for non-technical family.

## Other small future ideas

Park them here as one-liners.

- **Per-book theme tinting** — book pages on a theme-colored letterbox background instead of black, to feel less stark.
- **Animated character intros on first launch** — the spawned characters wave or wink the first time Ava taps them, then revert to normal.
- **Time-of-day audio variants** — Sleepy Ocean's music swaps to a quieter version after 7pm (for bedtime sessions).
- **Reading-progress nudge for adults** — adult panel shows "Ava heard Uncle Ryan read Brown Bear 47 times this week" as a delight metric. Would require on-device telemetry without leaving the device.
- **Multiple-kid profiles** — if a sibling arrives, separate launch greetings and registries. Big architectural change; not v1.
