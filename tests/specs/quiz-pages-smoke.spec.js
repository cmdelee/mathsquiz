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
};
