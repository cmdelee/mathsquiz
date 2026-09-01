"use strict";

// Covers the new "NVR practice" (non-verbal reasoning) question type on
// entry-test.html: figure sequences and odd-one-out sets rendered as
// inline SVGs rather than text. Kept as its own paper (not folded into
// Mixed practice/Mock exam, which are explicitly the Adventure/Beacon FSCE
// formats), but still eligible for Spaced review and general item-stats
// tracking once practiced, same as every other question type.

module.exports = async function run({ browser, baseUrl, check }){
  // ---- picker: NVR practice is offered as its own option ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    check("entry-test.html: 'NVR practice' is offered on the picker",
      await page.locator('[data-paper="nvr"]').count() === 1);
    await page.close();
  }

  // ---- the item bank actually contains NVR items, well-formed ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    const info = await page.evaluate(() => {
      var items = window.__entryTestAllItems().filter(function (it){ return it.kind === "nvr"; });
      var seq = items.filter(function (it){ return it.subKind === "sequence"; });
      var odd = items.filter(function (it){ return it.subKind === "oddoneout"; });
      var ids = items.slice(0, 40).map(function (it){ return window.__entryTestItemId(it); });
      var uniqueIds = ids.filter(function (id, i){ return ids.indexOf(id) === i; });
      return {
        total: items.length,
        seqCount: seq.length,
        oddCount: odd.length,
        seqFramesOk: seq.every(function (it){ return Array.isArray(it.framesSvg) && it.framesSvg.length === 4; }),
        seqOptionsOk: seq.every(function (it){ return it.options.length === 4; }),
        oddOptionsOk: odd.every(function (it){ return it.options.length === 5; }),
        uniqueIdCount: uniqueIds.length,
        sampledCount: ids.length
      };
    });
    check("entry-test.html: NVR bank has a meaningful number of items", info.total >= 150);
    check("entry-test.html: NVR bank has both sequence and odd-one-out items", info.seqCount > 0 && info.oddCount > 0);
    check("entry-test.html: every sequence item has exactly 4 known frames", info.seqFramesOk);
    check("entry-test.html: every sequence item has exactly 4 options", info.seqOptionsOk);
    check("entry-test.html: every odd-one-out item has exactly 5 options", info.oddOptionsOk);
    // Prompt text repeats across NVR items by design (a handful of shared
    // phrasings) — itemId() has its own content-based fallback for "nvr"
    // specifically so it doesn't collide the way a prompt-based id would.
    check("entry-test.html: item ids for different NVR items are (almost all) distinct despite shared prompt text",
      info.uniqueIdCount >= info.sampledCount - 2);
    await page.close();
  }

  // ---- starting NVR practice draws only from the NVR pool ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.click('[data-paper="nvr"]');
    await page.waitForTimeout(150);
    const allNvr = await page.evaluate(() => window.__entryTestCurrentQueue().every((it) => it.subject === "nvr"));
    check("entry-test.html: an NVR practice session draws only NVR items", allNvr);
    check("entry-test.html: the session is titled 'NVR practice'",
      (await page.locator("#quizTitle").textContent()).trim() === "NVR practice");
    check("entry-test.html: the question is tagged 'NVR practice'",
      (await page.locator("#qTag").textContent()).trim() === "NVR practice");
    await page.close();
  }

  // ---- Mixed practice and Mock exam stay Adventure/Beacon only ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.click('[data-paper="mixed"]');
    await page.waitForTimeout(150);
    const mixedHasNoNvr = await page.evaluate(() => window.__entryTestCurrentQueue().every((it) => it.subject !== "nvr"));
    check("entry-test.html: Mixed practice never draws NVR items", mixedHasNoNvr);
    await page.click("#quitBtn");
    await page.click('[data-paper="mock"]');
    await page.waitForTimeout(150);
    const mockHasNoNvr = await page.evaluate(() => window.__entryTestCurrentQueue().every((it) => it.subject !== "nvr"));
    check("entry-test.html: Mock exam never draws NVR items", mockHasNoNvr);
    await page.close();
  }

  // ---- rendering: figures show up as actual SVGs, sequence has a frames row, answering scores correctly ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.click('[data-paper="nvr"]');
    await page.waitForTimeout(150);

    var sawSequence = false;
    var sawOddOneOut = false;
    for (let i = 0; i < 8; i++){
      const optionCount = await page.locator(".nvr-option").count();
      check("entry-test.html (NVR q" + i + "): renders at least 4 lettered figure options", optionCount >= 4);
      const svgCount = await page.locator(".nvr-option-figure svg").count();
      check("entry-test.html (NVR q" + i + "): every option shows an actual rendered figure", svgCount === optionCount);

      const framesVisible = await page.locator(".nvr-frames").count();
      if (framesVisible > 0){
        sawSequence = true;
        check("entry-test.html (NVR q" + i + "): a sequence question shows exactly 4 known frames",
          await page.locator(".nvr-frame:not(.nvr-frame-unknown)").count() === 4);
        check("entry-test.html (NVR q" + i + "): a sequence question ends with the '?' unknown frame",
          await page.locator(".nvr-frame-unknown").count() === 1);
      } else if (optionCount === 5){
        sawOddOneOut = true;
      }

      // Answer with the first option and move on.
      await page.click(".nvr-option >> nth=0");
      await page.waitForTimeout(80);
      const nextVisible = await page.locator("#nextBtn").isVisible();
      if (nextVisible){
        await page.click("#nextBtn");
        await page.waitForTimeout(80);
      } else {
        break; // session ended
      }
    }
    check("entry-test.html: across a short NVR session we saw at least one sequence question", sawSequence);
    check("entry-test.html: across a short NVR session we saw at least one odd-one-out question", sawOddOneOut);

    await page.close();
  }

  // ---- answering an NVR question records subject stats under "nvr" ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(150);
    await page.click('[data-paper="nvr"]');
    await page.waitForTimeout(150);
    await page.click(".nvr-option >> nth=0");
    await page.waitForTimeout(100);

    const subjectStats = await page.evaluate(() => JSON.parse(localStorage.getItem("entryTestSubjectStats_v1")));
    check("entry-test.html: answering an NVR question updates subjectStats.bySubject.nvr",
      subjectStats && subjectStats.bySubject && subjectStats.bySubject.nvr && subjectStats.bySubject.nvr.attempted === 1);

    await page.close();
  }

  // ---- stats.html: NVR accuracy is surfaced once something's been attempted ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/stats.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("entryTestSubjectStats_v1", JSON.stringify({
        bySubject: { english: { correct: 0, attempted: 0 }, maths: { correct: 0, attempted: 0 }, nvr: { correct: 4, attempted: 5 } },
        byFormat: { adventure: { correct: 0, attempted: 0 }, beacon: { correct: 0, attempted: 0 } }
      }));
    });
    await page.reload();
    await page.waitForTimeout(200);
    const accuracyText = await page.locator("#accuracyList").textContent();
    check("stats.html: 'What you've covered' shows NVR accuracy once attempted",
      /NVR/.test(accuracyText) && /4\/5/.test(accuracyText));
    await page.close();
  }
};
