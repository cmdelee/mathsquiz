"use strict";

// Covers the manual "Refresh app / check for updates" footer button added
// to all five pages: it exists everywhere, it's confirm()-gated so a stray
// tap can't trigger it, dismissing the confirm leaves the page untouched,
// and on the two pages that can be mid-quiz (maths-quiz.html, entry-test.html)
// the warning explicitly calls out that progress will be lost when a
// question/paper is actually in progress, but not otherwise.

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
  // ---- button present on every page ----
  const pages = ["index.html", "maths-quiz.html", "entry-test.html", "admin.html", "stats.html"];
  for (const p of pages){
    const page = await browser.newPage();
    await page.goto(baseUrl + "/" + p);
    const count = await page.locator("#refreshAppBtn").count();
    check(p + ": has a refresh-app footer button", count === 1);
    await page.close();
  }

  // ---- dismissing the confirmation leaves the page alone ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => { window.__notReloaded = true; });
    await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    const stillThere = await page.evaluate(() => window.__notReloaded === true);
    check("index.html: dismissing the refresh confirmation does not reload the page", stillThere);
    await page.close();
  }

  // ---- generic pages: plain "check for updates" wording, no progress warning ----
  for (const p of ["index.html", "admin.html", "stats.html"]){
    const page = await browser.newPage();
    await page.goto(baseUrl + "/" + p);
    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check(p + ": refresh confirmation uses the generic wording, not a progress warning",
      /check for the latest updates/i.test(msg) && !/lost|restart/i.test(msg));
    await page.close();
  }

  // ---- maths-quiz.html: generic wording before answering anything ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/maths-quiz.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);
    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check("maths-quiz.html: no warning about lost progress before any question is answered",
      msg !== null && !/lost|restart/i.test(msg));
    await page.close();
  }

  // ---- maths-quiz.html: progress warning once a question's been answered ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/maths-quiz.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    await page.fill(".single-input", "0");
    await page.click("#checkBtn");
    await page.waitForTimeout(150);

    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check("maths-quiz.html: refreshing mid-session warns that today's progress will be lost",
      msg !== null && /lost/i.test(msg) && /restart/i.test(msg));
    await page.close();
  }

  // ---- entry-test.html: generic wording on the picker screen ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);
    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check("entry-test.html: no warning about lost progress while still on the picker",
      msg !== null && !/restart this session/i.test(msg));
    await page.close();
  }

  // ---- entry-test.html: progress warning once a paper is under way ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    await page.click('.paper-btn[data-paper="adventure"]');
    await page.waitForTimeout(200);

    const msg = await clickAndCaptureDialog(page, "#refreshAppBtn", false);
    check("entry-test.html: refreshing mid-paper warns the session will restart and not be saved",
      msg !== null && /restart this session/i.test(msg) && /won't be saved/i.test(msg));
    await page.close();
  }

  // ---- accepting the confirmation actually reloads (state resets) ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/maths-quiz.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    await page.fill(".single-input", "0");
    await page.click("#checkBtn");
    await page.waitForTimeout(150);
    const beforeReload = await page.locator("#progressText").textContent();

    await clickAndCaptureDialog(page, "#refreshAppBtn", true);
    await page.waitForTimeout(300);
    const afterReload = await page.locator("#progressText").textContent();

    check("maths-quiz.html: accepting the refresh confirmation reloads and resets session progress",
      /attempted/.test(beforeReload) && !/attempted/.test(afterReload));
    await page.close();
  }
};
