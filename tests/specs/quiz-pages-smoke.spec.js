"use strict";

// Lighter-weight checks for maths-quiz.html and entry-test.html — the two
// pages a child actually answers questions on. Not a full walkthrough of
// question generation (that's a lot of surface area for a repo this size),
// just enough to catch a page failing to load or a broken cross-link.
module.exports = async function run({ browser, baseUrl, check }){
  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await page.goto(baseUrl + "/maths-quiz.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    check("maths-quiz.html: loads without a JS error", consoleErrors.length === 0);
    check("maths-quiz.html: 'My progress' footer link -> stats.html",
      await page.locator('footer a:has-text("My progress")').getAttribute("href") === "stats.html");
    check("maths-quiz.html: 'Parents / Admin' footer link -> admin.html",
      await page.locator('footer a:has-text("Parents / Admin")').getAttribute("href") === "admin.html");
    check("maths-quiz.html: 'Help' footer link -> help.html",
      (await page.locator('footer a:has-text("Help")').getAttribute("href")).indexOf("help.html") === 0);
    check("maths-quiz.html: 'How to multiply & divide' footer link -> how-to.html",
      await page.locator('footer a:has-text("How to multiply")').getAttribute("href") === "how-to.html");

    await page.close();
  }

  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await page.goto(baseUrl + "/entry-test.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    check("entry-test.html: loads without a JS error", consoleErrors.length === 0);
    check("entry-test.html: picker view is shown", await page.locator("#pickerView").isVisible());
    check("entry-test.html: 'My progress' footer link -> stats.html",
      await page.locator('footer a:has-text("My progress")').getAttribute("href") === "stats.html");
    check("entry-test.html: 'Parents / Admin' footer link -> admin.html",
      await page.locator('footer a:has-text("Parents / Admin")').getAttribute("href") === "admin.html");
    check("entry-test.html: 'Help' footer link -> help.html",
      (await page.locator('footer a:has-text("Help")').getAttribute("href")).indexOf("help.html") === 0);

    const bankSize = await page.evaluate(() => localStorage.getItem("entryTestBankSize_v1"));
    check("entry-test.html: writes its question-bank size on load", bankSize !== null && parseInt(bankSize, 10) > 0);

    await page.close();
  }

  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await page.goto(baseUrl + "/mythology.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    check("mythology.html: loads without a JS error", consoleErrors.length === 0);
    check("mythology.html: 'Back to menu' footer link -> index.html",
      await page.locator('footer a:has-text("Back to menu")').getAttribute("href") === "index.html");
    check("mythology.html: 'Parents / Admin' footer link -> admin.html",
      await page.locator('footer a:has-text("Parents / Admin")').getAttribute("href") === "admin.html");
    check("mythology.html: 'Help' footer link -> help.html",
      (await page.locator('footer a:has-text("Help")').getAttribute("href")).indexOf("help.html") === 0);

    await page.close();
  }

  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await page.goto(baseUrl + "/help.html");
    await page.waitForTimeout(200);

    check("help.html: loads without a JS error", consoleErrors.length === 0);
    check("help.html: 'Back to menu' footer link -> index.html",
      await page.locator('footer a:has-text("Back to menu")').getAttribute("href") === "index.html");
    check("help.html: has a jump link for every topic covered elsewhere",
      (await page.locator('.toc-list a').count()) >= 6);
    check("help.html: covers Trivia and AI marking (so those don't need repeating in-app)",
      (await page.locator("#trivia").isVisible()) && (await page.locator("#ai-marking").isVisible()));

    await page.close();
  }

  // ---- how-to.html: the long multiplication/division guide ----
  // Verifies the page loads cleanly and cross-checks the actual worked-example
  // arithmetic shown on the page (not just that some numbers are present) —
  // this is a page explicitly meant to teach the method correctly, so a typo
  // in a worked example would be worse than most other content bugs here.
  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await page.goto(baseUrl + "/how-to.html");
    await page.waitForTimeout(200);

    check("how-to.html: loads without a JS error", consoleErrors.length === 0);
    check("how-to.html: 'Back to menu' footer link -> index.html",
      await page.locator('footer a:has-text("Back to menu")').getAttribute("href") === "index.html");
    check("how-to.html: 'Start the maths quiz' link -> maths-quiz.html",
      await page.locator('a:has-text("Start the maths quiz")').getAttribute("href") === "maths-quiz.html");
    check("how-to.html: covers both long multiplication and long division",
      (await page.locator("#multiplication").isVisible()) && (await page.locator("#division").isVisible()));

    // Each multiplication worked example: factor1 x factor2 = total, and the
    // two partial products shown actually add up to that same total.
    const multResults = await page.locator("#multiplication table.calc-table").evaluateAll((tables) => {
      return tables.map((table) => {
        const rows = [...table.rows]
          .map((tr) => ({
            isRule: tr.className.indexOf("calc-rule") !== -1,
            isTotal: tr.className.indexOf("calc-total") !== -1,
            text: [...tr.cells].map((td) => td.textContent.trim()).join("")
          }))
          .filter((r) => !r.isRule);
        const factor1 = parseInt(rows[0].text, 10);
        const factor2 = parseInt(rows[1].text.replace(/^\D+/, ""), 10);
        const partial1 = parseInt(rows[2].text, 10);
        const partial2 = parseInt(rows[3].text.replace(/^\D+/, ""), 10);
        const totalRow = rows.find((r) => r.isTotal);
        const total = parseInt(totalRow.text, 10);
        return { factor1, factor2, partial1, partial2, total };
      });
    });
    check("how-to.html: found both long multiplication worked examples", multResults.length === 2);
    check("how-to.html: multiplication example 1 (34 x 21) is arithmetically correct",
      multResults[0] && multResults[0].factor1 === 34 && multResults[0].factor2 === 21 &&
      multResults[0].factor1 * multResults[0].factor2 === multResults[0].total &&
      multResults[0].partial1 + multResults[0].partial2 === multResults[0].total);
    check("how-to.html: multiplication example 2 (236 x 14) is arithmetically correct",
      multResults[1] && multResults[1].factor1 === 236 && multResults[1].factor2 === 14 &&
      multResults[1].factor1 * multResults[1].factor2 === multResults[1].total &&
      multResults[1].partial1 + multResults[1].partial2 === multResults[1].total);

    // Each division worked example: every "take away" step is arithmetically
    // consistent with the running total (chunks so far) and what's left, and
    // the whole thing multiplies back out to the original dividend.
    const divResults = await page.locator("#division table.steps-table").evaluateAll((tables) => {
      return tables.map((table) => {
        const rows = [...table.rows].map((tr) => [...tr.cells].map((td) => td.textContent.trim()));
        const startRow = rows[1]; // ["Start", "—", "0", "<dividend>"]
        const dividend = parseInt(startRow[3], 10);
        const stepRows = rows.slice(2, rows.length - 1);
        const finalText = rows[rows.length - 1][0];
        const m = finalText.match(/so (\d+)\s*÷\s*(\d+)\s*=\s*(\d+)/);
        let stepsConsistent = true;
        let runningLeft = dividend;
        let runningChunks = 0;
        let divisorSeen = null;
        stepRows.forEach((row) => {
          const takeAway = row[1].match(/(\d+)\s*×\s*(\d+)\s*=\s*(\d+)/);
          if (!takeAway){ stepsConsistent = false; return; }
          const divisor = parseInt(takeAway[1], 10);
          const multiplier = parseInt(takeAway[2], 10);
          const product = parseInt(takeAway[3], 10);
          if (divisor * multiplier !== product) stepsConsistent = false;
          if (divisorSeen === null) divisorSeen = divisor;
          else if (divisorSeen !== divisor) stepsConsistent = false;
          runningLeft -= product;
          runningChunks += multiplier;
          if (parseInt(row[2], 10) !== runningChunks) stepsConsistent = false;
          if (parseInt(row[3], 10) !== runningLeft) stepsConsistent = false;
        });
        return {
          dividend,
          endsAtZero: runningLeft === 0,
          quotientFromChunks: runningChunks,
          stepsConsistent,
          finalDividend: m ? parseInt(m[1], 10) : NaN,
          divisor: m ? parseInt(m[2], 10) : NaN,
          quotient: m ? parseInt(m[3], 10) : NaN,
          divisorMatchesSteps: m ? parseInt(m[2], 10) === divisorSeen : false
        };
      });
    });
    check("how-to.html: found both long division worked examples", divResults.length === 2);
    [[468, 12, 39], [621, 23, 27]].forEach(([dividend, divisor, quotient], i) => {
      const r = divResults[i];
      check("how-to.html: division example " + (i + 1) + " (" + dividend + " ÷ " + divisor + ") is arithmetically correct",
        r && r.stepsConsistent && r.endsAtZero && r.dividend === dividend && r.finalDividend === dividend &&
        r.divisor === divisor && r.divisorMatchesSteps && r.quotient === quotient && r.quotientFromChunks === quotient &&
        divisor * quotient === dividend);
    });

    await page.close();
  }
};
