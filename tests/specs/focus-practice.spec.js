"use strict";

const { attachDialogHandler } = require("../lib/dialogs");

// Covers the new "Focus practice" feature end to end:
//  - admin.html: parents can set how many questions each section draws
//  - entry-test.html: the picker offers a "Focus practice" option above
//    Mock exam, which targets whichever subject currently has the lower
//    accuracy (or everything, weighted, if there's not enough data yet)
//  - stats.html: a new "Where to focus next" section links straight into
//    a focused session for a specific subject via ?focus=

module.exports = async function run({ browser, baseUrl, check }){
  // ---- admin.html: question-count-per-section settings persist ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(150);

    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.fill("#adventureSizeInput", "8");
    await page.fill("#beaconSizeInput", "12");
    await page.fill("#mixedSizeInput", "20");
    await page.fill("#focusSizeInput", "6");
    await page.click("#saveSessionSizeBtn");
    await page.waitForTimeout(150);

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestSessionSizeSettings_v1")));
    check("admin.html: session-size settings save all four sections",
      saved.adventure === 8 && saved.beacon === 12 && saved.mixed === 20 && saved.focus === 6);

    // Out-of-range value is rejected, not silently clamped or saved
    await page.fill("#focusSizeInput", "999");
    await page.click("#saveSessionSizeBtn");
    await page.waitForTimeout(150);
    const noteText = await page.locator("#sessionSizeNote").textContent();
    const stillSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestSessionSizeSettings_v1")));
    check("admin.html: an out-of-range question count is rejected",
      /between/i.test(noteText) && stillSaved.focus === 6);

    await page.close();
  }

  // ---- entry-test.html: a saved question count is actually used ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("entryTestSessionSizeSettings_v1", JSON.stringify({ adventure: 6, beacon: 10, mixed: 15, focus: 10 }));
    });
    await page.reload();
    await page.waitForTimeout(200);

    await page.click('.paper-btn[data-paper="adventure"]');
    await page.waitForTimeout(200);
    const progressText = await page.locator("#progressText").textContent();
    check("entry-test.html: Adventure paper uses the saved question count (6)", progressText.includes("of 6"));

    await page.close();
  }

  // ---- entry-test.html: picker offers Focus practice above Mock exam ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    const order = await page.evaluate(() =>
      Array.prototype.map.call(document.querySelectorAll(".paper-btn"), (b) => b.getAttribute("data-paper"))
    );
    const focusIdx = order.indexOf("focus");
    const mockIdx = order.indexOf("mock");
    check("entry-test.html: \"Focus practice\" option exists", focusIdx !== -1);
    check("entry-test.html: \"Focus practice\" is positioned above \"Mock exam\"", focusIdx !== -1 && mockIdx !== -1 && focusIdx < mockIdx);

    await page.close();
  }

  // ---- entry-test.html: with no history yet, Focus practice draws from everything ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    await page.click('.paper-btn[data-paper="focus"]');
    await page.waitForTimeout(200);
    const sub = await page.locator("#quizSub").textContent();
    check("entry-test.html (no history): Focus practice explains it's a general mix, not a specific subject",
      /trickiest/i.test(sub));

    await page.close();
  }

  // ---- entry-test.html: Focus practice targets the weaker subject once there's enough data ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => {
      localStorage.clear();
      // maths: 2/10 (weak), english: 9/10 (strong) — clearly maths is weaker
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: { maths: { correct: 2, attempted: 10 }, english: { correct: 9, attempted: 10 } },
        byFormat: { adventure: { correct: 5, attempted: 10 }, beacon: { correct: 6, attempted: 10 } }
      }));
    });
    await page.reload();
    await page.waitForTimeout(200);

    const desc = await page.locator("#focusPaperDesc").textContent();
    check("entry-test.html: Focus practice's own description names maths as the weaker subject",
      /maths/i.test(desc));

    await page.click('.paper-btn[data-paper="focus"]');
    await page.waitForTimeout(200);
    const sub = await page.locator("#quizSub").textContent();
    check("entry-test.html: starting Focus practice confirms it's targeting maths",
      /maths/i.test(sub) && /weaker/i.test(sub));

    const tag = await page.locator("#qTag").textContent();
    check("entry-test.html: the question actually shown is tagged Maths", /maths/i.test(tag));

    await page.close();
  }

  // ---- stats.html: "Where to focus next" links straight into a focused session ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: { maths: { correct: 3, attempted: 10 }, english: { correct: 8, attempted: 10 } },
        byFormat: { adventure: { correct: 5, attempted: 10 }, beacon: { correct: 6, attempted: 10 } }
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);

    const rows = await page.locator("#focusAreaList .history-row").count();
    check("stats.html: \"Where to focus next\" lists both subjects", rows === 2);

    const firstRowText = await page.locator("#focusAreaList .history-row").first().locator(".history-date").textContent();
    check("stats.html: the weaker subject (maths) is listed first", /maths/i.test(firstRowText));

    const href = await page.locator("#focusAreaList .history-row").first().locator("a").getAttribute("href");
    check("stats.html: its practice link points at entry-test.html?focus=maths", href === "entry-test.html?focus=maths");

    // Follow the link and confirm entry-test.html actually launches straight
    // into a focused maths session rather than landing on the picker.
    await page.click("#focusAreaList .history-row >> nth=0 >> a");
    await page.waitForTimeout(300);
    check("stats.html -> entry-test.html: the link skips the picker and starts the session directly",
      await page.locator("#pickerView").isHidden());
    const quizSub = await page.locator("#quizSub").textContent();
    check("stats.html -> entry-test.html: the session it lands in is the maths focus session",
      /maths/i.test(quizSub));

    await page.close();
  }
};
