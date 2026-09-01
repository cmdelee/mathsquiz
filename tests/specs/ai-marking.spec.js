"use strict";

// Covers the standalone "Trivia" page (mythology.html — filename kept from
// when it only covered Greek Mythology, now a subject picker across three
// banks: Greek Mythology, Harry Potter, Stranger Things) and the generic AI
// marking settings it shares with any future AI-marked subject: each item
// bank itself, the landing state gated on a key actually being configured,
// the one-off disclosure panel, the GCSE-style marks-based marking flow
// (full/partial/zero marks) and its error handling, its own per-subject
// progress tracking (separate from stats.html), the admin.html "AI Marking"
// section (generic key names, a "Clear Trivia history" control) and the
// backup/reset behaviour around it. Every call to Anthropic's API is
// intercepted with page.route() — nothing here ever makes a real network
// request or costs real money.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { attachDialogHandler } = require("../lib/dialogs");

const AI_SETTINGS_KEY = "aiMarkingSettings_v1";
const AI_DISCLOSURE_KEY = "aiDisclosureSeen_v1";
const TRIVIA_HISTORY_KEY = "triviaHistory_v1";
const TRIVIA_ITEM_STATS_KEY = "triviaItemStats_v1";
const TRIVIA_TOTALS_KEY = "triviaTotals_v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// marksAwarded is whatever the mock hands back; the real page always clamps
// it to the actual item's marksAvailable (item.rubric.length), so a huge
// number reliably means "full marks" and 0 reliably means "zero marks" no
// matter which item was randomly drawn for a given question. 1 reliably
// means "some but not full marks", since every item in the bank has at
// least 2 marks available (see the item-bank check below).
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
  // ---- each item bank is well-formed ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/mythology.html");
    const info = await page.evaluate(() => {
      var subjects = window.__mythologySubjects();
      var out = {};
      subjects.forEach(function (subjectKey){
        var items = window.__mythologyItemsForSubject(subjectKey);
        var ids = items.map(function (it){ return window.__mythologyItemId(it); });
        var uniqueIds = ids.filter(function (id, i){ return ids.indexOf(id) === i; });
        out[subjectKey] = {
          total: items.length,
          allTaggedCorrectly: items.every(function (it){ return it.subject === subjectKey; }),
          allHaveRubric: items.every(function (it){ return Array.isArray(it.rubric) && it.rubric.length > 0; }),
          // Every rubric point is one mark in the GCSE-style scheme (see
          // markLongAnswerWithAi) — at least 2 so a mocked "partial" response
          // of 1 mark is never mistaken for full marks in the tests below.
          allWorthAtLeastTwoMarks: items.every(function (it){ return Array.isArray(it.rubric) && it.rubric.length >= 2; }),
          allHaveModelAnswer: items.every(function (it){ return typeof it.modelAnswer === "string" && it.modelAnswer.length > 0; }),
          allHavePrompt: items.every(function (it){ return typeof it.prompt === "string" && it.prompt.length > 0; }),
          uniqueIdCount: uniqueIds.length
        };
      });
      return { subjects: subjects, banks: out };
    });
    check("mythology.html: exposes exactly the three trivia subjects",
      info.subjects.length === 3 && info.subjects.indexOf("mythology") !== -1 &&
      info.subjects.indexOf("harry-potter") !== -1 && info.subjects.indexOf("stranger-things") !== -1);
    info.subjects.forEach(function (subjectKey){
      const bank = info.banks[subjectKey];
      check("mythology.html: " + subjectKey + " bank has 20 questions", bank.total === 20);
      check("mythology.html: every " + subjectKey + " item is tagged with its own subject", bank.allTaggedCorrectly);
      check("mythology.html: every " + subjectKey + " item has a marking rubric", bank.allHaveRubric);
      check("mythology.html: every " + subjectKey + " item is worth at least 2 marks", bank.allWorthAtLeastTwoMarks);
      check("mythology.html: every " + subjectKey + " item has a model answer", bank.allHaveModelAnswer);
      check("mythology.html: every " + subjectKey + " item has prompt text", bank.allHavePrompt);
      check("mythology.html: " + subjectKey + " item ids are unique", bank.uniqueIdCount === bank.total);
    });
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
    check("mythology.html: the subject picker is hidden until then",
      await page.locator("#subjectPickerCard").isHidden());
    check("mythology.html: the not-set-up card points to Parents / Admin",
      /Parents \/ Admin/.test(await page.locator("#notSetUpCard").textContent()));

    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
    }, AI_SETTINGS_KEY);
    await page.reload();
    await page.waitForTimeout(150);

    check("mythology.html: the subject picker appears once a key is configured",
      await page.locator("#subjectPickerCard").isVisible());
    check("mythology.html: 'not set up yet' card is hidden once a key is configured",
      await page.locator("#notSetUpCard").isHidden());
    check("mythology.html: all three subjects are offered as picker buttons",
      await page.locator(".subject-btn").count() === 3);

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

    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(150);
    check("mythology.html: the disclosure panel shows before the first session",
      await page.locator("#aiDisclosureView").isVisible());
    check("mythology.html: no question is shown yet while the disclosure is up",
      await page.locator("#quizSection").isHidden());

    // "Back" returns to the landing view without starting anything or marking it seen.
    await page.click("#aiDisclosureBackBtn");
    await page.waitForTimeout(100);
    check("mythology.html: 'Back' returns to the subject picker", await page.locator("#subjectPickerCard").isVisible());
    const seenAfterBack = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("mythology.html: 'Back' does not mark the disclosure as seen", seenAfterBack !== "1");

    // Now go through it properly.
    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(100);
    await page.click("#aiDisclosureContinueBtn");
    await page.waitForTimeout(150);
    check("mythology.html: 'Continue' proceeds into the session",
      await page.locator("#quizSection").isVisible() && await page.locator("#questionCard").isVisible());
    const seenAfterContinue = await page.evaluate((key) => localStorage.getItem(key), AI_DISCLOSURE_KEY);
    check("mythology.html: 'Continue' marks the disclosure as seen", seenAfterContinue === "1");
    check("mythology.html: the AI-marked badge shows on the question",
      await page.locator(".ai-badge").isVisible());
    check("mythology.html: the question title reflects the chosen subject",
      (await page.locator("#quizTitle").textContent()).indexOf("Greek Mythology") !== -1);

    await page.click("#quitBtn");
    await page.click('[data-subject="harry-potter"]');
    await page.waitForTimeout(150);
    check("mythology.html: a later visit (any subject) skips straight past the disclosure",
      await page.locator("#quizSection").isVisible() && await page.locator("#aiDisclosureView").isHidden());
    check("mythology.html: picking a different subject shows that subject's name",
      (await page.locator("#quizTitle").textContent()).indexOf("Harry Potter") !== -1);

    await page.close();
  }

  // ---- marking flow: full marks ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse(FULL_MARKS, "Great, you covered the key facts!")));
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
    const marksAvailable = await page.evaluate(() => window.__mythologyCurrentQueue()[0].rubric.length);
    check("mythology.html: the marks badge shows how many marks the current question is worth",
      (await page.locator("#marksBadge").textContent()).indexOf(String(marksAvailable)) !== -1);

    await page.fill(".long-answer-box", "Zeus is the king of the gods and rules Mount Olympus. He controls thunder.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: full marks shows the mark fraction and feedback",
      (await page.locator("#qFeedback").textContent()) ===
      marksAvailable + "/" + marksAvailable + " marks — Great, you covered the key facts!");
    check("mythology.html: full marks marks the question card correct",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") !== -1);
    check("mythology.html: 'Mark my answer' is hidden after marking", await page.locator("#checkBtn").isHidden());
    check("mythology.html: 'Next question' appears after marking", await page.locator("#nextBtn").isVisible());

    await page.click("#nextBtn");
    await page.waitForTimeout(100);
    await page.click("#quitBtn");
    await page.waitForTimeout(100);

    const itemStats = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TRIVIA_ITEM_STATS_KEY);
    check("mythology.html: a marked answer is recorded under its subject in the shared item-stats key (not stats.html's keys)",
      itemStats.mythology && Object.keys(itemStats.mythology).length === 1);
    const recordedStat = itemStats.mythology[Object.keys(itemStats.mythology)[0]];
    check("mythology.html: the recorded item stat carries marksAwarded/marksAvailable, clamped to the question's own scheme",
      recordedStat.marksAwarded === marksAvailable && recordedStat.marksAvailable === marksAvailable);

    await page.close();
  }

  // ---- marking flow: partial marks are distinct from both full and zero ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse(1, "You had the labyrinth right, but missed who built it.")));
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
    await page.fill(".long-answer-box", "There was a monster in a maze.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: partial marks are styled distinctly from full/zero",
      (await page.locator("#qFeedback").getAttribute("class")) === "q-feedback is-partial");
    check("mythology.html: partial marks show a 1/N fraction and the feedback text",
      /^1\/\d+ marks — .*missed who built it/.test(await page.locator("#qFeedback").textContent()));
    check("mythology.html: partial marks don't mark the question card correct",
      (await page.locator("#questionCard").getAttribute("class") || "").indexOf("is-correct") === -1);

    await page.close();
  }

  // ---- marking flow: zero marks ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => route.fulfill(claudeResponse(0, "Not quite — that's not what this question is about.")));
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
    await page.fill(".long-answer-box", "I don't know.");
    await page.click("#checkBtn");
    await page.waitForTimeout(200);

    check("mythology.html: zero marks are styled as incorrect, not partial",
      (await page.locator("#qFeedback").getAttribute("class")) === "q-feedback is-incorrect");
    check("mythology.html: zero marks show a 0/N fraction and the feedback text",
      /^0\/\d+ marks — Not quite/.test(await page.locator("#qFeedback").textContent()));

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

    await page.click('[data-subject="mythology"]');
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

  // ---- its own progress tracking, per subject, separate from stats.html ----
  {
    const page = await browser.newPage();
    let markingCalls = 0;
    await page.route(ANTHROPIC_URL, (route) => {
      markingCalls++;
      return route.fulfill(claudeResponse(FULL_MARKS, "Nice work."));
    });
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    check("mythology.html: progress section is hidden before any session", await page.locator("#progressSection").isHidden());

    await page.click('[data-subject="mythology"]');
    await page.waitForTimeout(150);
    const queueBefore = await page.evaluate(() => window.__mythologyCurrentQueue());
    check("mythology.html: a session always draws exactly 5 questions from a 20-question bank",
      queueBefore.length === 5);
    const totalMarksAvailable = queueBefore.reduce((sum, item) => sum + item.rubric.length, 0);

    for (let i = 0; i < 5; i++){
      await page.fill(".long-answer-box", "A full answer covering the key points.");
      await page.click("#checkBtn");
      await page.waitForTimeout(200);
      await page.click("#nextBtn");
      await page.waitForTimeout(100);
    }

    check("mythology.html: the completion panel shows once all questions are done",
      await page.locator("#completionPanel").isVisible());
    check("mythology.html: the completion panel reports the full marks total across all 5 questions",
      (await page.locator("#completionStats").textContent()).indexOf(
        "You scored " + totalMarksAvailable + " out of " + totalMarksAvailable + " marks (100%) across 5 questions.") !== -1);
    check("mythology.html: a perfect session shows a well-done tip rather than a generated one",
      await page.locator("#sessionTip").isVisible() &&
      /keep it up/i.test(await page.locator("#sessionTipText").textContent()));
    check("mythology.html: a perfect session doesn't spend a 6th AI call generating a tip",
      markingCalls === 5);
    await page.click("#backBtn");
    await page.waitForTimeout(150);

    check("mythology.html: progress section appears after a completed session",
      await page.locator("#progressSection").isVisible());
    check("mythology.html: the per-subject progress list reports Greek Mythology's session score in marks",
      /Greek Mythology/.test(await page.locator("#progressSummaryList").textContent()) &&
      (await page.locator("#progressSummaryList").textContent()).indexOf(
        totalMarksAvailable + "/" + totalMarksAvailable + " marks") !== -1);

    const history = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TRIVIA_HISTORY_KEY);
    check("mythology.html: a completed session is recorded under its subject in the shared history key, in marks",
      Array.isArray(history.mythology) && history.mythology.length === 1 &&
      history.mythology[0].marksEarned === totalMarksAvailable && history.mythology[0].marksAvailable === totalMarksAvailable);

    const totals = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TRIVIA_TOTALS_KEY);
    check("mythology.html: all-time totals are tracked per subject in the shared totals key, in marks",
      totals.mythology && totals.mythology.marksEarned === totalMarksAvailable && totals.mythology.marksAvailable === totalMarksAvailable);

    // Not written to any of the keys entry-test.html / stats.html use.
    const noCrossContamination = await page.evaluate(() => {
      return localStorage.getItem("entryTestHistory_v1") === null &&
        localStorage.getItem("entryTestSubjectStats_v1") === null;
    });
    check("mythology.html: doesn't write to entry-test.html's history or subject-stats keys", noCrossContamination);

    await page.close();
  }

  // ---- session tip: a mixed (not perfect) session gets an AI-generated, pattern-spotting tip ----
  {
    const page = await browser.newPage();
    let markingCallCount = 0;
    let tipCallCount = 0;
    // The tip request is gated so the loading state can be checked
    // deterministically before it's allowed to resolve, rather than racing
    // a fixed timeout against however fast the mocked route replies.
    let resolveTipGate;
    const tipGate = new Promise((resolve) => { resolveTipGate = resolve; });
    await page.route(ANTHROPIC_URL, async (route) => {
      const postData = route.request().postDataJSON();
      const userContent = postData && postData.messages && postData.messages[0] && postData.messages[0].content;
      const isTipRequest = typeof userContent === "string" && userContent.indexOf("Her answer:") !== -1;
      if (isTipRequest){
        tipCallCount++;
        await tipGate;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ content: [{ type: "text", text: "Try to include specific names and dates, not just the general idea." }] })
        });
      }
      markingCallCount++;
      // Alternate full/zero marks so this session isn't a perfect sweep.
      const marksAwarded = markingCallCount % 2 === 0 ? 0 : FULL_MARKS;
      return route.fulfill(claudeResponse(marksAwarded, marksAwarded ? "Nice work." : "Missing some detail."));
    });
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-subject="harry-potter"]');
    await page.waitForTimeout(150);
    for (let i = 0; i < 5; i++){
      await page.fill(".long-answer-box", "An answer that's a bit vague.");
      await page.click("#checkBtn");
      await page.waitForTimeout(200);
      await page.click("#nextBtn");
      await page.waitForTimeout(100);
    }

    check("mythology.html: the tip box shows a loading placeholder as soon as a mixed session completes",
      await page.locator("#sessionTip").isVisible() &&
      (await page.locator("#sessionTipText").getAttribute("class") || "").indexOf("is-loading") !== -1);
    check("mythology.html: the tip request has been made (held, not yet resolved)", tipCallCount === 1);

    resolveTipGate();
    await page.waitForTimeout(300); // give the now-released tip request time to resolve

    check("mythology.html: a mixed session makes exactly one extra AI call to generate the tip", tipCallCount === 1);
    check("mythology.html: the tip box shows the AI-generated tip once it resolves",
      (await page.locator("#sessionTipText").textContent()).indexOf("specific names and dates") !== -1);
    check("mythology.html: the tip box drops the loading style once resolved",
      (await page.locator("#sessionTipText").getAttribute("class") || "") === "session-tip-text");

    await page.close();
  }

  // ---- session tip: a failed tip request just hides the tip box, not an error ----
  {
    const page = await browser.newPage();
    await page.route(ANTHROPIC_URL, (route) => {
      const postData = route.request().postDataJSON();
      const userContent = postData && postData.messages && postData.messages[0] && postData.messages[0].content;
      const isTipRequest = typeof userContent === "string" && userContent.indexOf("Her answer:") !== -1;
      if (isTipRequest){
        return route.fulfill({
          status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Overloaded." } })
        });
      }
      return route.fulfill(claudeResponse(0, "Missing some detail."));
    });
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-test-key" }));
      localStorage.setItem(keys.disclosure, "1");
    }, { settings: AI_SETTINGS_KEY, disclosure: AI_DISCLOSURE_KEY });
    await page.reload();
    await page.waitForTimeout(150);

    await page.click('[data-subject="stranger-things"]');
    await page.waitForTimeout(150);
    for (let i = 0; i < 5; i++){
      await page.fill(".long-answer-box", "An answer that's a bit vague.");
      await page.click("#checkBtn");
      await page.waitForTimeout(200);
      await page.click("#nextBtn");
      await page.waitForTimeout(100);
    }

    check("mythology.html: the completion panel still shows normally even when the tip request fails",
      await page.locator("#completionPanel").isVisible());

    await page.waitForTimeout(300); // give the failed tip request time to reject

    check("mythology.html: a failed tip request hides the tip box rather than showing an error",
      await page.locator("#sessionTip").isHidden());

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
    check("admin.html: the save note confirms Trivia is now available",
      /Trivia/.test(await page.locator("#aiMarkingNote").textContent()));

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

  // ---- admin.html: "Clear Trivia history" removes only its own keys, across all subjects ----
  {
    const page = await browser.newPage();
    attachDialogHandler(page, { confirmAccept: true });
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.history, JSON.stringify({
        mythology: [{ date: new Date().toISOString(), marksEarned: 14, marksAvailable: 18, pct: 78 }],
        "harry-potter": [{ date: new Date().toISOString(), marksEarned: 18, marksAvailable: 18, pct: 100 }]
      }));
      localStorage.setItem(keys.itemStats, JSON.stringify({ mythology: { abc123: { marksAwarded: 3, marksAvailable: 4 } } }));
      localStorage.setItem(keys.totals, JSON.stringify({ mythology: { marksEarned: 14, marksAvailable: 18 } }));
      localStorage.setItem("entryTestHistory_v1", JSON.stringify([{ date: new Date().toISOString(), attempted: 10, correct: 8, pct: 80 }]));
    }, { history: TRIVIA_HISTORY_KEY, itemStats: TRIVIA_ITEM_STATS_KEY, totals: TRIVIA_TOTALS_KEY });
    await page.reload();
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    await page.click("#clearTriviaHistoryBtn");
    await page.waitForTimeout(150);

    const afterClear = await page.evaluate((keys) => ({
      history: localStorage.getItem(keys.history),
      itemStats: localStorage.getItem(keys.itemStats),
      totals: localStorage.getItem(keys.totals),
      entryTestHistoryUntouched: localStorage.getItem("entryTestHistory_v1") !== null
    }), { history: TRIVIA_HISTORY_KEY, itemStats: TRIVIA_ITEM_STATS_KEY, totals: TRIVIA_TOTALS_KEY });

    check("admin.html: 'Clear Trivia history' removes the shared history key (all subjects)", afterClear.history === null);
    check("admin.html: 'Clear Trivia history' removes the shared item-stats key (all subjects)", afterClear.itemStats === null);
    check("admin.html: 'Clear Trivia history' removes the shared totals key (all subjects)", afterClear.totals === null);
    check("admin.html: 'Clear Trivia history' leaves entry-test history alone", afterClear.entryTestHistoryUntouched);

    await page.close();
  }

  // ---- admin.html: the API key is left out of backups, but reset clears everything trivia-related ----
  {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathsquiz-test-"));
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    attachDialogHandler(page);
    await page.goto(baseUrl + "/admin.html");
    await page.evaluate((keys) => {
      localStorage.clear();
      localStorage.setItem(keys.settings, JSON.stringify({ provider: "claude", apiKey: "sk-ant-should-not-leave-device" }));
      localStorage.setItem(keys.history, JSON.stringify({ mythology: [{ date: new Date().toISOString(), marksEarned: 14, marksAvailable: 18, pct: 78 }] }));
      // A device that hasn't opened mythology.html since the update yet — still on the old legacy keys.
      localStorage.setItem("mythologyHistory_v1", JSON.stringify([{ date: new Date().toISOString(), attempted: 5, correct: 4, pct: 80 }]));
    }, { settings: AI_SETTINGS_KEY, history: TRIVIA_HISTORY_KEY });
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
    check("admin.html: Trivia history IS included in a downloadable backup",
      TRIVIA_HISTORY_KEY in backupContent.data);

    await page.click("#resetAllBtn");
    await page.waitForTimeout(400);
    const afterReset = await page.evaluate((keys) => ({
      settings: localStorage.getItem(keys.settings),
      history: localStorage.getItem(keys.history),
      legacyHistory: localStorage.getItem("mythologyHistory_v1")
    }), { settings: AI_SETTINGS_KEY, history: TRIVIA_HISTORY_KEY });
    check("admin.html: 'Reset everything' still clears the AI marking key from this device", afterReset.settings === null);
    check("admin.html: 'Reset everything' also clears Trivia history", afterReset.history === null);
    check("admin.html: 'Reset everything' also clears legacy single-subject mythology keys", afterReset.legacyHistory === null);

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
