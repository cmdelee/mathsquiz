# Quiz App

A holiday-aware long arithmetic practice tool for Skipton, North Yorkshire, aimed at Year 6–7
(age 11–12). Checks whether today is a North Yorkshire school holiday and sets a practice
target accordingly — 10 correct answers on a holiday, 25 in term time — mixing long
multiplication, long division, long subtraction and long addition until that target is reached.

Live at: https://github.com/cmdelee/mathsquiz (GitHub Pages, once enabled)

## Files

All five files sit together in the repo root — GitHub Pages serves them as-is, no build step.

| File | Purpose |
|---|---|
| `index.html` | The whole app — markup, styles and logic in one file. |
| `manifest.json` | PWA manifest, so it can be installed to a phone/tablet home screen. |
| `sw.js` | Service worker — caches the app shell for offline use once installed. |
| `icon-192.png`, `icon-512.png` | App icons (moss green, Σ mark). |

## How it works

- **Holiday dates**: hardcoded in `index.html` (search for `HOLIDAYS`) from North Yorkshire
  Council's published term dates, covering September 2025 through summer 2028. Dates beyond
  that fall back to a rough estimate, clearly flagged in the UI. **These will need updating**
  once North Yorkshire Council publishes the 2028/29 calendar — replace the `HOLIDAYS` array
  with the new half-term/holiday date ranges.
- **Questions**: generated in-browser, no backend. Each question type (multiplication,
  division, subtraction, addition) gets roughly an equal share — see `pickType()`.
- **History**: saved to `localStorage` on whichever device/browser is used (key
  `quizAppHistory_v1`) — nothing is sent anywhere. Clearing it requires a parent PIN, set on
  first use and stored only as a hash (key `quizAppParentPinHash_v1`).
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

- The holiday calendar is hand-maintained (see above) — it doesn't pull from any live source.
- Academies and independent schools in the area sometimes set slightly different term dates
  from the North Yorkshire Council standard calendar this uses.
- History and the parent PIN are per-browser, per-device — using both Chrome and Samsung
  Internet on the same tablet, for instance, keeps two separate histories.
