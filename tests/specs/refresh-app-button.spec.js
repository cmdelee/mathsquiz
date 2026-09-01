"use strict";

// Covers the manual "Refresh app / check for updates" footer button —
// admin.html only (it was tried on all five pages, then pared back to just
// this one). Confirm()-gated so a stray tap can't trigger it, dismissing
// leaves the page untouched, and confirming actively checks for an update
// and reloads. Also covers sw.js's fetch strategy: it used to serve
// whatever was cached immediately and only refresh the cache in the
// background (so a hard refresh could still show stale content — the
// question bank included, since it lives inline in entry-test.html), and
// is now network-first, only falling back to the cache when offline.

const fs = require("fs");
const path = require("path");

async function clickAndCaptureDialog(page, selector, accept){
  let message = null;
  const handler = (dialog) => {
    message = dialog.message();
    if (accept) dialog.accept(); else dialog.dismiss();
  };
  page.on("dialog", handler);
  await page.click(selector);
  await page.waitForTimeout(150);
  page.off("dialog", handler);
  return message;
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- button present on admin.html, absent everywhere else ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/admin.html");
    check("admin.html: has a refresh-app footer button", await page.locator("#refreshAppBtn").count() === 1);
    await page.close();
  }
  for (const p of ["index.html", "maths-quiz.html", "entry-test.html", "stats.html"]){
    const page = await browser.newPage();
    await page.goto(baseUrl + "/" + p);
    check(p + ": no refresh-app footer button (admin.html only)", await page.locator("#refreshAppBtn").count() === 0);
    await page.close();
  }

  // ---- dismissing the confirmation leaves the page alone ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => { window.__notReloaded = true; });
    await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    const stillThere = await page.evaluate(() => window.__notReloaded === true);
    check("admin.html: dismissing the refresh confirmation does not reload the page", stillThere);
    await page.close();
  }

  // ---- the confirmation wording ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/admin.html");
    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check("admin.html: refresh confirmation mentions checking for updates", /check for the latest updates/i.test(msg));
    await page.close();
  }

  // ---- accepting the confirmation reloads the page ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => { window.__notReloaded = true; });
    await clickAndCaptureDialog(page, "#refreshAppBtn", true);
    await page.waitForTimeout(300);
    const reloaded = await page.evaluate(() => window.__notReloaded === undefined);
    check("admin.html: accepting the refresh confirmation reloads the page", reloaded);
    await page.close();
  }

  // ---- accepting the confirmation actually empties every cache bucket ----
  // (not just asks the service worker to check for a new script) — this is
  // what makes it a genuine "fetch everything fresh" button rather than one
  // that could still hand back something stale from a cache. The real
  // reload is left to happen naturally (overriding location.reload isn't
  // reliable across browsers) — deletions are reported via console.log
  // instead of a page-context variable, since a Playwright page-level
  // listener survives the navigation that an in-page variable wouldn't.
  {
    const page = await browser.newPage();
    const deleted = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.indexOf("__cache_deleted__:") === 0) deleted.push(text.slice("__cache_deleted__:".length));
    });
    await page.addInitScript(() => {
      const fakeCaches = {
        keys: function(){ return Promise.resolve(["quiz-app-v4", "quiz-app-v5"]); },
        delete: function(name){ console.log("__cache_deleted__:" + name); return Promise.resolve(true); }
      };
      Object.defineProperty(window, "caches", { value: fakeCaches, configurable: true });
      const fakeServiceWorker = {
        getRegistration: function(){ return Promise.resolve(null); },
        addEventListener: function(){},
        removeEventListener: function(){}
      };
      Object.defineProperty(navigator, "serviceWorker", { value: fakeServiceWorker, configurable: true });
    });
    await page.goto(baseUrl + "/admin.html");
    page.on("dialog", (dialog) => dialog.accept());
    try {
      await Promise.all([
        page.waitForEvent("load", { timeout: 3000 }),
        page.click("#refreshAppBtn")
      ]);
    } catch (e) { /* navigation timing is best-effort here — the console messages are what matter */ }
    check("admin.html: refreshing empties every existing cache bucket before reloading",
      deleted.includes("quiz-app-v4") && deleted.includes("quiz-app-v5"));
    await page.close();
  }

  // ---- sw.js fetches network-first, not cache-first ----
  {
    const swSrc = fs.readFileSync(path.join(__dirname, "..", "..", "sw.js"), "utf8");
    const fetchHandler = swSrc.slice(swSrc.indexOf('addEventListener("fetch"'));
    // The response promise chain must start from fetch(), not from
    // caches.match() — network-first means the network call is what's
    // actually awaited for the response; the cache is only consulted in
    // the .catch() (offline fallback), not as the first thing tried.
    const fetchBeforeCacheMatch = fetchHandler.indexOf("fetch(event.request)");
    const cacheMatchIndex = fetchHandler.indexOf("caches.match(event.request)");
    check("sw.js: fetch handler tries the network before falling back to the cache",
      fetchBeforeCacheMatch !== -1 && cacheMatchIndex !== -1 && fetchBeforeCacheMatch < cacheMatchIndex);
  }
};
