"use strict";

const { attachDialogHandler } = require("../lib/dialogs");

async function seedPinHash(page, pin){
  return page.evaluate(async (p) => {
    const text = "quiz-app:" + p;
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }, pin);
}

// Covers the spaced-repetition layer added on top of the existing per-item
// weak-spot tracking: a Leitner-style box/interval on every item (so a
// right answer gets recycled back in once its review interval has passed,
// rather than just falling out of rotation for good the moment it's first
// correct), a "regressed" flag for something that had been solidly correct
// before and has just been missed again, and a dedicated "Spaced review"
// session on entry-test.html that draws only from what's actually due.

module.exports = async function run({ browser, baseUrl, check }){
  // ---- box/interval/regression progression, via the test-only hook ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");

    const result = await page.evaluate(() => {
      const items = window.__entryTestAllItems();
      const item = items[0];
      const id = window.__entryTestItemId(item);
      const record = window.__entryTestRecordOutcome;
      const statsOf = () => window.__entryTestItemStats()[id];

      record(item, true); // first correct: box 0 -> 1
      const afterFirstCorrect = Object.assign({}, statsOf());

      record(item, true); // second correct: box 1 -> 2
      const afterSecondCorrect = Object.assign({}, statsOf());

      record(item, false); // now missed: box resets to 0, bestBox stays 2
      const afterMiss = Object.assign({}, statsOf());

      record(item, true); // corrected again: box 0 -> 1, regressed clears
      const afterRecovery = Object.assign({}, statsOf());

      return { afterFirstCorrect, afterSecondCorrect, afterMiss, afterRecovery };
    });

    const now = Date.now();
    check("recordOutcome: first correct answer moves to box 1",
      result.afterFirstCorrect.box === 1 && result.afterFirstCorrect.bestBox === 1);
    check("recordOutcome: first correct answer's review isn't due immediately (interval > 0)",
      new Date(result.afterFirstCorrect.dueAt).getTime() > now);

    check("recordOutcome: a second correct answer advances to box 2 with a longer interval",
      result.afterSecondCorrect.box === 2 && result.afterSecondCorrect.bestBox === 2 &&
      new Date(result.afterSecondCorrect.dueAt).getTime() > new Date(result.afterFirstCorrect.dueAt).getTime());

    check("recordOutcome: a miss drops the box back to 0 but keeps the best box reached",
      result.afterMiss.box === 0 && result.afterMiss.bestBox === 2);
    check("recordOutcome: a miss after reaching box 2+ is flagged as regressed",
      result.afterMiss.regressed === true);
    check("recordOutcome: a missed item is immediately due again",
      new Date(result.afterMiss.dueAt).getTime() <= now + 1000);

    check("recordOutcome: answering correctly again clears the regressed flag",
      result.afterRecovery.regressed === false && result.afterRecovery.box === 1);

    await page.close();
  }

  // ---- itemWeight / reviewPool: correct-but-not-due vs correct-and-due vs incorrect ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");

    const result = await page.evaluate(() => {
      const items = window.__entryTestAllItems();
      const [itemDue, itemNotDue, itemWrong, itemUnseen] = items;
      const idDue = window.__entryTestItemId(itemDue);
      const idNotDue = window.__entryTestItemId(itemNotDue);
      const idWrong = window.__entryTestItemId(itemWrong);

      const stats = window.__entryTestItemStats();
      var past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      var future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
      stats[idDue] = { outcome: "correct", text: "x", subject: itemDue.subject, format: "adventure", lastSeen: past, box: 2, bestBox: 2, dueAt: past };
      stats[idNotDue] = { outcome: "correct", text: "x", subject: itemNotDue.subject, format: "adventure", lastSeen: past, box: 2, bestBox: 2, dueAt: future };
      stats[idWrong] = { outcome: "incorrect", text: "x", subject: itemWrong.subject, format: "adventure", lastSeen: past, box: 0, bestBox: 0, dueAt: past };

      var pool = window.__entryTestReviewPool();
      var poolIds = pool.map(function(it){ return window.__entryTestItemId(it); });
      return {
        poolHasDue: poolIds.indexOf(idDue) !== -1,
        poolHasWrong: poolIds.indexOf(idWrong) !== -1,
        poolHasNotDue: poolIds.indexOf(idNotDue) !== -1,
        poolSize: pool.length
      };
    });

    check("reviewPool: includes a correct answer whose review interval has passed", result.poolHasDue);
    check("reviewPool: includes a still-wrong answer", result.poolHasWrong);
    check("reviewPool: excludes a correct answer that isn't due yet", !result.poolHasNotDue);
    check("reviewPool: pool size matches exactly the two due items seeded", result.poolSize === 2);

    await page.close();
  }

  // ---- picker: "Spaced review" reflects what's actually due ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => { localStorage.removeItem("entryTestItemStats_v1"); });
    await page.reload();
    await page.waitForTimeout(200);

    check("entry-test.html: 'Spaced review' is disabled with nothing due",
      await page.locator("#reviewPaperBtn").isDisabled());
    check("entry-test.html: 'Spaced review' explains there's nothing due yet",
      /nothing due/i.test(await page.locator("#reviewPaperDesc").textContent()));

    // Seed two due items (one wrong, one correct-but-overdue) using real
    // item ids, then reload so the page picks them up on init.
    await page.evaluate(() => {
      const items = window.__entryTestAllItems();
      const idWrong = window.__entryTestItemId(items[0]);
      const idDue = window.__entryTestItemId(items[1]);
      var past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      var stats = {};
      stats[idWrong] = { outcome: "incorrect", text: "q1", subject: items[0].subject, format: "adventure", lastSeen: past, box: 0, bestBox: 0, dueAt: past };
      stats[idDue] = { outcome: "correct", text: "q2", subject: items[1].subject, format: "adventure", lastSeen: past, box: 2, bestBox: 2, dueAt: past };
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify(stats));
    });
    await page.reload();
    await page.waitForTimeout(200);

    check("entry-test.html: 'Spaced review' is enabled once something is due",
      !(await page.locator("#reviewPaperBtn").isDisabled()));
    check("entry-test.html: 'Spaced review' description reports the due count",
      /2 questions due/i.test(await page.locator("#reviewPaperDesc").textContent()));

    await page.click("#reviewPaperBtn");
    await page.waitForTimeout(150);
    const queueLen = await page.locator(".progress-text").textContent();
    check("entry-test.html: starting Spaced review begins a session sized to what's due",
      /of 2$/.test(queueLen.trim()));
    check("entry-test.html: the Spaced review session is titled accordingly",
      (await page.locator("#quizTitle").textContent()).trim() === "Spaced review");

    await page.close();
  }

  // ---- stats.html: a regressed item is surfaced distinctly ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        q1: { outcome: "incorrect", text: "Regressed question text", subject: "maths", format: "adventure", lastSeen: new Date().toISOString(), regressed: true },
        q2: { outcome: "incorrect", text: "Ordinary still-weak question", subject: "english", format: "beacon", lastSeen: new Date().toISOString(), regressed: false }
      }));
    });
    await page.reload();
    await page.waitForTimeout(300);

    // No PIN set on this profile, so it opens locked for weak-spot text —
    // set a PIN and unlock via the same flow the other stats tests use.
    // (Skipped here: this profile has visible-to-child on but no PIN, so
    // the weak-spot section shows the "ask a parent" note rather than the
    // list — that's expected existing behaviour, not something this
    // feature changes, so this check only needs the note to still appear.)
    check("stats.html: weak-spot list stays PIN-gated regardless of regression data",
      await page.locator("#weakSpotLockedNote").isVisible());

    await page.close();
  }

  // ---- stats.html: regression callout renders once unlocked with a PIN ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    const hash = await seedPinHash(page, "1234");
    await page.evaluate((h) => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "0");
      localStorage.setItem("quizAppParentPinHash_v1", h);
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        q1: { outcome: "incorrect", text: "Regressed question text", subject: "maths", format: "adventure", lastSeen: new Date().toISOString(), regressed: true },
        q2: { outcome: "incorrect", text: "Ordinary still-weak question", subject: "english", format: "beacon", lastSeen: new Date().toISOString(), regressed: false }
      }));
    }, hash);
    await page.reload();
    await page.waitForTimeout(200);

    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    check("stats.html: a regressed question is tagged 'Slipping back'",
      (await page.locator("#weakSpotList .history-row").first().textContent()).includes("Slipping back"));
    check("stats.html: the regressed row gets the distinct styling class",
      await page.locator("#weakSpotList .history-row.is-regressed").count() === 1);
    check("stats.html: the note above the list explains the regression",
      /solidly correct before/i.test(await page.locator("#weakSpotNote").textContent()));

    await page.close();
  }
};
