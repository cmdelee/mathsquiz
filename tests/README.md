# Tests

A small Playwright suite covering the things in this app most likely to break silently: the
parent PIN gate on `admin.html` and `stats.html`, streak maths, backup/restore round-tripping
every setting (including the newer Progress-page visibility toggle), the mock exam
configuration, and the "Practice exam" card disappearing once its exam date has passed.

There's no test framework (Jest, Mocha, etc.) — each file in `specs/` just exports an async
function that runs some Playwright checks and calls `check(description, condition)`, matching
the rest of this repo's no-build-step approach. `run.js` starts a tiny static server for the
repo root, runs every spec against each requested browser engine in turn, and reports one
combined pass/fail summary (each check is prefixed with `[chromium]`, `[firefox]` or `[webkit]`
so a failure says straight away which engine it happened in).

## Running locally

```
npm install
npx playwright install --with-deps chromium
npm test
```

`npm install` pulls in Playwright itself (the only dependency); `playwright install` downloads
the actual browser binary, which isn't part of the npm package. Both only need doing once (or
again after a Playwright version bump). `npm test` runs against Chromium only — good for quick
local iteration.

## Cross-browser

```
npx playwright install --with-deps chromium firefox webkit
npm run test:cross-browser
```

Runs the exact same specs against Chromium, Firefox and WebKit, one engine after another. Worth
doing before a release, or whenever a change touches CSS or anything PWA-related (service worker,
manifest), since those are the things most likely to behave differently between engines. CI runs
this cross-browser version automatically on every push — see below.

## Adding a check

Pick the closest existing file under `specs/` (or add a new `*.spec.js` file — `run.js` picks up
anything matching that pattern automatically) and add a `check("what this proves", someBoolean)`
call. Keep each spec file focused on one page or feature so a failure points straight at what
broke.

## CI

`.github/workflows/test.yml` runs this same suite on every push and pull request.
