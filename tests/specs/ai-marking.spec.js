"use strict";

// Covers the "Greek Mythology" long-answer question type and the AI marking
// it depends on: the item bank itself, the picker being gated on a key
// actually being configured, the one-off disclosure panel, the marking
// flow (correct/partial/incorrect verdicts) and its error handling, the
// admin.html "AI Marking" settings section, and the stats.html surfacing
// of it. Every call to Anthropic's API is intercepted with page.route() —
// nothing here ever makes a real network request or costs real money.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { attachDialogHandler } = require("../lib/dialogs");

async function seedPinHash(page, pin){
  return page.evaluate(async (p) => {
    const text = "quiz-app:" + p;
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }, pin);
}

const AI_SETTINGS_KEY = "entryTestAiMarkingSettings_v1";
const AI_DISCLOSURE_KEY = "entryTestAiDisclosureSeen_v1";
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
    await page.goto(baseUrl + "/entry-test.html");
    const info = await page.evaluate(() => {
      var items = window.__entryTestAllItems().filter(function (it){ return it.kind === "long"; });
      var ids = items.map(function (it){ return window.__entryTestItemId(it); });
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
    check("entry-test.html: Greek Mythology bank has 5 questions", info.total === 5);
    check("entry-test.html: every mythology item is tagged subject 'mythology'", info.allMythology);
    check("entry-test.html: every mythology item has a marking rubric", info.allHaveRubric);
    check("entry-test.html: every mythology item has a model answer", info.allHaveModelAnswer);
    check("entry-test.html: every mythology item has prompt text", info.allHavePrompt);
    check("entry-test.html: mythology item ids are unique", info.uniqueIdCount === info.total);
    await page.close();
  }

  // ---- picker: Greek Mythology is greyed out until a key is configured ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(150);

    check("entry-test.html: 'Greek Mythology' is offered on the picker",
      await page.locator('[data-paper="mythology"]').count() === 1);
    check("entry-test.html: Greek Mythology is disabled with no AI marking key set",
      await page.locator("#mythologyPaperBtn").isDisabled());
    check("entry-test.html: its description explains it needs setting up first",
      /Parents \/ Admin/.test(await page.locator("#mythologyPaperDesc").textContent()));

    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
    }, AI_SETTINGS_KEY);
    await page.reload();
    await page.waitForTimeout(150);

    check("entry-test.html: Greek Mythology becomes enabled once a key is configured",
      !(await page.locator("#mythologyPaperBtn").isDisabled()));
    check("entry-test.html: its description now states the question count",
      /5 long-answer question/.test(await page.locator("#mythologyPaperDesc").textContent()));

    await page.close();
  }

  // ---- the one-off AI marking disclosure ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate((key) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
    }, AI_SETTINGS_KEY);
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(150);
    check("entry-test.html: the disclosure panel shows before the first mythology session",
      await page.locator("#aiDisclosureView").isVisible());
    check("entry-test.html: no question is shown yet while the disclosure is up",
      await page.locator("#quizSection").isHidden());

    // "Back" returns to the picker without starting anything or marking it seen.
    await page.click("#aiDisclosureBackBtn");
    await page.waitForTimeout(100);
    check("entry-test.html: 'Back' returns to the picker", await page.locator("#pickerView").isVisible());
    const seenAfterBack = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("entry-test.html: 'Back' does not mark the disclosure as seen", seenAfterBack !== "1");

    // Now go through it properly.
    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(100);
    await page.click("#aiDisclosureContinueBtn");
    await page.waitForTimeout(150);
    check("entry-test.html: 'Continue' proceeds into the session",
      await page.locator("#quizSection").isVisible() && await page.locator("#questionCard").isVisible());
    const seenAfterContinue = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("entry-test.html: 'Continue' marks the disclosure as seen", seenAfterContinue === "1");
    check("entry-test.html: the AI-marked badge shows on a mythology question",
      await page.locator("#qAiBadge").isVisible());

    await page.click("#quitBtn");
    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(150);
    check("entry-test.html: a later visit skips straight past the disclosure",
      await page.locator("#quizSection").isVisible() && await page.locator("#aiDisclosureView").isHidden());

    await page.close();
  }

  // ---- marking flow: a "correct" verdict ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse("correct", "Great, you covered the key facts!")));
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "Zeus is the king of the gods and rules Mount Olympus. He controls thunder.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("entry-test.html: a 'correct' verdict shows correct feedback",
      (await page.locator("#qFeedback").textContent()).indexOf("Great, you covered the key facts!") !== -1);
    check("entry-test.html: a 'correct' verdict marks the question card correct",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") !== -1);
    check("entry-test.html: 'Mark my answer' is hidden after marking", await page.locator("#checkBtn").isHidden());
    check("entry-test.html: 'Next question' appears after marking", await page.locator("#nextBtn").isVisible());

    const subjectStats = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestSubjectStats_v1")));
    check("entry-test.html: a correct mythology answer updates subjectStats.bySubject.mythology",
      subjectStats.bySubject.mythology.attempted === 1 && subjectStats.bySubject.mythology.correct === 1);

    await page.close();
  }

  // ---- marking flow: a "partial" verdict is distinct from both correct and incorrect ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse("partial", "You had the labyrinth right, but missed who built it.")));
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "There was a monster in a maze.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("entry-test.html: a 'partial' verdict is styled distinctly from correct/incorrect",
      (await page.locator("#qFeedback").getAttribute("class")) === "q-feedback is-partial");
    check("entry-test.html: a 'partial' verdict's feedback text comes through",
      (await page.locator("#qFeedback").textContent()).indexOf("missed who built it") !== -1);

    const subjectStats = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestSubjectStats_v1")));
    check("entry-test.html: a partial verdict does not count as correct in subjectStats",
      subjectStats.bySubject.mythology.attempted === 1 && subjectStats.bySubject.mythology.correct === 0);

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
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-paper="mythology"]');
    await page.waitForTimeout(150);
    await page.fill(".long-answer-box", "Athena is the goddess of wisdom.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("entry-test.html: an API error is shown rather than left blank",
      (await page.locator("#qFeedback").textContent()).indexOf("Overloaded") !== -1);
    check("entry-test.html: the answer box is re-enabled so it can be tried again",
      !(await page.locator(".long-answer-box").isDisabled()));
    check("entry-test.html: 'Mark my answer' is available again after a failure",
      await page.locator("#checkBtn").isVisible() && (await page.locator("#checkBtn").textContent()) === "Mark my answer");

    await page.close();
  }

  // ---- admin.html: the AI Marking settings section ----
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
    check("admin.html: saving persists provider and key to entryTestAiMarkingSettings_v1",
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

    // Clearing removes it, and the entry-test picker reflects that.
    await page.click("#clearAiMarkingBtn");
    await page.waitForTimeout(100);
    const clearedRaw = await page.evaluate((key) => localStorage.getItem(key), AI_SETTINGS_KEY);
    const cleared = JSON.parse(clearedRaw);
    check("admin.html: clearing empties the stored provider/key", !cleared.provider && !cleared.apiKey);

    await page.close();
  }

  // ---- admin.html: the API key is left out of backups, but reset still clears it ----
  {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathsquiz-test-"));
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate((key) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-should-not-leave-device" }));
    }, AI_SETTINGS_KEY);
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

    await page.click("#resetAllBtn");
    await page.waitForTimeout(400);
    const afterReset = await page.evaluate((key) => localStorage.getItem(key), AI_SETTINGS_KEY);
    check("admin.html: 'Reset everything' still clears the AI marking key from this device", afterReset === null);

    await context.close();
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }

  // ---- stats.html: Greek Mythology shows up in accuracy and the weak-spot list ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/stats.html");
    const hash = await seedPinHash(page, "1234");
    await page.evaluate((h) => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("quizAppParentPinHash_v1", h);
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: {
          english: { correct: 0, attempted: 0 },
          maths: { correct: 0, attempted: 0 },
          nvr: { correct: 0, attempted: 0 },
          mythology: { correct: 3, attempted: 4 }
        },
        byFormat: { adventure: { correct: 0, attempted: 0 }, beacon: { correct: 0, attempted: 0 } }
      }));
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        m1: {
          outcome: "incorrect", text: "Who is Zeus?", subject: "mythology", format: "long",
          lastSeen: new Date().toISOString(), box: 0, bestBox: 0, dueAt: new Date().toISOString(), regressed: false
        }
      }));
    }, hash);
    await page.reload();
    await page.waitForTimeout(200);

    const accuracyText = await page.locator("#accuracyList").textContent();
    check("stats.html: 'What you've covered' shows Greek Mythology accuracy once attempted",
      /Greek Mythology/.test(accuracyText) && /3\/4/.test(accuracyText));

    // Visible-to-child is on, but the weak-spot list of actual question text
    // still needs the real PIN, same as every other stats.html test.
    await page.click("#weakSpotUnlockBtn");
    await page.waitForTimeout(300);
    const weakSpotText = await page.locator("#weakSpotList").textContent();
    check("stats.html: the weak-spot list tags a missed mythology question 'Greek Mythology'",
      /Greek Mythology/.test(weakSpotText) && /Who is Zeus\?/.test(weakSpotText));

    await page.close();
  }
};
