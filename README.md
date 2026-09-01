# Quiz App

Three practice tools for the same pupil, sharing one repo, one look and one hub page.

- **`index.html`** — the hub/menu. Opens first, offers five options, and links to everything
  else. Nothing to answer here.
- **`maths-quiz.html`** — a holiday-aware long arithmetic practice tool, built for a Year 6–7
  pupil (age 11–12) at Skipton Parish Church of England Primary School. It checks whether today
  falls in one of the school's own holidays and sets a practice target accordingly, then keeps
  generating questions until that many are answered correctly, adapting each operation's
  difficulty to how she's doing along the way.
- **`entry-test.html`** — practice questions in the style of the FSCE-run Year 7 entry test used
  by several grammar and independent schools (the Adventure and Beacon papers), for 11+
  preparation. See its own section below.
- **`mythology.html`** — a standalone "Trivia" page, just for fun and not linked to the 11+
  practice: long-answer questions across three subjects (Greek Mythology, Harry Potter, Stranger
  Things), marked by AI rather than matched against a fixed list of accepted answers. See its own
  section below.
- **`stats.html`** — the read-only Progress page: scores, streaks and history for all three
  practice apps. Behind the parent PIN by default, but a parent can turn that off so the child can
  check her own progress without asking.
- **`admin.html`** — the PIN-locked settings and reset controls for all three practice apps (and
  for the Progress page's own visibility, and the AI marking key Trivia needs).

Live at: https://github.com/cmdelee/mathsquiz (GitHub Pages, once enabled)

## The hub (`index.html`)

The page a browser or home-screen icon opens to. It shows the child's name in the title if one's
been set, a one-line teaser of the last session for each practice app (once there's history to
show), and five cards: **Maths quiz** (`maths-quiz.html`), **Practice exam** (`entry-test.html`),
**Trivia** (`mythology.html`), **Progress** (`stats.html`) and **Parents/Admin** (`admin.html`).
Nothing here reads or writes any answers — it's just a menu.

## Maths practice (`maths-quiz.html`)

### Features

- **Holiday-aware target**: 10 correct answers on a school holiday, 25 in term time by default,
  based on Skipton Parish School's actual published term dates (not a generic regional calendar).
  Both numbers can be changed at any time from the admin page.
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
- **Streak tracking**: a small badge shows how many days or weeks in a row she's kept up her
  practice, and the end-of-session message gets a bit more of a celebration once a streak reaches
  two or more. How often, and how many sessions in that time, count towards the streak is an
  admin-page setting (default: 1 session a week) — other families using this app may want a
  different rhythm, so it isn't fixed in the code. The current streak and the best one on record
  are shown on the Progress page.
- **Local history**: the page itself shows only the most recent session's score. Full history,
  lifetime stats and a chart of recent scores live on the Progress page; targets, streak settings
  and resets live on the admin page.
- **Child's name**: optional, set from the admin page. When set, it personalises the page
  title ("Poppy's maths practice") and the end-of-session message, and appears in copied/shared
  reports.
- **Installable as an app**: a Progressive Web App — "Add to Home Screen" on a phone or tablet
  gives it its own icon and offline support, no app store needed.
- **Numeric keypad on mobile**: answer fields bring up a compact number pad rather than the
  full keyboard, while still allowing a minus sign for negative answers.

## Progress (`stats.html`)

A read-only page showing scores, streaks and history for the maths and entry-test practice apps —
nothing on it can be changed or reset. By default it's behind the same parent PIN as the admin
page, but a parent can turn that off from the admin page so the child can check her own progress
without asking each time. Both practice apps link to it as "My progress". (Trivia keeps its own,
separate progress summary on `mythology.html` itself — see below — rather than appearing here.)

- **Maths practice**: lifetime totals (sessions and questions answered since the start), the
  streak goal alongside the current streak and the best one on record, the current difficulty
  level for each operation alongside its recent accuracy (right/wrong over the last 10 attempts
  of that type), full session history and a chart of recent scores.
- **Entry test practice**: full session history and a chart of recent scores, how many of the 999
  questions have been seen at least once, accuracy broken down by subject (English/maths) and by
  paper format (Adventure/Beacon), a list of whichever questions are currently flagged as
  recently missed, and a countdown to the exam date if a parent's set one.

## Parents / Admin (`admin.html`)

A single page behind one shared PIN, covering settings and resets for all three practice apps. The
parent chooses the PIN themselves the first time the page is opened on a device (see below).
Getting in at all needs the PIN — not just changing something — so a child can't see or touch it.
It's split into six sections:

- **Maths practice**: child's name, session targets (term/holiday), streak settings (how often and
  how many sessions keep the streak going), and buttons to reset difficulty to the easiest level
  or clear the maths history.
- **Entry test practice**: an optional exam date (shown as a countdown on the Progress page), the
  time limit and question count for the timed "Mock exam" mode, and buttons to clear the history
  or to clear the page's memory of missed questions (used to weight future sessions — see below).
- **AI marking**: the provider and API key Trivia's long-answer questions need to be marked (see
  below) — currently only Claude (Anthropic) is offered, saved, tested and cleared here — plus a
  button to clear Trivia's own history and progress across all three of its subjects.
- **Progress page access**: a single toggle — "Let her open the Progress page without entering
  the PIN". Off by default, so the Progress page needs the PIN too, same as this one.
- **Backup and reset**: download everything above (plus the stats shown on the Progress page) as
  one JSON file, restore from a previously downloaded file (replacing whatever's currently on the
  device), or wipe everything for all three apps back to a completely fresh start.
- **Parent PIN**: a "Change parent PIN" button (asks for the current PIN first, then the new one
  twice).

## Files

All files sit together in the repo root — GitHub Pages serves them as-is, no build step. Each
HTML file is a complete, self-contained document (styles and script inline) — nothing is built
or assembled from fragments.

| File | Purpose |
|---|---|
| `index.html` | The hub/menu page — links to the five pages below. |
| `maths-quiz.html` | The maths practice app — markup, styles and logic in one file. |
| `entry-test.html` | The 11+ entry test practice page — same one-file approach. |
| `mythology.html` | The Trivia page — three AI-marked subjects (Greek Mythology, Harry Potter, Stranger Things), same one-file approach. Kept this filename even though it now covers more than mythology, to avoid breaking any existing bookmark or home-screen install. |
| `stats.html` | The read-only Progress page — history and stats for the maths and entry-test apps, PIN-locked unless a parent's turned that off. |
| `admin.html` | The PIN-locked settings/reset page for all three apps, plus the shared AI marking key. |
| `manifest.json` | PWA manifest for the whole hub, so it can be installed to a phone/tablet home screen. |
| `sw.js` | Service worker — caches the app shell (all six pages) for offline use once installed. |
| `icon-192.png`, `icon-512.png` | App icons (moss green, Σ mark). |
| `.gitignore` | Just ignores a stray local test file; nothing app-related. |

## How the maths app works

### Holiday dates and the question target

Hardcoded in `maths-quiz.html` — search for `HOLIDAYS`. Sourced from Skipton Parish CE Primary
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

The 10/25 targets themselves are just defaults — the admin page has a "Targets" section where
either number can be changed (1–200), stored in `localStorage` under `quizAppSettings_v1`. A
change applies immediately without resetting whatever's already been answered that session.

### Question generation and difficulty

Questions are generated in-browser, no backend — see `pickType()` in `maths-quiz.html` for the
roughly-even mix across the four operation types, and `genMultiplication()` / `genDivision()` /
`genAddition()` / `genSubtraction()` for the actual number ranges.

Difficulty is adaptive per operation type, level 1 (easiest) to 6 (hardest), stored in
`localStorage` under `quizAppDifficulty_v1`. Three correct answers of a type in a row raises
that type's level by one; a single wrong answer drops it straight back down; every new session
starts one level below wherever the previous session left off (a gentle warm-up). See the
"Adaptive difficulty" section in `maths-quiz.html` for the level tables — what number ranges
each level uses for each operation.

### History and the Progress page

Session history is saved to `localStorage` under `quizAppHistory_v1` — nothing is sent anywhere,
ever. `maths-quiz.html` only ever shows the most recent session's date and score; the full list,
plus a simple chart of recent scores, lives on `stats.html`.

The streak shown on the maths page isn't stored separately — it's worked out fresh each time from
that same history list plus a period/threshold setting saved under `quizAppStreakSettings_v1`
(default: 1 session a week, changed from `admin.html`), so it can never drift out of step with
the history. Whatever period is currently in progress never breaks a streak on its own — it just
doesn't count towards it until it's met — so a streak only actually ends once a full period has
passed with too few sessions in it. The Progress page also works out the longest streak anywhere
in the history, not just the current one, the same way.

Two more things are tracked alongside the session history, both purely additive so nothing needs
migrating: a short rolling window (last 10) of right/wrong per operation type, under
`quizAppTypeStats_v1`, shown next to each operation's difficulty level; and running lifetime
totals (sessions completed, questions answered, questions correct) under
`quizAppLifetimeStats_v1`, which — unlike the session history — are never trimmed, since the
history list itself is capped at 200 entries and would otherwise under-count a lifetime total
once there's enough history to start dropping the oldest sessions.

`admin.html` sits behind a PIN that the parent sets themselves — the first time it's opened on
a device, there's no PIN yet, so it asks you to choose one (typed twice, to catch typos) instead
of showing any settings. Only the PIN's SHA-256 hash is stored, in `localStorage` under
`quizAppParentPinHash_v1`, never the PIN itself. From then on the same PIN gets back in, and a
"Change parent PIN" button on the page lets you set a new one (it asks for the current PIN
first). The same PIN covers `stats.html` too, unless a parent's turned that off for it (see
below) — and all three apps' history and settings, since there's only one PIN and one admin page
for the whole site.

`stats.html` uses the same PIN as `admin.html`, but never creates or changes it — if no PIN's
been set up yet, it just asks that a parent visit the admin page first, rather than offering to
set one itself. Whether it needs the PIN at all is controlled from `admin.html`'s "Progress page
access" toggle, stored under `quizAppStatsVisibleToChild_v1` ("1" or "0"); when it's on, the page
skips the lock screen entirely and opens straight into the stats view.

The child's name, if set, is stored in `localStorage` under `quizAppChildName_v1`, and is read by
both `maths-quiz.html` and `index.html` (to personalise the hub's title).

### Installing on a phone or tablet

Once the site is live on GitHub Pages: open it in the browser, then use the browser's own
"Add to Home Screen" / "Install app" option (Chrome on Android shows this in the ⋮ menu, or as a
banner). It then behaves like a normal app icon, opens without browser chrome, and keeps working
offline once it's been opened at least once. If the app was already installed before this
restructure, it may need a full close-and-reopen to pick up the new hub-and-menu navigation (the
service worker's cache version was bumped specifically to force that refresh) — otherwise it
should self-heal on its own the next time it's opened with a connection.

## Entry test practice (`entry-test.html`)

A separate, standalone page practising the format of the Year 7 entry test run by an external
provider called FSCE and used by several grammar and independent schools. It has two papers:

- **Adventure** — multiple choice (pick one of four options), covering English (short reading
  passages with comprehension questions, plus vocabulary/synonym questions) and maths (reasoning
  and problem-solving word problems).
- **Beacon** — short written answers typed into a box, covering English (spelling, matching the
  real FSCE paper's format: the word is shown with some letters already filled in, like `COM____`
  for "compass", and the child only has to type the missing letters) and maths (multi-step word
  problems: money, angles, time, decimals, reading a data table, cost comparisons, area).

The page has four practice modes — Adventure only, Beacon only, Mixed (a longer session blending
both), or Mock exam (a timed session, also blending both, that ends automatically when the clock
runs out) — each drawing a fresh set of questions from a bank of original questions written for
this page (see `ADVENTURE_ITEMS` and `BEACON_ITEMS` in `entry-test.html`). The bank currently
holds 999 items: 560 in `ADVENTURE_ITEMS` (30 reading passages with 4 comprehension questions
each, 200 vocabulary questions, 240 maths reasoning questions) and 439 in `BEACON_ITEMS` (199
spelling-scaffold questions, 240 maths word problems) — roughly ten times the original size, so a
session very rarely repeats the same question across many sittings. **These are not the real
FSCE questions** — those stay confidential to FSCE and are only ever seen in the relevant school's
own familiarisation guide — this page just practises the same two formats and the same
style/difficulty of question, written from scratch.

Sessions aren't a plain random shuffle: each question the page has seen before is remembered as
last answered right or wrong (a stable id hashed from its text, in `localStorage` under
`entryTestItemStats_v1` — no changes needed to the item bank itself), and a weighted draw favours
recently-missed questions over ones never seen, and both over ones already answered correctly.
Nothing is ever guaranteed or excluded, so sessions still feel fresh, but practice leans towards
whatever needs it. The same memory (each entry now also carries the question's text, subject and
paper format) is what lets the Progress page show a readable list of whatever's currently being
missed, rather than just a "clear it" button; that button is still there too, on the admin page. A
separate running tally, under `entryTestSubjectStats_v1`, tracks overall accuracy by subject
(English/maths) and by paper format (Adventure/Beacon) for the Progress page, and
`entryTestBankSize_v1` is written on every load so that page can also show how many of the
(currently 999) questions have been seen at least once, without needing a copy of the item bank
itself.

The Mock exam mode is a longer session with a visible countdown timer, both configurable on the
admin page — by default 20 minutes and 20 questions, but either can be changed independently
(minutes 5–90, questions 5–60), e.g. 20 minutes for 15 questions. If time runs out mid-session, it
finishes automatically with whatever's been answered so far, the same way a real exam would. The
admin page also has an optional exam date setting (`entryTestExamDateSettings_v1`), shown on the
Progress page as a "days/weeks to go" countdown to help judge when to lean more of her practice
towards it.

Each session is self-marked with immediate feedback, and finishes with a score and a list of any
missed questions to go over. Short-answer checking is a little forgiving on formatting (e.g.
`1.70` and `£1.70` are both accepted, as are numerically-equal forms like `5` and `5.0`), but the
missing letters in a spelling question need to be spelled correctly (case and spacing don't
matter). The page itself shows only the most recent session's date, paper and score; full
history and a recent-scores chart (like the maths app) live on `stats.html`, saved to
`localStorage` under `entryTestHistory_v1`.

All six pages link to each other from their footers.

## Trivia (`mythology.html`)

A standalone page, just for fun and not linked to the 11+ entry test practice or the Progress
page. It offers long-answer trivia questions across three subjects — **Greek Mythology**,
**Harry Potter** and **Stranger Things** — pitched at a strong Year 6 reader who already knows
them well, with 20 written-from-scratch questions per subject. Picking a subject draws 5 random
questions from that subject's own 20-question bank (see `MYTHOLOGY_ITEMS`, `HARRY_POTTER_ITEMS`
and `STRANGER_THINGS_ITEMS` in `mythology.html`), so sessions rarely repeat, but no two sessions
cover the whole bank either.

Kept at the `mythology.html` filename/URL even though it's grown beyond just mythology, so any
existing bookmark or home-screen install still opens it.

### Why it's marked differently to the other two apps

Long, free-text answers here don't have one single "correct" wording, so they can't be checked by
matching against a list of accepted answers the way the maths and entry-test apps are. Instead,
each answer is marked by sending the question, a short marking rubric written for that question
(not a real exam mark scheme) and whatever's been typed straight from the browser to Claude
(Anthropic's AI), which comes back with a verdict — correct, partial or incorrect — and a line of
feedback. Nothing is sent anywhere unless an API key's been set up on the admin page first (see
"AI marking" above), and the page makes that clear with a one-off disclosure the first time it's
used, before anything's ever sent.

This needs a Claude API key of your own (get one at
[console.anthropic.com](https://console.anthropic.com)) — it isn't bundled with the app, and each
answer marked costs a small fraction of a cent against that key's own balance. The key itself is
stored only in that browser's `localStorage`, the same as everything else, and is deliberately
left out of the downloadable backup (see below), so it needs re-entering after a restore. Only
Claude is offered as a provider: it can be called directly from the browser with no server needed
in between, and Anthropic's terms don't rule out use by children the way Google's Gemini terms do;
ChatGPT/OpenAI's API blocks being called directly from a browser (it would need a small backend
server, not built here), and Microsoft Copilot doesn't offer an individual API key at all.

### Tip for next time

Once a session finishes, the completion screen doesn't just show the score — if it wasn't a clean
sweep, one more request goes to Claude with all five questions, answers and marks from that
session together (not one at a time, the way marking itself works), asking it to spot a single
recurring pattern worth fixing next time — leaving out specific names/dates, answering too
briefly, not quite addressing what the question actually asked, that sort of thing — and hand back
one short, encouraging sentence written directly to her. A perfect 5/5 skips this extra request
entirely (there's nothing to point out) in favour of a plain well-done note, so it only ever costs
the small amount of extra API credit when there's actually something to learn from. See
`generateSessionTip()` in `mythology.html`, right below `markLongAnswerWithAi()`.

### History and progress

Trivia keeps its own history and progress, separate from `stats.html` and the maths/entry-test
apps, shown directly on `mythology.html` itself once at least one session's been completed. Each
subject is tracked separately — its own last-session score and its own all-time accuracy — under
three `localStorage` keys that each hold one object keyed by subject (`mythology`,
`harry-potter`, `stranger-things`): `triviaHistory_v1` (session-by-session), `triviaItemStats_v1`
(per-question, so any admin backup carries the same "what's been asked before, and how it went"
picture forward) and `triviaTotals_v1` (running all-time correct/attempted per subject). Anyone
who used the page back when it only covered Greek Mythology has their existing progress carried
over automatically the first time the updated page loads, from the old `mythologyHistory_v1` /
`mythologyItemStats_v1` / `mythologyTotals_v1` keys into the new per-subject ones, filed under
`mythology`.

## Backup, restore and full reset

Everything any of the three apps knows lives only in that browser's `localStorage` on that one
device — there's no account and nothing syncs anywhere, which also means there's no automatic
recovery if the browser's site data is ever cleared or the device is replaced. The "Backup and
reset" section on `admin.html` covers this:

- **Backup** downloads a single JSON file containing every setting and history list for all three
  apps (session history, streak/difficulty/target settings, lifetime and per-operation maths
  stats, entry-test weak-question memory, subject accuracy, mock exam and exam date settings,
  Trivia's own per-subject history/item-stats/totals, the Progress page's visibility setting, and
  the parent PIN's hash) — everything except `entryTestBankSize_v1` (regenerated by
  `entry-test.html` on every load) and the AI marking API key, which is deliberately left out of
  the backup file and needs re-entering on `admin.html` after a restore.
- **Restore** reads a previously-downloaded backup file back in, after confirming, replacing
  whatever's currently stored on the device and reloading the page.
- **Reset everything** wipes all of the above (PIN and AI marking key included) back to a
  completely blank slate, after two separate confirmations, since there's no undo. It also clears
  the old pre-Trivia `mythologyHistory_v1` / `mythologyItemStats_v1` / `mythologyTotals_v1` keys
  on a device that hasn't opened `mythology.html` since the update yet, so nothing's left behind
  either way.

## Making changes

Edit `index.html`, `maths-quiz.html`, `entry-test.html`, `mythology.html`, `stats.html` or
`admin.html` directly — each is a single, self-contained file (CSS and JS inline, nothing built
from anything else), so there's no build step. After editing, sanity-check it locally by opening
the file straight in a browser (`file://` works fine for most of the page; the service worker
registration needs a real HTTPS host to succeed, though the rest of each page still works over
`file://`), and see [Testing](#testing) below for the automated checks.

To get changes onto GitHub: either edit the files directly in the GitHub web UI ("Edit" pencil
icon on each file), use "Add file → Upload files" to replace them after editing locally, or
commit and push from a local clone with Git/GitHub Desktop.

## Testing

`tests/` holds a Playwright suite (280 checks as of the last update) covering the things most
likely to break silently: the PIN gate on `admin.html` and `stats.html`, the streak maths,
backup/restore round-tripping every setting, the mock exam configuration, the Progress-page
visibility toggle, and Trivia's subject picker, AI-marked verdicts and per-subject progress
tracking (every call to Anthropic's API is intercepted with a mocked route, so the suite never
makes a real network request or spends real API credit). It's plain Node with no bundler — see
`tests/README.md` for how to install Playwright and run it locally, and
`.github/workflows/test.yml` runs the same suite on every push and pull request.

## Known limitations

- The holiday calendar is hand-maintained — it doesn't pull from any live source, and if the
  school changes its published dates after this was last checked, the app won't know until the
  `HOLIDAYS` array in `maths-quiz.html` is updated by hand.
- History, the parent PIN, the child's name, targets and difficulty levels are all per-browser,
  per-device — using both Chrome and Samsung Internet on the same tablet, for instance, keeps two
  separate copies of everything, and reinstalling or clearing site data resets all of it.
- The parent PIN is a lock against an idle tap from a child, not real security against someone
  with access to the device — and there's no recovery option if it's forgotten short of clearing
  site data (which also clears the history, targets and child's name on that device, and prompts
  for a new PIN to be set next time).
- The entry test page's question bank is a fixed, written set of 999 items — sessions shuffle
  and sample from it, but the questions themselves don't change or grow on their own. Adding
  more is a matter of appending further objects to `ADVENTURE_ITEMS` / `BEACON_ITEMS` in
  `entry-test.html`, following the existing shape.
- Trivia's three subject banks are likewise fixed at 20 written questions each — adding more
  follows the same pattern, appending to `MYTHOLOGY_ITEMS` / `HARRY_POTTER_ITEMS` /
  `STRANGER_THINGS_ITEMS` in `mythology.html`.
- Trivia needs its own Claude API key and a live connection to mark answers — without one it just
  shows a "not set up" message rather than falling back to anything else, and each answer marked
  spends a small amount of that key's own balance (a fraction of a cent per answer on the model
  used, `claude-haiku-4-5`).
