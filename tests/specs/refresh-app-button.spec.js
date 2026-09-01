"use strict";

// Covers the manual "Refresh app / check for updates" footer button —
// admin.html only (it was tried on all five pages, then pared back to just
// this one). Confirm()-gated so a stray tap can't trigger it, dismissing
// leaves the page untouched, and confirming actively checks for an update
// and reloads.

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
};
