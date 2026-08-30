# Quiz App

A holiday-aware long arithmetic practice tool, built for a Year 6–7 pupil (age 11–12) at
Skipton Parish Church of England Primary School. It checks whether today falls in one of the
school's own holidays and sets a practice target accordingly, then keeps generating questions
until that many are answered correctly, adapting each operation's difficulty to how she's doing
along the way.

Live at: https://github.com/cmdelee/mathsquiz (GitHub Pages, once enabled)

## Features

- **Holiday-aware target**: 10 correct answers on a school holiday, 25 in term time, based on
  Skipton Parish School's actual published term dates (not a generic regional calendar).
- **Four question types**: long multiplication, long division, long subtraction and long
  addition, roughly evenly mixed. Division always divides exactly (no remainders, since that
  hasn't been covered yet). Subtraction can land on a negative answer; addition always stays
  positive.
- **Adaptive difficulty**: each of the four operation types has its own difficulty level that
  rises after a run of correct answers and drops straight back down after a wrong one, so it
  settles near whatever she finds challenging-but-doable, and gradually climbs over weeks as
  she improves.
- **Self-marking, continues until the target is reached**: not a fixed set of questions — it
  keeps going, including retrying the type she got wrong, until the correct-answer target is
  met.
- **Reports**: at the end of a session, the score can be copied to the clipboard or shared via
  the device's native share sheet — no email, no accounts, no data leaves the device at all.
- **Local history**: the main page shows the most recent session's score. Full history lives on
  a separate parents page.
- **Parents page**: a small "Parents" link in the footer, protected by a PIN. Getting in at all
  needs the PIN — not just resetting something — so a child can't see or touch it. It shows the
  full session history, the current difficulty level for each operation, and two reset buttons
  (clear history; reset difficulty back to the easiest level).
- **Installable as an app**: a Progressive Web App — "Add to Home Screen" on a phone or tablet
  gives it its own icon and offline support, no app store needed.
- **Numeric keypad on mobile**: answer fields bring up a compact number pad rather than the
  full keyboard, while still allowing a minus sign for negative answers.

## Files

All files sit together in the repo root — GitHub Pages serves them as-is, no build step.

| File | Purpose |
|---|---|
| `index.html` | The whole app — markup, styles and logic in one file. |
| `manifest.json` | PWA manifest, so it can be installed to a phone/tablet home screen. |
| `sw.js` | Service worker — caches the app shell for offline use once installed. |
| `icon-192.png`, `icon-512.png` | App icons (moss green, Σ mark). |
| `.gitignore` | Just ignores a stray local test file; nothing app-related. |

## How it works

### Holiday dates and the question target

Hardcoded in `index.html` — search for `HOLIDAYS`. Sourced from Skipton Parish CE Primary
School's own published term dates (https://www.parish.ycst.co.uk/parents/term-dates), currently
covering July 2026 through summer 2028. Each range is derived from the school's "first day of
term" / "last day of term" dates, which is more reliable than trusting every date label on their
page literally (a couple of small inconsistencies were found there when this was last checked).

INSET (staff training) days are deliberately **not** counted as holidays — even though there's
no school that day, it's still an ordinary school *week*, so it's treated as term time (target
of 25) rather than pulling the target down to 10. Bank holidays that fall in term time (e.g. the
early May bank holiday) are still counted as a holiday, since the whole school is shut, not just
staff.

Dates beyond the published dataset fall back to a rough estimate based on a typical school year,
clearly flagged in the UI as an estimate. **This will need updating** once the school publishes
the 2028/29 calendar — replace the `HOLIDAYS` array with the new dates from the school's term
dates page, following the same "derive from first/last day of term, exclude INSET days" approach.

### Question generation and difficulty

Questions are generated in-browser, no backend — see `pickType()` for the roughly-even mix
across the four operation types, and `genMultiplication()` / `genDivision()` / `genAddition()` /
`genSubtraction()` for the actual number ranges.

Difficulty is adaptive per operation type, level 1 (easiest) to 6 (hardest), stored in
`localStorage` under `quizAppDifficulty_v1`. Three correct answers of a type in a row raises
that type's level by one; a single wrong answer drops it straight back down; every new session
starts one level below wherever the previous session left off (a gentle warm-up). See the
"Adaptive difficulty" section in `index.html` for the level tables — what number ranges each
level uses for each operation.

### History and the parents page

Session history is saved to `localStorage` under `quizAppHistory_v1` — nothing is sent anywhere,
ever. The main practice page only ever shows the most recent session's date and score; the full
list lives on the parents page.

The parents page sits behind a fixed PIN (`1724`) — only its SHA-256 hash is in the source
(search for `EXPECTED_PIN_HASH`), not the PIN itself, though this is a lock against an idle tap
from a child, not real security, since anyone reading the public source could work it out. The
PIN is checked once, to open the page at all; the reset buttons inside it don't ask again.

### Installing on a phone or tablet

Once the site is live on GitHub Pages: open it in the browser, then use the browser's own
"Add to Home Screen" / "Install app" option (Chrome on Android shows this in the ⋮ menu, or as a
banner). It then behaves like a normal app icon, opens without browser chrome, and keeps working
offline once it's been opened at least once.

## Making changes

Edit `index.html` directly — it's the single source of truth (the CSS and JS are inline, not
built from anything else, so there's no build step to run). After editing, sanity-check it
locally by opening the file straight in a browser (`file://` works fine, aside from the service
worker, which needs a real HTTPS host to register).

To get changes onto GitHub: either edit the files directly in the GitHub web UI ("Edit" pencil
icon on each file), use "Add file → Upload files" to replace them after editing locally, or
commit and push from a local clone with Git/GitHub Desktop.

## Known limitations

- The holiday calendar is hand-maintained — it doesn't pull from any live source, and if the
  school changes its published dates after this was last checked, the app won't know until the
  `HOLIDAYS` array is updated by hand.
- History, the parent PIN check, and difficulty levels are all per-browser, per-device — using
  both Chrome and Samsung Internet on the same tablet, for instance, keeps two separate copies
  of everything, and reinstalling or clearing site data resets all of it.
- The parent PIN is a fixed value baked into the public source, not a real secret.
