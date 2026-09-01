# Tests

A small Playwright suite covering the things in this app most likely to break silently: the
parent PIN gate on `admin.html` and `stats.html`, streak maths, backup/restore round-tripping
every setting (including the newer Progress-page visibility toggle), the mock exam
configuration, and the "Practice exam" card disappearing once its exam date has passed.

There's no test framework (Jest, Mocha, etc.) — each file in `specs/` just exports an async
function that runs some Playwright checks and calls `check(description, condition)`, matching
the rest of this repo's no-build-step approach. `run.js` starts a tiny static server for the
repo root, launches one shared browser, runs every spec, and reports a pass/fail summary.

## Running locally

```
npm install
npx playwright install --with-deps chromium
npm test
```

`npm install` pulls in Playwright itself (the only dependency); `playwright install` downloads
the actual browser binary, which isn't part of the npm package. Both only need doing once (or
again after a Playwright version bump).

## Adding a check

Pick the closest existing file under `specs/` (or add a new `*.spec.js` file — `run.js` picks up
anything matching that pattern automatically) and add a `check("what this proves", someBoolean)`
call. Keep each spec file focused on one page or feature so a failure points straight at what
broke.

## CI

`.github/workflows/test.yml` runs this same suite on every push and pull request.
