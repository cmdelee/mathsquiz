"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { attachDialogHandler } = require("../lib/dialogs");

module.exports = async function run({ browser, baseUrl, check }){
  // ---- first-time PIN setup unlocks the page ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.click("#unlockBtn");
    await page.waitForTimeout(300);
    const unlocked = await page.locator("#adminView").isVisible();
    check("admin.html: first-time PIN setup unlocks the page", unlocked);

    await page.close();
  }

  // ---- settings save, and persist across a reload ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.fill("#childNameInput", "Test Child");
    await page.click("#saveChildNameBtn");
    await page.fill("#termTargetInput", "30");
    await page.fill("#holidayTargetInput", "12");
    await page.click("#saveTargetsBtn");
    await page.selectOption("#streakPeriodInput", "day");
    await page.fill("#streakThresholdInput", "4");
    await page.click("#saveStreakBtn");
    await page.fill("#examDateInput", "2027-05-15");
    await page.click("#saveExamDateBtn");
    await page.fill("#mockMinutesInput", "25");
    await page.fill("#mockQuestionsInput", "18");
    await page.click("#saveMockBtn");
    await page.check("#statsVisibleInput");
    await page.waitForTimeout(150);

    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    check("admin.html: child name persists", await page.locator("#childNameInput").inputValue() === "Test Child");
    check("admin.html: term target persists", await page.locator("#termTargetInput").inputValue() === "30");
    check("admin.html: holiday target persists", await page.locator("#holidayTargetInput").inputValue() === "12");
    check("admin.html: streak period persists", await page.locator("#streakPeriodInput").inputValue() === "day");
    check("admin.html: streak threshold persists", await page.locator("#streakThresholdInput").inputValue() === "4");
    check("admin.html: exam date persists", await page.locator("#examDateInput").inputValue() === "2027-05-15");
    check("admin.html: mock minutes persists", await page.locator("#mockMinutesInput").inputValue() === "25");
    check("admin.html: mock questions persists", await page.locator("#mockQuestionsInput").inputValue() === "18");
    check("admin.html: stats-visible toggle persists", await page.locator("#statsVisibleInput").isChecked() === true);

    await page.close();
  }

  // ---- data management buttons work ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppDifficulty_v1", JSON.stringify({ multiplication: 5, division: 4, addition: 3, subtraction: 6 }));
      localStorage.setItem("quizAppHistory_v1", JSON.stringify([{ date: "2026-08-01", status: "term", correct: 8, attempted: 10, pct: 80 }]));
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([{ date: "2026-08-01T00:00:00.000Z", paper: "mixed", correct: 8, attempted: 10, pct: 80 }]));
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({ q1: { outcome: "incorrect", text: "x", subject: "maths", format: "adventure", lastSeen: new Date().toISOString() } }));
    });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.click("#resetDifficultyBtn");
    await page.waitForTimeout(100);
    const diff = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppDifficulty_v1")));
    check("admin.html: reset difficulty sets every type to level 1", diff.multiplication === 1 && diff.division === 1 && diff.addition === 1 && diff.subtraction === 1);

    await page.click("#clearMathsHistoryBtn");
    await page.waitForTimeout(100);
    const mathsHistory = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppHistory_v1")));
    check("admin.html: clear maths history empties the list", Array.isArray(mathsHistory) && mathsHistory.length === 0);

    await page.click("#clearEntryHistoryBtn");
    await page.waitForTimeout(100);
    const entryHistory = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestHistory_v1")));
    check("admin.html: clear entry test history empties the list", Array.isArray(entryHistory) && entryHistory.length === 0);

    await page.click("#clearWeakSpotBtn");
    await page.waitForTimeout(100);
    const itemStats = await page.evaluate(() => localStorage.getItem("entryTestItemStats_v1"));
    check("admin.html: clear weak-question memory removes the key", itemStats === null);

    await page.close();
  }

  // ---- backup includes the new stats-visible key, restore brings it back ----
  {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathsquiz-test-"));
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.check("#statsVisibleInput");
    await page.fill("#childNameInput", "Backup Test");
    await page.click("#saveChildNameBtn");
    await page.waitForTimeout(100);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#backupBtn")
    ]);
    const backupPath = path.join(downloadDir, "backup.json");
    await download.saveAs(backupPath);
    const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    check("admin.html: backup includes quizAppStatsVisibleToChild_v1", "quizAppStatsVisibleToChild_v1" in backupContent.data);
    check("admin.html: backup captures the toggle as on", backupContent.data.quizAppStatsVisibleToChild_v1 === "1");

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("#unlockBtn"); // creates a fresh PIN on this now-empty device
    await page.waitForTimeout(300);

    await page.locator("#restoreFileInput").setInputFiles(backupPath);
    await page.waitForTimeout(500); // restore reloads the page itself

    const restoredVisible = await page.evaluate(() => localStorage.getItem("quizAppStatsVisibleToChild_v1"));
    const restoredName = await page.evaluate(() => localStorage.getItem("quizAppChildName_v1"));
    check("admin.html: restore brings back the stats-visible setting", restoredVisible === "1");
    check("admin.html: restore brings back the child name", restoredName === "Backup Test");

    await context.close();
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }

  // ---- reset everything wipes the PIN and the new toggle too ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);
    await page.check("#statsVisibleInput");
    await page.waitForTimeout(100);

    await page.click("#resetAllBtn");
    await page.waitForTimeout(500);

    const pinAfter = await page.evaluate(() => localStorage.getItem("quizAppParentPinHash_v1"));
    const visibleAfter = await page.evaluate(() => localStorage.getItem("quizAppStatsVisibleToChild_v1"));
    check("admin.html: reset everything clears the PIN", pinAfter === null);
    check("admin.html: reset everything clears the stats-visible toggle", visibleAfter === null);

    await page.close();
  }
};
