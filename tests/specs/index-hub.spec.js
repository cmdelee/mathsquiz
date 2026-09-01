"use strict";

module.exports = async function run({ browser, baseUrl, check }){
  // ---- nav links point at the right pages ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const adminHref = await page.locator("a.nav-card.is-admin").getAttribute("href");
    const statsHref = await page.locator("a.nav-card.is-stats").getAttribute("href");
    const mathsHref = await page.locator("a.nav-card.is-maths").getAttribute("href");
    const examHref = await page.locator("a.nav-card.is-exam").getAttribute("href");
    const triviaHref = await page.locator("a.nav-card.is-trivia").getAttribute("href");
    const howtoHref = await page.locator("a.nav-card.is-howto").getAttribute("href");
    check("index.html: maths card -> maths-quiz.html", mathsHref === "maths-quiz.html");
    check("index.html: exam card -> entry-test.html", examHref === "entry-test.html");
    check("index.html: trivia card -> mythology.html", triviaHref === "mythology.html");
    check("index.html: stats card -> stats.html", statsHref === "stats.html");
    check("index.html: admin card -> admin.html", adminHref === "admin.html");
    check("index.html: 'How to multiply & divide' card -> how-to.html", howtoHref === "how-to.html");

    const examCardVisible = await page.locator("#examNavCard").isVisible();
    check("index.html: exam card visible with no exam date set", examCardVisible);

    const helpHref = await page.locator('footer a:has-text("Help")').getAttribute("href");
    check("index.html: footer 'Help' link -> help.html", helpHref.indexOf("help.html") === 0);

    await page.close();
  }

  // ---- trivia "last time" teaser covers all four subjects, Red Dwarf included ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => {
      localStorage.clear();
      // Red Dwarf's session is the most recent of the four by date — the
      // teaser should surface this one, not silently skip it.
      localStorage.setItem("triviaHistory_v1", JSON.stringify({
        "mythology": [{ date: "2024-01-01T00:00:00.000Z", marksEarned: 10, marksAvailable: 20, pct: 50 }],
        "red-dwarf": [{ date: "2024-06-01T00:00:00.000Z", marksEarned: 18, marksAvailable: 20, pct: 90 }]
      }));
    });
    await page.reload();

    const teaserText = await page.locator("#mythologyTeaser").textContent();
    check("index.html: trivia teaser picks the most recent session across all subjects (Red Dwarf included)",
      teaserText.indexOf("Red Dwarf") !== -1 && teaserText.indexOf("18/20") !== -1);

    await page.close();
  }

  // ---- exam card hides once the saved exam date is in the past ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: "2020-01-01" }));
    });
    await page.reload();

    const examCardHidden = await page.locator("#examNavCard").isHidden();
    check("index.html: exam card hidden once exam date has passed", examCardHidden);

    await page.close();
  }

  // ---- exam card stays visible on the exam day itself and for a future date ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    const today = new Date();
    const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    await page.evaluate((d) => {
      localStorage.clear();
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: d }));
    }, todayStr);
    await page.reload();

    const examCardVisibleToday = await page.locator("#examNavCard").isVisible();
    check("index.html: exam card still visible on the exam date itself", examCardVisibleToday);

    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureStr = future.getFullYear() + "-" + String(future.getMonth() + 1).padStart(2, "0") + "-" + String(future.getDate()).padStart(2, "0");
    await page.evaluate((d) => {
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: d }));
    }, futureStr);
    await page.reload();
    const examCardVisibleFuture = await page.locator("#examNavCard").isVisible();
    check("index.html: exam card visible for a future exam date", examCardVisibleFuture);

    await page.close();
  }

  // ---- entry-test.html itself still works directly even once "expired" ----
  // (nothing is deleted — only the hub card disappears)
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/index.html");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("entryTestExamDateSettings_v1", JSON.stringify({ date: "2020-01-01" }));
    });
    await page.goto(baseUrl + "/entry-test.html");
    const pickerVisible = await page.locator("#pickerView").isVisible();
    check("entry-test.html: still fully reachable and functional directly, even with a past exam date", pickerVisible);
    await page.close();
  }
};
