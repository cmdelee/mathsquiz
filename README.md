# Quiz App

Two small practice tools for the same pupil, sharing one repo and one look.

- **`index.html`** — a holiday-aware long arithmetic practice tool, built for a Year 6–7 pupil
  (age 11–12) at Skipton Parish Church of England Primary School. It checks whether today falls
  in one of the school's own holidays and sets a practice target accordingly, then keeps
  generating questions until that many are answered correctly, adapting each operation's
  difficulty to how she's doing along the way.
- **`entry-test.html`** — practice questions in the style of Skipton Girls' High School's Year 7
  entry test (the Adventure and Beacon papers), for 11+ preparation. See its own section below.

Live at: https://github.com/cmdelee/mathsquiz (GitHub Pages, once enabled)

## Maths practice (`index.html`)

### Features

- **Holiday-aware target**: 10 correct answers on a school holiday, 25 in term time by default,
  based on Skipton Parish School's actual published term dates (not a generic regional calendar).
  Both numbers can be changed at any time from the parents page.
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
- **Child's name**: optional, set from the parents page. When set, it personalises the page
  title ("Poppy's maths practice") and the end-of-session message, and appears in copied/shared
  reports.
- **Parents page**: a small "Parents" link in the footer, protected by a PIN that the parent
  chooses themselves the first time they open it on a device (see below). Getting in at all
  needs the PIN — not just resetting something — so a child can't see or touch it. It holds the
  child's name, the session targets, the full session history, the current difficulty level for
  each operation, and the reset/change controls (clear history, reset difficulty to the easiest
  level, change the PIN).
- **Installable as an app**: a Progressive Web App — "Add to Home Screen" on a phone or tablet
  gives it its own icon and offline support, no app store needed.
- **Numeric keypad on mobile**: answer fields bring up a compact number pad rather than the
  full keyboard, while still allowing a minus sign for negative answers.

## Files

All files sit together in the repo root — GitHub Pages serves them as-is, no build step.

| File | Purpose |
|---|---|
| `index.html` | The maths practice app — markup, styles and logic in one file. |
| `entry-test.html` | The Skipton Girls' entry test practice page — same one-file approach. |
| `manifest.json` | PWA manifest for the maths app, so it can be installed to a phone/tablet home screen. |
| `sw.js` | Service worker for the maths app — caches its shell for offline use once installed. |
| `icon-192.png`, `icon-512.png` | App icons (moss green, Σ mark). |
| `.gitignore` | Just ignores a stray local test file; nothing app-related. |

## How the maths app works

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

The 10/25 targets themselves are just defaults — the parents page has a "Targets" section where
either number can be changed (1–200), stored in `localStorage` under `quizAppSettings_v1`. A
change applies immediately without resetting whatever's already been answered that session.

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

The parents page sits behind a PIN that the parent sets themselves — the first time "Parents" is
tapped on a device, there's no PIN yet, so it asks you to choose one (typed twice, to catch typos)
instead of showing any history or settings. Only the PIN's SHA-256 hash is stored, in
`localStorage` under `quizAppParentPinHash_v1`, never the PIN itself. From then on the same PIN
gets back in, and a "Change parent PIN" button inside the page lets you set a new one (it asks for
the current PIN first). The PIN is checked once, to open the page at all; the other buttons inside
it don't ask again.

The child's name, if set, is stored in `localStorage` under `quizAppChildName_v1`.

### Installing on a phone or tablet

Once the site is live on GitHub Pages: open it in the browser, then use the browser's own
"Add to Home Screen" / "Install app" option (Chrome on Android shows this in the ⋮ menu, or as a
banner). It then behaves like a normal app icon, opens without browser chrome, and keeps working
offline once it's been opened at least once.

## Entry test practice (`entry-test.html`)

A separate, standalone page practising the format of Skipton Girls' High School's Year 7 entry
test, which is run by an external provider called FSCE and used by several grammar schools
(Skipton Girls', Ermysted's, Reading School and others). Skipton Girls' sits two of FSCE's papers:

- **Adventure** — multiple choice (pick one of four options), covering English (a short reading
  passage with comprehension questions, plus vocabulary/synonym questions) and maths (reasoning
  and problem-solving word problems).
- **Beacon** — short written answers typed into a box, covering English (spelling in context) and
  maths (multi-step word problems: money, angles, time, decimals, reading a data table, cost
  comparisons, area).

The page has three practice modes — Adventure only, Beacon only, or Mixed (a longer session
blending both) — each drawing a fresh, shuffled set of questions from a bank of original
questions written for this page (see `ADVENTURE_ITEMS` and `BEACON_ITEMS` in `entry-test.html`).
**These are not the real FSCE questions** — those stay confidential to FSCE and are only ever
seen in the school's own familiarisation guide (linked from the page, and from Skipton Girls'
[admissions page](https://www.sghs.org.uk/our-school/admissions)) — this page just practises the
same two formats and the same style/difficulty of question, written from scratch.

Each session is self-marked with immediate feedback, and finishes with a score and a list of any
missed questions to go over. Short-answer checking is a little forgiving on formatting (e.g.
`1.70` and `£1.70` are both accepted, as are numerically-equal forms like `5` and `5.0`), but
spelling answers need to be spelled correctly. Session history (date, paper, score) is saved to
`localStorage` under `entryTestHistory_v1`, shown on the page itself — there's no parents page or
PIN here, since there's nothing to protect a child from (no adaptive settings to accidentally
reset).

The two pages link to each other from their footers.

## Making changes

Edit `index.html` or `entry-test.html` directly — each is a single, self-contained file (CSS and
JS inline, nothing built from anything else), so there's no build step to run. After editing,
sanity-check it locally by opening the file straight in a browser (`file://` works fine for
`entry-test.html`; `index.html`'s service worker needs a real HTTPS host to register, though the
rest of the page still works over `file://`).

To get changes onto GitHub: either edit the files directly in the GitHub web UI ("Edit" pencil
icon on each file), use "Add file → Upload files" to replace them after editing locally, or
commit and push from a local clone with Git/GitHub Desktop.

## Known limitations

- The holiday calendar is hand-maintained — it doesn't pull from any live source, and if the
  school changes its published dates after this was last checked, the app won't know until the
  `HOLIDAYS` array is updated by hand.
- History, the parent PIN, the child's name, targets and difficulty levels are all per-browser,
  per-device — using both Chrome and Samsung Internet on the same tablet, for instance, keeps two
  separate copies of everything, and reinstalling or clearing site data resets all of it.
- The parent PIN is a lock against an idle tap from a child, not real security against someone
  with access to the device — and there's no recovery option if it's forgotten short of clearing
  site data (which also clears the history, targets and child's name on that device, and prompts
  for a new PIN to be set next time).
- The entry test page's question bank is a fixed, hand-written set (10 Adventure English items, 10
  Adventure maths items, 10 Beacon English items, 10 Beacon maths items) — sessions shuffle and
  sample from it, but the questions themselves don't change or grow on their own. Adding more is a
  matter of appending further objects to `ADVENTURE_ITEMS` / `BEACON_ITEMS` in `entry-test.html`,
  following the existing shape.
