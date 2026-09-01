"use strict";

// Sanity checks for the expanded (~5000-item) entry-test question bank:
// overall size, no duplicate prompts, and that every item is internally
// well-formed (mcq correct-index in range, short answers non-empty).
// Not a re-check of every generated item's arithmetic - the generator
// script computes each answer from the same numbers used in the prompt,
// so correctness is guaranteed by construction - just a structural and
// uniqueness safety net so a future bulk edit can't silently corrupt
// the bank without a test noticing.
module.exports = async function run({ browser, baseUrl, check }){
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.goto(baseUrl + "/entry-test.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(200);

  check("entry-test.html: loads without a JS error with the expanded bank", consoleErrors.length === 0);

  const bankSize = await page.evaluate(() => parseInt(localStorage.getItem("entryTestBankSize_v1"), 10));
  check("entry-test.html: overall bank size has grown to roughly 5000", bankSize >= 4800 && bankSize <= 5500);

  const dupInfo = await page.evaluate(() => {
    if (!window.__entryTestAllItems) return null;
    var items = window.__entryTestAllItems();
    var seen = Object.create(null);
    var dupCount = 0;
    items.forEach(function(it){
      // NVR items share their prompt text across many questions (a
      // handful of phrasings like "Which one does not belong?" cover all
      // of them) — the prompt alone isn't a meaningful uniqueness key for
      // those, so fingerprint the actual figures instead.
      var key = it.kind === "nvr"
        ? "nvr|" + it.subKind + "|" + (it.framesSvg || []).join("") + "|" + it.options.join("")
        : it.kind + "|" + (it.prompt || it.sentence || "");
      if (seen[key]) dupCount++;
      seen[key] = true;
    });
    return { total: items.length, dupCount: dupCount };
  });

  if (dupInfo){
    check("entry-test.html: no duplicate prompts in the expanded bank", dupInfo.dupCount === 0);

    const structuralIssues = await page.evaluate(() => {
      var items = window.__entryTestAllItems();
      var bad = 0;
      items.forEach(function(it){
        if (it.kind === "mcq"){
          if (!Array.isArray(it.options) || it.options.length < 2) bad++;
          if (typeof it.correct !== "number" || it.correct < 0 || it.correct >= it.options.length) bad++;
        } else if (it.kind === "short"){
          if (!Array.isArray(it.answers) || it.answers.length === 0) bad++;
        } else if (it.kind === "spell"){
          if (!it.word || typeof it.prefix !== "string" || typeof it.suffix !== "string") bad++;
        } else if (it.kind === "nvr"){
          if (!Array.isArray(it.options) || it.options.length < 4) bad++;
          if (typeof it.correct !== "number" || it.correct < 0 || it.correct >= it.options.length) bad++;
          if (!it.correctDescription) bad++;
          if (it.subKind === "sequence" && (!Array.isArray(it.framesSvg) || it.framesSvg.length !== 4)) bad++;
        }
      });
      return bad;
    });
    check("entry-test.html: every item in the expanded bank is structurally well-formed", structuralIssues === 0);
  }

  await page.close();
};
