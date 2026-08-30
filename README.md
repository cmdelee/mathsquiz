# Quiz App

A holiday-aware long arithmetic practice tool for a Year 6–7 pupil (age 11–12) at Skipton
Parish Church of England Primary School. Checks whether today falls in one of the school's own
holidays and sets a practice target accordingly — 10 correct answers on a holiday, 25 in term
time — mixing long multiplication, long division, long subtraction and long addition until that
target is reached, with each operation's difficulty adapting to how she's doing.

Live at: https://github.com/cmdelee/mathsquiz (GitHub Pages, once enabled)

## Files

All files sit together in the repo root — GitHub Pages serves them as-is, no build step.

| File | Purpose |
|---|---|
| `index.html` | The whole app — markup, styles and logic in one file. |
| `manifest.json` | PWA manifest, so it can be installed to a phone/tablet home screen. |
| `sw.js` | Service worker — caches the app shell for offline use once installed. |
| `icon-192.png`, `icon-512.png` | App icons (moss green, Σ mark). |

## How it works

- **Holiday dates**: hardcoded in `index.html` (search for `HOLIDAYS`), sourced from Skipton
  Parish CE Primary School's own published term dates (https://www.parish.ycst.co.uk/parents/term-dates),
  currently covering July 2026 through summer 2028. Each range is derived from the school's
  "first day of term" / "last day of term" dates, with INSET (staff training) days folded in
  or listed separately. Dates beyond that fall back to a rough estimate, clearly flagged in the
  UI. **These will need updating** once the school publishes the 2028/29 calendar — replace the
  `HOLIDAYS` array with the new dates from the school's term dates page.
- **Questions**: generated in-browser, no backend, mixed roughly equally across the four
  operation types — see `pickType()`. Division always divides exactly (no remainders).
  Subtraction can land on a negative answer; addition always stays positive.
- **Adaptive difficulty**: each operation type has its own level (1–6), stored in
  `localStorage` (key `quizAppDifficulty_v1`) and adjusted as she answers — three correct in a
  row nudges it up, one wrong answer drops it straight back down, and each new session starts
  one level below wherever the last one settled. See the "Adaptive difficulty" section in
  `index.html` for the level tables per operation.
- **History**: saved to `localStorage` (key `quizAppHistory_v1`) — nothing is sent anywhere.
  The main page shows only the most recent session; full history lives on the parents page.
- **Parents page**: a "Parents" link in the footer, gated by a fixed PIN (`1724`, only its hash
  is in the source — search for `EXPECTED_PIN_HASH`). It shows the full session history, the
  current difficulty level per operation, and two reset buttons (history, and difficulty back
  to easiest). Getting into the page at all requires the PIN, so a child can't reach the resets.
- **No email, no accounts, no analytics** — by design. Sharing a finished report is done via
  the device's native share sheet or copy-to-clipboard, not a mailto link or any connector.

## Making changes

Edit `index.html` directly — it's the single source of truth (the CSS and JS are inline, not
built from anything else). After editing, sanity-check it locally by opening the file straight
in a browser (`file://` works fine, aside from the service worker, which needs a real HTTPS
host to register).

To update the files on GitHub: either edit them directly in the GitHub web UI ("Edit" pencil
icon on each file), or use "Add file → Upload files" to replace them after editing locally.

## Known limitations

- The holiday calendar is hand-maintained (see above) — it doesn't pull from any live source,
  and if the school changes its published dates after this was last checked, the app won't know.
- History, the parent PIN check, and difficulty levels are all per-browser, per-device — using
  both Chrome and Samsung Internet on the same tablet, for instance, keeps two separate copies
  of everything.
- The parent PIN is a fixed value baked into the public source, not a secret — it's a lock
  against an idle tap from a child, not real security.
