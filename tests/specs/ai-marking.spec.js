"use strict";

// Covers the standalone "Greek Mythology" page (mythology.html) and the
// generic AI marking settings it shares with any future AI-marked subject:
// the item bank itself, the landing state gated on a key actually being
// configured, the one-off disclosure panel, the marking flow (correct/
// partial/incorrect verdicts) and its error handling, its own progress
// tracking (separate from stats.html), the admin.html "AI Marking" section
// (generic key names, a "Clear Greek Mythology history" control) and the
// backup/reset behaviour around it. Every call to Anthropic's API is
// intercepted with page.route() — nothing here ever makes a real network
// request or costs real money.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { attachDialogHandler } = require("../lib/dialogs");

const AI_SETTINGS_KEY = "aiMarkingSettings_v1";
const AI_DISCLOSURE_KEY = "aiDisclosureSeen_v1";
const MYTHOLOGY_HISTORY_KEY = "mythologyHistory_v1";
const MYTHOLOGY_ITEM_STATS_KEY = "mythologyItemStats_v1";
const MYTHOLOGY_TOTALS_KEY = "mythologyTotals_v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function claudeResponse(verdict, feedback){
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      content: [{ type: "text", text: JSON.stringify({ verdict: verdict, feedback: feedback || "Good effort." }) }]
    })
  };
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- the item bank itself is well-formed ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/mythology.html");
    const info = await page.evaluate(() => {
      var items = window.__mythologyAllItems();
      var ids = items.map(function (it){ return window.__mythologyItemId(it); });
      var uniqueIds = ids.filter(function (id, i){ return ids.indexOf(id) === i; });
      return {
        total: items.length,
        allMythology: items.every(function (it){ return it.subject === "mythology"; }),
        allHaveRubric: items.every(function (it){ return Array.isArray(it.rubric) && it.rubric.length > 0; }),
        allHaveModelAnswer: items.every(function (it){ return typeof it.modelAnswer === "string" && it.modelAnswer.length > 0; }),
        allHavePrompt: items.every(function (it){ return typeof it.prompt === "string" && it.prompt.length > 0; }),
        uniqueIdCount: uniqueIds.length
      };
    });
    check("mythology.html: Greek Mythology bank has 5 questions", info.total === 5);
    check("mythology.html: every item is tagged subject 'mythology'", info.allMythology);
    check("mythology.html: every item has a marking rubric", info.allHaveRubric);
    check("mythology.html: every item has a model answer", info.allHaveModelAnswer);
    check("mythology.html: every item has prompt text", info.allHavePrompt);
    check("mythology.html: item ids are unique", info.uniqueIdCount === info.total);
    await page.close();
  }

  // ---- landing: gated on a key actually being configured ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(150);

    check("mythology.html: 'not set up yet' card shows with no AI marking key set",
      await page.locator("#notSetUpCard").isVisible());
    check("mythology.html: the start card is hidden until then",
      await page.locator("#startCard").isHidden());
    check("mythology.html: the not-set-up card points to Parents / Admin",
      /Parents \/ Admin/.test(await page.locator("#notSetUpCard").textContent()));

    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
    }, AI_SETTINGS_KEY);
    await page.reload();
    await page.waitForTimeout(150);

    check("mythology.html: the start card appears once a key is configured",
      await page.locator("#startCard").isVisible());
    check("mythology.html: 'not set up yet' card is hidden once a key is configured",
      await page.locator("#notSetUpCard").isHidden());
    check("mythology.html: the start card states the question count",
      /5 questions/.test(await page.locator("#startSub").textContent()));

    await page.close();
  }

  // ---- the one-off AI marking disclosure ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((key) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
    }, AI_SETTINGS_KEY);
    await page.reload();
    await page.waitForTimeout(150);

    await page.click("#startBtn");
    await page.waitForTimeout(150);
    check("mythology.html: the disclosure panel shows before the first session",
      await page.locator("#aiDisclosureView").isVisible());
    check("mythology.html: no question is shown yet while the disclosure is up",
      await page.locator("#quizSection").isHidden());

    // "Back" returns to the landing view without starting anything or marking it seen.
    await page.click("#aiDisclosureBackBtn");
    await page.waitForTimeout(100);
    check("mythology.html: 'Back' returns to the start card", await page.locator("#startCard").isVisible());
    const seenAfterBack = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("mythology.html: 'Back' does not mark the disclosure as seen", seenAfterBack !== "1");

    // Now go through it properly.
    await page.click("#startBtn");
    await page.waitForTimeout(100);
    await page.click("#aiDisclosureContinueBtn");
    await page.waitForTimeout(150);
    check("mythology.html: 'Continue' proceeds into the session",
      await page.locator("#quizSection").isVisible() && await page.locator("#questionCard").isVisible());
    const seenAfterContinue = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("mythology.html: 'Continue' marks the disclosure as seen", seenAfterContinue === "1");
    check("mythology.html: the AI-marked badge shows on the question",
      await page.locator(".ai-badge").isVisible());

    await page.click("#quitBtn");
    await page.click("#startBtn");
    await page.waitForTimeout(150);
    check("mythology.html: a later visit skips straight past the disclosure",
      await page.locator("#quizSection").isVisible() && await page.locator("#aiDisclosureView").isHidden());

    await page.close();
  }

  // ---- marking flow: a "correct" verdict ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse("correct", "Great, you covered the key facts!")));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click("#startBtn");
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "Zeus is the king of the gods and rules Mount Olympus. He controls thunder.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: a 'correct' verdict shows correct feedback",
      (await page.locator("#qFeedback").textContent()).indexOf("Great, you covered the key facts!") !== -1);
    check("mythology.html: a 'correct' verdict marks the question card correct",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") !== -1);
    check("mythology.html: 'Mark my answer' is hidden after marking", await page.locator("#checkBtn").isHidden());
    check("mythology.html: 'Next question' appears after marking", await page.locator("#nextBtn").isVisible());

    await page.click("#nextBtn");
    await page.waitForTimeout(100);
    await page.click("#quitBtn");
    await page.waitForTimeout(100);

    const itemStats = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), MYTHOLOGY_ITEM_STATS_KEY);
    check("mythology.html: a correct answer is recorded in its own item stats (not stats.html's keys)",
      Object.keys(itemStats).length === 1);

    await page.close();
  }

  // ---- marking flow: a "partial" verdict is distinct from both correct and incorrect ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse("partial", "You had the labyrinth right, but missed who built it.")));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click("#startBtn");
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "There was a monster in a maze.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: a 'partial' verdict is styled distinctly from correct/incorrect",
      (await page.locator("#qFeedback").getAttribute("class")) === "q-feedback is-partial");
    check("mythology.html: a 'partial' verdict's feedback text comes through",
      (await page.locator("#qFeedback").textContent()).indexOf("missed who built it") !== -1);
    check("mythology.html: a 'partial' verdict does not mark the question card correct",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") === -1);

    await page.close();
  }

  // ---- marking flow: an API failure rolls the question back to answerable ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Overloaded, try again shortly." } })
    }));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click("#startBtn");
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "Athena is the goddess of wisdom.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: an API error is shown rather than left blank",
      (await page.locator("#qFeedback").textContent()).indexOf("Overloaded") !== -1);
    check("mythology.html: the answer box is re-enabled so it can be tried again",
      !(await page.locator(".long-answer-box").isDisabled()));
    check("mythology.html: 'Mark my answer' is available again after a failure",
      await page.locator("#checkBtn").isVisible() && (await page.locator("#checkBtn").textContent()) === "Mark my answer");

    await page.close();
  }

  // ---- its own progress tracking, separate from stats.html ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse("correct", "Nice work.")));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    check("mythology.html: progress section is hidden before any session", await page.locator("#progressSection").isHidden());

    await page.click("#startBtn");
    await page.waitForTimeout(150);
    for (let i = 0; i < 5; i++){
      await page.fill(".long-answer-box", "A full answer covering the key points.");
      await page.click("#checkBtn");
      await page.waitForTimeout(200);
      await page.click("#nextBtn");
      await page.waitForTimeout(100);
    }

    check("mythology.html: the completion panel shows once all questions are done",
      await page.locator("#completionPanel").isVisible());
    await page.click("#backBtn");
    await page.waitForTimeout(150);

    check("mythology.html: progress section appears after a completed session",
      await page.locator("#progressSection").isVisible());
    check("mythology.html: progress summary reports the session score",
      /5\/5/.test(await page.locator("#progressSummary").textContent()));

    const history = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), MYTHOLOGY_HISTORY_KEY);
    check("mythology.html: a completed session is recorded to its own history key", history.length === 1 && history[0].correct === 5);

    const totals = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), MYTHOLOGY_TOTALS_KEY);
    check("mythology.html: all-time totals are tracked in their own key", totals.attempted === 5 && totals.correct === 5);

    // Not written to any of the keys entry-test.html / stats.html use.
    const noCrossContamination = await page.evaluate(() => {
      return localStorage.getItem("entryTestHistory_v1") === null &&
        localStorage.getItem("entryTestSubjectStats_v1") === null;
    });
    check("mythology.html: doesn't write to entry-test.html's history or subject-stats keys", noCrossContamination);

    await page.close();
  }

  // ---- admin.html: the AI Marking settings section (now generic) ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    const providerOptions = await page.locator("#aiProviderInput option").allTextContents();
    check("admin.html: only Claude is offered as a working provider",
      providerOptions.length === 2 && providerOptions.some((t) => /Claude/.test(t)) && !providerOptions.some((t) => /Gemini|Copilot|OpenAI|ChatGPT/.test(t)));

    // Saving without a key first shows an error rather than silently saving.
    await page.click("#saveAiMarkingBtn");
    await page.waitForTimeout(100);
    check("admin.html: saving with no provider/key shows an error",
      (await page.locator("#aiMarkingNote").getAttribute("class") || "").indexOf("is-error") !== -1);

    await page.selectOption("#aiProviderInput", "claude");
    await page.fill("#aiApiKeyInput", "sk-ant-test-key-12345");
    await page.click("#saveAiMarkingBtn");
    await page.waitForTimeout(100);

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), AI_SETTINGS_KEY);
    check("admin.html: saving persists provider and key to the generic aiMarkingSettings_v1 key",
      saved.provider === "claude" && saved.apiKey === "sk-ant-test-key-12345");
    check("admin.html: the save note confirms Greek Mythology is now available",
      /Greek Mythology/.test(await page.locator("#aiMarkingNote").textContent()));

    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);
    check("admin.html: the saved key persists across a reload",
      await page.locator("#aiApiKeyInput").inputValue() === "sk-ant-test-key-12345");

    // "Test key" against a mocked success response.
    await page.route(ANTHROPIC_URL, (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: "OK" }] })
    }));
    await page.click("#testAiMarkingBtn");
    await page.waitForTimeout(200);
    check("admin.html: 'Test key' confirms a working key",
      (await page.locator("#aiMarkingNote").textContent()).indexOf("Key works") !== -1);
    await page.unroute(ANTHROPIC_URL);

    // "Test key" against a mocked failure response.
    await page.route(ANTHROPIC_URL, (route) => route.fulfill({
      status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "invalid x-api-key" } })
    }));
    await page.click("#testAiMarkingBtn");
    await page.waitForTimeout(200);
    check("admin.html: 'Test key' reports a bad key rather than claiming success",
      (await page.locator("#aiMarkingNote").textContent()).indexOf("invalid x-api-key") !== -1);
    await page.unroute(ANTHROPIC_URL);

    // Clearing removes it, and mythology.html reflects that.
    await page.click("#clearAiMarkingBtn");
    await page.waitForTimeout(100);
    const clearedRaw = await page.evaluate((key) => localStorage.getItem(key), AI_SETTINGS_KEY);
    const cleared = JSON.parse(clearedRaw);
    check("admin.html: clearing empties the stored provider/key", !cleared.provider && !cleared.apiKey);

    await page.close();
  }

  // ---- admin.html: "Clear Greek Mythology history" removes only its own keys ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page, { confirmAccept: true });
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.history, JSON.stringify([{ date: new Date().toISOString(), attempted: 5, correct: 4, pct: 80 }]));
      localStorage.setItem(keys.itemStats, JSON.stringify({ abc123: { attempted: 1, correct: 1 } }));
      localStorage.setItem(keys.totals, JSON.stringify({ attempted: 5, correct: 4 }));
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([{ date: new Date().toISOString(), attempted: 10, correct: 8, pct: 80 }]));
    }, { history: MYTHOLOGY_HISTORY_KEY, itemStats: MYTHOLOGY_ITEM_STATS_KEY, totals: MYTHOLOGY_TOTALS_KEY });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.click("#clearMythologyHistoryBtn");
    await page.waitForTimeout(150);

    const afterClear = await page.evaluate((keys) => ({
      history: localStorage.getItem(keys.history),
      itemStats: localStorage.getItem(keys.itemStats),
      totals: localStorage.getItem(keys.totals),
      entryTestHistoryUntouched: localStorage.getItem("entryTestHistory_v1") !== null
    }), { history: MYTHOLOGY_HISTORY_KEY, itemStats: MYTHOLOGY_ITEM_STATS_KEY, totals: MYTHOLOGY_TOTALS_KEY });

    check("admin.html: 'Clear Greek Mythology history' removes its history key", afterClear.history === null);
    check("admin.html: 'Clear Greek Mythology history' removes its item-stats key", afterClear.itemStats === null);
    check("admin.html: 'Clear Greek Mythology history' removes its totals key", afterClear.totals === null);
    check("admin.html: 'Clear Greek Mythology history' leaves entry-test history alone", afterClear.entryTestHistoryUntouched);

    await page.close();
  }

  // ---- admin.html: the API key is left out of backups, but reset clears everything mythology-related ----
  {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathsquiz-test-"));
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-should-not-leave-device" }));
      localStorage.setItem(keys.history, JSON.stringify([{ date: new Date().toISOString(), attempted: 5, correct: 4, pct: 80 }]));
    }, { settings: AI_SETTINGS_KEY, history: MYTHOLOGY_HISTORY_KEY });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#backupBtn")
    ]);
    const backupPath = path.join(downloadDir, "backup.json");
    await download.saveAs(backupPath);
    const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    check("admin.html: the AI marking API key is never included in a downloadable backup",
      !(AI_SETTINGS_KEY in backupContent.data));
    check("admin.html: Greek Mythology history IS included in a downloadable backup",
      MYTHOLOGY_HISTORY_KEY in backupContent.data);

    await page.click("#resetAllBtn");
    await page.waitForTimeout(400);
    const afterReset = await page.evaluate((keys) => ({
      settings: localStorage.getItem(keys.settings),
      history: localStorage.getItem(keys.history)
    }), { settings: AI_SETTINGS_KEY, history: MYTHOLOGY_HISTORY_KEY });
    check("admin.html: 'Reset everything' still clears the AI marking key from this device", afterReset.settings === null);
    check("admin.html: 'Reset everything' also clears Greek Mythology history", afterReset.history === null);

    await context.close();
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }

  // ---- stats.html no longer shows Greek Mythology anywhere ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
    });
    await page.reload();
    await page.waitForTimeout(200);

    const accuracyText = await page.locator("#accuracyList").textContent();
    check("stats.html: 'What you've covered' never mentions Greek Mythology any more",
      !/Greek Mythology|mythology/i.test(accuracyText));

    await page.close();
  }
};
