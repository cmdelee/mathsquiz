"use strict";

const { attachDialogHandler } = require("../lib/dialogs");

async function seedPinHash(page, pin){
  return page.evaluate(async (p) => {
    const text = "quiz-app:" + p;
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }, pin);
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- visible-to-child ON: opens straight in, no PIN, data renders ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("quizAppChildName_v1", "Ivy");
      localStorage.setItem("quizAppStreakSettings_v1", JSON.stringify({ period: "week", threshold: 3 }));
      localStorage.setItem("quizAppLifetimeStats_v1", JSON.stringify({ sessions: 5, questionsAnswered: 50, questionsCorrect: 40 }));
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem("quizAppHistory_v1", JSON.stringify([
        { date: today, status: "term", correct: 8, attempted: 10, pct: 80 },
        { date: "2026-08-20", status: "term", correct: 7, attempted: 10, pct: 70 }
      ]));
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([
        { date: new Date().toISOString(), paper: "mock", correct: 12, attempted: 15, pct: 80 }
      ]));
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        q1: { outcome: "incorrect", text: "What is 7 x 8?", subject: "maths", format: "adventure", lastSeen: new Date().toISOString() }
      }));
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: { english: { correct: 8, attempted: 10 }, maths: { correct: 6, attempted: 10 } },
        byFormat: { adventure: { correct: 7, attempted: 10 }, beacon: { correct: 7, attempted: 10 } }
      }));
      localStorage.setItem("entryTestBankSize_v1", "999");
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: "2027-05-15" }));
      localStorage.setItem("quizAppTypeStats_v1", JSON.stringify({ multiplication: [true, true, false], division: [], addition: [true], subtraction: [] }));
      localStorage.setItem("quizAppDifficulty_v1", JSON.stringify({ multiplication: 3, division: 2, addition: 4, subtraction: 1 }));
    });
    await page.reload();
    await page.waitForTimeout(300);

    check("stats.html (visible=1): opens with no lock screen", await page.locator("#lockCard").isHidden());
    check("stats.html (visible=1): stats view shown directly", await page.locator("#statsView").isVisible());
    check("stats.html: title personalised with child's name", (await page.locator("#pageTitle").textContent()).includes("Ivy's Progress"));
    check("stats.html: lifetime stats rendered", (await page.locator("#lifetimeStatsText").textContent()).includes("5 sessions"));
    check("stats.html: streak goal reflects saved settings", (await page.locator("#streakGoalText").textContent()).includes("3 sessions a week"));
    check("stats.html: streak status computed from history", !(await page.locator("#streakStatusText").textContent()).includes("No maths sessions"));
    check("stats.html: maths history rows rendered (2)", await page.locator("#mathsHistoryList .history-row").count() === 2);
    check("stats.html: entry test history summary rendered", (await page.locator("#entryHistorySummary").textContent()).includes("1 session"));
    check("stats.html: coverage text shows bank size", (await page.locator("#coverageText").textContent()).includes("of 999"));
    check("stats.html (visible=1): weak-question list is NOT shown to a PIN-free (child) viewer",
      await page.locator("#weakSpotList .history-row").count() === 0);
    check("stats.html (visible=1): parent-only note shown in its place",
      await page.locator("#weakSpotLockedNote").isVisible());
    check("stats.html: exam countdown populated", /to go|today|passed/.test(await page.locator("#examCountdownText").textContent()));
    check("stats.html: difficulty levels list has all 4 operation types", await page.locator("#levelList .history-row").count() === 4);

    await page.close();
  }

  // ---- visible-to-child OFF, PIN set: needs the PIN, correct PIN unlocks ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    const hash = await seedPinHash(page, "1234");
    await page.evaluate((h) => {
      localStorage.clear();
      localStorage.setItem("quizAppParentPinHash_v1", h);
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "0");
    }, hash);
    await page.reload();
    await page.waitForTimeout(200);

    check("stats.html (visible=0, PIN set): lock card shown", await page.locator("#lockCard").isVisible());

    await page.click("#unlockBtn");
    await page.waitForTimeout(300);
    check("stats.html (visible=0, PIN set): correct PIN unlocks the stats view", await page.locator("#statsView").isVisible());

    await page.close();
  }

  // ---- no PIN set yet, visible off: asks for a parent, never offers to create a PIN itself ----
  {
    const page = await browser.newPage();
    let alertMessage = null;
    page.on("dialog", (dialog) => {
      if (dialog.type() === "alert") alertMessage = dialog.message();
      dialog.accept();
    });
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    await page.click("#unlockBtn");
    await page.waitForTimeout(200);

    check("stats.html (no PIN): tells the child to ask a parent, doesn't offer PIN setup",
      alertMessage !== null && alertMessage.toLowerCase().includes("ask a parent"));
    check("stats.html (no PIN): stays locked", await page.locator("#lockCard").isVisible());
    check("stats.html (no PIN): never created a PIN", await page.evaluate(() => localStorage.getItem("quizAppParentPinHash_v1")) === null);

    await page.close();
  }

  // ---- regression: streak renders correctly with AND without maths history present ----
  // (root cause of an earlier bug: an early return used to skip the streak render entirely)
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("quizAppStreakSettings_v1", JSON.stringify({ period: "week", threshold: 5 }));
      // deliberately no quizAppHistory_v1 set
    });
    await page.reload();
    await page.waitForTimeout(300);
    check("stats.html: streak goal populates even with no maths history yet",
      (await page.locator("#streakGoalText").textContent()).includes("5 sessions a week"));
    await page.close();
  }
};
