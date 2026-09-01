"use strict";

// Covers the "update available" banner: navigator.serviceWorker's
// controllerchange event, when it fires *after* the page already had a
// controller, should reveal the banner; the very first controllerchange
// (going from no controller to one) should not, since that's just the
// initial install completing, not an update landing mid-session.
//
// A freshly-launched test browser never has a real service worker mid-way
// through a test, so navigator.serviceWorker is stubbed with a fake
// EventTarget-like object (via addInitScript, so it's in place before each
// page's own script runs) rather than relying on a real install/update
// cycle, which would be slow and flaky to arrange here.
async function withFakeServiceWorker(page, { hadControllerAtLoad }){
  await page.addInitScript((hadControllerAtLoad) => {
    const listeners = [];
    window.__fireControllerChange = function () {
      listeners.slice().forEach(function (cb) { cb(); });
    };
    const fakeServiceWorker = {
      controller: hadControllerAtLoad ? { scriptURL: "fake-sw.js" } : null,
      addEventListener: function (type, cb) {
        if (type === "controllerchange") listeners.push(cb);
      },
      removeEventListener: function () {},
      register: function () {
        return Promise.reject(new Error("mocked — no real service worker in tests"));
      }
    };
    Object.defineProperty(navigator, "serviceWorker", { value: fakeServiceWorker, configurable: true });
  }, hadControllerAtLoad);
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- stays hidden through the very first install (no prior controller) ----
  {
    const page = await browser.newPage();
    await withFakeServiceWorker(page, { hadControllerAtLoad: false });
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => window.__fireControllerChange());
    await page.waitForTimeout(100);
    check("update banner: stays hidden on first install (no previous controller)",
      await page.locator("#updateBanner").isHidden());
    await page.close();
  }

  // ---- appears once a controller is replaced mid-session (a real update) ----
  {
    const page = await browser.newPage();
    await withFakeServiceWorker(page, { hadControllerAtLoad: true });
    await page.goto(baseUrl + "/index.html");
    check("update banner: hidden before any update", await page.locator("#updateBanner").isHidden());

    await page.evaluate(() => window.__fireControllerChange());
    await page.waitForTimeout(100);
    check("update banner: shown once the controller changes mid-session",
      await page.locator("#updateBanner").isVisible());

    let reloaded = false;
    try {
      await Promise.all([
        page.waitForEvent("load", { timeout: 3000 }),
        page.click("#updateBannerBtn")
      ]);
      reloaded = true;
    } catch (e){ reloaded = false; }
    check("update banner: refresh button reloads the page", reloaded);

    await page.close();
  }

  // ---- same wiring present on a second, differently-structured page ----
  {
    const page = await browser.newPage();
    await withFakeServiceWorker(page, { hadControllerAtLoad: true });
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => window.__fireControllerChange());
    await page.waitForTimeout(100);
    check("update banner: also wired up on admin.html",
      await page.locator("#updateBanner").isVisible());
    await page.close();
  }
};
