"use strict";

// Regression tests for the fixes that came out of a full code review
// (2026-09-01): maths-quiz.html's difficulty warm-up firing on every
// restart instead of once a day, mythology.html's stale-marking-promise
// race condition and its progress bar not reaching 100%, stats.html
// showing raw internal names for Focus/Spaced-review/NVR sessions, and a
// handful of admin.html gaps (restore file validation, "Clear history"
// leaving stale aggregate stats behind, and two Clear buttons skipping the
// usual confirmation prompt).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { attachDialogHandler } = require("../lib/dialogs");

async function clickAndCaptureDialog(page, selector, accept, promptAnswer){
  let message = null;
  const handler = (dialog) => {
    message = dialog.message();
    if (accept) dialog.accept(promptAnswer !== undefined ? promptAnswer : "1234"); else dialog.dismiss();
  };
  page.on("dialog", handler);
  await page.click(selector);
  await page.waitForTimeout(150);
  page.off("dialog", handler);
  return message;
}

const AI_SETTINGS_KEY = "aiMarkingSettings_v1";
const AI_DISCLOSURE_KEY = "aiDisclosureSeen_v1";
const TRIVIA_ITEM_STATS_KEY = "triviaItemStats_v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// marksAwarded is clamped client-side to the real item's marksAvailable
// (item.rubric.length), so a huge number reliably means "full marks"
// regardless of which item was randomly drawn — see ai-marking.spec.js.
const FULL_MARKS = 999;
function claudeResponse(marksAwarded, feedback){
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      content: [{ type: "text", text: JSON.stringify({ marksAwarded: marksAwarded, feedback: feedback || "Good effort." }) }]
    })
  };
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- maths-quiz.html: difficulty warm-up only fires once per day ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/maths-quiz.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppDifficulty_v1", JSON.stringify({
        multiplication: 3, division: 3, addition: 3, subtraction: 3
      }));
    });
    await page.reload();
    await page.waitForTimeout(150);

    const today = await page.evaluate(() => {
      var d = new Date();
      var p = function(n){ return n < 10 ? "0"+n : ""+n; };
      return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate());
    });

    const afterFirstLoad = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppDifficulty_v1")));
    check("maths-quiz.html: first session of the day warms up (drops a level)", afterFirstLoad.multiplication === 2);
    check("maths-quiz.html: warm-up records today's date", afterFirstLoad._warmedUpOn === today);

    // A second (and third) session the same day — e.g. a page reload, or
    // "Start over"/"Practice again" mid-visit — must NOT warm up again.
    await page.reload();
    await page.waitForTimeout(150);
    const afterReloadSameDay = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppDifficulty_v1")));
    check("maths-quiz.html: reloading the page the same day does not warm up again", afterReloadSameDay.multiplication === 2);

    await page.reload();
    await page.waitForTimeout(150);
    const afterSecondReloadSameDay = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppDifficulty_v1")));
    check("maths-quiz.html: a third reload the same day still does not warm up again", afterSecondReloadSameDay.multiplication === 2);

    // Backdate to "yesterday" and reload — a new day should warm up once more.
    await page.evaluate(() => {
      var obj = JSON.parse(localStorage.getItem("quizAppDifficulty_v1"));
      var y = new Date();
      y.setDate(y.getDate() - 1);
      var p = function(n){ return n < 10 ? "0"+n : ""+n; };
      obj._warmedUpOn = y.getFullYear() + "-" + p(y.getMonth()+1) + "-" + p(y.getDate());
      localStorage.setItem("quizAppDifficulty_v1", JSON.stringify(obj));
    });
    await page.reload();
    await page.waitForTimeout(150);
    const afterNewDay = await page.evaluate(() => JSON.parse(localStorage.getItem("quizAppDifficulty_v1")));
    check("maths-quiz.html: a new calendar day warms up again", afterNewDay.multiplication === 1);

    await page.close();
  }

  // ---- mythology.html: a late-resolving marking request from an abandoned
  // question can't mutate a session that's since moved on ----
  {
    const page = await browser.newPage();
    let resolveGate;
    const gate = new Promise((resolve) => { resolveGate = resolve; });
    await page.route(ANTHROPIC_URL, async (route) => {
      await gate;
      await route.fulfill(claudeResponse(FULL_MARKS, "Nice one."));
    });
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "An answer, currently being marked.");
    await page.click("#checkBtn");
    await page.waitForTimeout(150); // request is now in flight, held by the gate

    // Quit before the (held) response comes back, then start a fresh session.
    await page.click("#quitBtn");
    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(150);

    // Now let the stale request resolve.
    resolveGate();
    await page.waitForTimeout(300);

    check("mythology.html: the new session's question is still unanswered after the stale reply lands",
      await page.locator("#checkBtn").isVisible() && await page.locator("#nextBtn").isHidden());
    check("mythology.html: the new session's question card carries no stale verdict styling",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") === -1);

    const itemStats = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TRIVIA_ITEM_STATS_KEY);
    check("mythology.html: the stale, abandoned answer was never recorded",
      !itemStats.mythology || Object.keys(itemStats.mythology).length === 0);

    await page.close();
  }

  // ---- mythology.html: progress bar/row is hidden (not frozen at 80%) once a session completes ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse(FULL_MARKS, "Nice work.")));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(150);
    for (let i = 0; i < 5; i++){
      await page.fill(".long-answer-box", "A full answer covering the key points.");
      await page.click("#checkBtn");
      await page.waitForTimeout(200);
      await page.click("#nextBtn");
      await page.waitForTimeout(100);
    }

    check("mythology.html: completion panel is shown", await page.locator("#completionPanel").isVisible());
    check("mythology.html: the progress bar/row is hidden rather than stuck below 100%",
      await page.locator("#progressRow").isHidden());

    // And it comes back once a new session starts.
    await page.click("#retryBtn");
    await page.waitForTimeout(150);
    check("mythology.html: the progress row reappears for the next session",
      await page.locator("#progressRow").isVisible());

    await page.close();
  }

  // ---- stats.html: Focus practice / Spaced review / NVR practice get proper labels, not raw keys ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      var now = new Date().toISOString();
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([
        { date: now, paper: "focus", attempted: 6, correct: 5, pct: 83 },
        { date: now, paper: "review", attempted: 4, correct: 4, pct: 100 },
        { date: now, paper: "nvr", attempted: 8, correct: 6, pct: 75 }
      ]));
    });
    await page.reload();
    await page.waitForTimeout(200);

    const historyText = await page.locator("#entryHistoryList").textContent();
    check("stats.html: a Focus practice session shows a readable label, not 'focus'", /Focus practice/.test(historyText));
    check("stats.html: a Spaced review session shows a readable label, not 'review'", /Spaced review/.test(historyText));
    check("stats.html: an NVR practice session shows a readable label, not 'nvr'", /NVR practice/.test(historyText));

    await page.close();
  }

  // ---- admin.html: restore rejects a JSON file that isn't actually a quiz-app backup ----
  {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathsquiz-test-"));
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppChildName_v1", "Should Survive");
    });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    const fakeBackupPath = path.join(downloadDir, "not-a-backup.json");
    fs.writeFileSync(fakeBackupPath, JSON.stringify({ data: { quizAppChildName_v1: "Hijacked" } }));
    await page.locator("#restoreFileInput").setInputFiles(fakeBackupPath);
    await page.waitForTimeout(200);

    check("admin.html: a JSON file without the expected 'app' marker is rejected",
      (await page.locator("#restoreNote").textContent()).indexOf("doesn't look like a quiz app backup file") !== -1);
    const nameUnchanged = await page.evaluate(() => localStorage.getItem("quizAppChildName_v1"));
    check("admin.html: existing data is untouched when restore is rejected", nameUnchanged === "Should Survive");

    await page.close();
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }

  // ---- admin.html: clearing maths/entry-test history also clears their aggregate stats ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppHistory_v1", JSON.stringify([{ date: new Date().toISOString(), correct: 8, attempted: 10, pct: 80 }]));
      localStorage.setItem("quizAppLifetimeStats_v1", JSON.stringify({ correct: 80, attempted: 100 }));
      localStorage.setItem("quizAppTypeStats_v1", JSON.stringify({ multiplication: { correct: 5, attempted: 5 } }));
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([{ date: new Date().toISOString(), correct: 8, attempted: 10, pct: 80, paper: "mixed" }]));
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: { english: { correct: 4, attempted: 5 }, maths: { correct: 4, attempted: 5 }, nvr: { correct: 0, attempted: 0 } },
        byFormat: { adventure: { correct: 4, attempted: 5 }, beacon: { correct: 4, attempted: 5 } }
      }));
    });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.click("#clearMathsHistoryBtn");
    await page.waitForTimeout(100);
    const afterMathsClear = await page.evaluate(() => ({
      lifetime: localStorage.getItem("quizAppLifetimeStats_v1"),
      typeStats: localStorage.getItem("quizAppTypeStats_v1")
    }));
    check("admin.html: 'Clear maths history' also clears lifetime stats", afterMathsClear.lifetime === null);
    check("admin.html: 'Clear maths history' also clears per-type stats", afterMathsClear.typeStats === null);

    await page.click("#clearEntryHistoryBtn");
    await page.waitForTimeout(100);
    const afterEntryClear = await page.evaluate(() => localStorage.getItem("entryTestSubjectStats_v1"));
    check("admin.html: 'Clear entry test history' also clears subject/format accuracy stats", afterEntryClear === null);

    await page.close();
  }

  // ---- admin.html: "Clear" exam date / AI marking key now confirm first, like every other destructive action ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: "2027-05-01" }));
      localStorage.setItem("aiMarkingSettings_v1", JSON.stringify({ provider: "claude", apiKey: "sk-ant-should-stay" }));
    });
    await page.reload();
    // PIN's already set from an earlier admin.html visit's localStorage
    // seeding in this same browser context? No — each test block clears
    // localStorage itself, so this is first-time setup: the prompt for a
    // new PIN is a "prompt" dialog, always accepted with the default
    // "1234" by clickAndCaptureDialog below, same as attachDialogHandler
    // would do — this just avoids stacking two dialog listeners at once.
    await clickAndCaptureDialog(page, "#unlockBtn", true);
    await page.waitForTimeout(300);

    const examDateMsg = await clickAndCaptureDialog(page, "#clearExamDateBtn", false);
    check("admin.html: clearing the exam date now asks for confirmation", !!examDateMsg);
    const examDateAfterDismiss = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestExamDateSettings_v1")).date);
    check("admin.html: dismissing that confirmation leaves the exam date untouched", examDateAfterDismiss === "2027-05-01");

    const aiKeyMsg = await clickAndCaptureDialog(page, "#clearAiMarkingBtn", false);
    check("admin.html: clearing the AI marking key now asks for confirmation", !!aiKeyMsg);
    const aiKeyAfterDismiss = await page.evaluate(() => JSON.parse(localStorage.getItem("aiMarkingSettings_v1")).apiKey);
    check("admin.html: dismissing that confirmation leaves the AI marking key untouched", aiKeyAfterDismiss === "sk-ant-should-stay");

    // Confirming still actually clears them.
    await clickAndCaptureDialog(page, "#clearExamDateBtn", true);
    const examDateAfterAccept = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestExamDateSettings_v1")).date);
    check("admin.html: confirming clears the exam date", !examDateAfterAccept);

    await clickAndCaptureDialog(page, "#clearAiMarkingBtn", true);
    const aiKeyAfterAccept = await page.evaluate(() => JSON.parse(localStorage.getItem("aiMarkingSettings_v1")).apiKey);
    check("admin.html: confirming clears the AI marking key", !aiKeyAfterAccept);

    await page.close();
  }
};
