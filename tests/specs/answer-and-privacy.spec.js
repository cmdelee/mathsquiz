"use strict";

const fs = require("fs");
const path = require("path");

// Covers three specific fixes:
//  1. entry-test.html short answers: currency symbols/formatting ("£",
//     trailing "p", commas) shouldn't be enforced — only the number matters.
//  2. entry-test.html word bank: "forty" vs "fifty" were indistinguishable
//     from the prefix/suffix/sentence alone; the bank entry should no
//     longer be ambiguous.
//  3. stats.html: the specific questions a child needs to practice again
//     should only be visible once unlocked with the real PIN, never just
//     because a parent's turned on PIN-free access for the child.

async function seedPinHash(page, pin){
  return page.evaluate(async (p) => {
    const text = "quiz-app:" + p;
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }, pin);
}

module.exports = async function run({ browser, baseUrl, check }){
  // ---- currency answer checking ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/entry-test.html");

    const item = { answers: ["3.06", "£3.06"] };
    const cases = [
      ["£3.06p", true],
      ["£3.06", true],
      ["3.06", true],
      ["3.06p", true],
      [" £3.06 ", true],
      ["3.07", false],
      ["306", false]
    ];
    for (const [given, expected] of cases){
      const got = await page.evaluate(
        ({ item, given }) => window.__entryTestAnswerCheck(item, given),
        { item, given }
      );
      check("entry-test.html short answer: " + JSON.stringify(given) + " -> " + expected, got === expected);
    }

    // A genuine bare-pence answer ("45p" meaning £0.45) must still only
    // match its own listed forms, not be reinterpreted by the new "strip a
    // trailing p" rule (which only fires once there's already a decimal
    // point, so "45p" itself is untouched).
    const penceItem = { answers: ["45p", "0.45", "£0.45"] };
    const penceGood = await page.evaluate(
      ({ item, given }) => window.__entryTestAnswerCheck(item, given),
      { item: penceItem, given: "45p" }
    );
    check("entry-test.html short answer: bare pence \"45p\" still matches its own answer list", penceGood === true);
    const decimalWithP = await page.evaluate(
      ({ item, given }) => window.__entryTestAnswerCheck(item, given),
      { item: penceItem, given: "0.45p" }
    );
    check("entry-test.html short answer: \"0.45p\" still matches the listed \"0.45\"/\"£0.45\" forms",
      decimalWithP === true);

    // But a bare-pence answer for a DIFFERENT value doesn't get numerically
    // reinterpreted just because it ends in "p" — "5p" only ever matches
    // another exact "5p"-shaped answer, never a "0.05"-style one it wasn't
    // explicitly listed against.
    const penceMismatch = await page.evaluate(
      ({ item, given }) => window.__entryTestAnswerCheck(item, given),
      { item: { answers: ["5p", "0.05", "£0.05"] }, given: "50p" }
    );
    check("entry-test.html short answer: \"50p\" isn't mistaken for the unrelated \"5p\" answer",
      penceMismatch === false);

    // Comma-separated thousands shouldn't matter either.
    const bigItem = { answers: ["2040.00", "£2040.00", "2040", "£2,040.00", "2,040"] };
    const bigOk = await page.evaluate(
      ({ item, given }) => window.__entryTestAnswerCheck(item, given),
      { item: bigItem, given: "£2,040" }
    );
    check("entry-test.html short answer: comma-formatted \"£2,040\" is accepted", bigOk === true);

    await page.close();
  }

  // ---- "forty" spelling item is no longer ambiguous with "fifty" ----
  {
    const source = fs.readFileSync(path.join(__dirname, "..", "..", "entry-test.html"), "utf8");
    check("entry-test.html: \"forty\" word entry no longer uses the ambiguous f___y shape",
      !/word:"forty",\s*prefix:"f",\s*suffix:"y"/.test(source));
    check("entry-test.html: \"forty\" word entry reveals \"fo\" so \"fifty\" no longer fits",
      /word:"forty",\s*prefix:"fo",\s*suffix:""/.test(source));
  }

  // ---- stats.html: weak-spot question text only after a real PIN unlock ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/stats.html");
    const hash = await seedPinHash(page, "1234");
    await page.evaluate((h) => {
      localStorage.clear();
      localStorage.setItem("quizAppParentPinHash_v1", h);
      localStorage.setItem("quizAppStatsVisibleToChild_v1", "1");
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        q1: { outcome: "incorrect", text: "What is 7 x 8?", subject: "maths", format: "adventure", lastSeen: new Date().toISOString() }
      }));
    }, hash);
    await page.reload();
    await page.waitForTimeout(300);

    check("stats.html (child, PIN-free access): opens straight into the stats view",
      await page.locator("#statsView").isVisible());
    check("stats.html (child, PIN-free access): weak-spot question list is empty",
      await page.locator("#weakSpotList .history-row").count() === 0);
    check("stats.html (child, PIN-free access): weak-spot section shows the parent-only note instead",
      await page.locator("#weakSpotLockedNote").isVisible());
    check("stats.html (child, PIN-free access): \"enter PIN to view\" button is offered",
      await page.locator("#weakSpotUnlockBtn").isVisible());

    // A parent entering the PIN just for this section reveals it, without
    // needing to defeat the child's PIN-free access to the rest of the page.
    page.once("dialog", (d) => d.accept("1234"));
    await page.click("#weakSpotUnlockBtn");
    await page.waitForTimeout(300);
    check("stats.html: entering the PIN at the weak-spot prompt reveals the question text",
      await page.locator("#weakSpotList .history-row").count() === 1);
    check("stats.html: the locked note is gone once revealed",
      await page.locator("#weakSpotLockedNote").isHidden());

    await page.close();
  }

  // ---- stats.html: unlocking the whole page with the real PIN shows it immediately ----
  {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/stats.html");
    const hash = await seedPinHash(page, "5678");
    await page.evaluate((h) => {
      localStorage.clear();
      localStorage.setItem("quizAppParentPinHash_v1", h);
      // visible-to-child left off, so the lock screen is shown
      localStorage.setItem("entryTestItemStats_v1", JSON.stringify({
        q1: { outcome: "incorrect", text: "What is 9 x 6?", subject: "maths", format: "beacon", lastSeen: new Date().toISOString() }
      }));
    }, hash);
    await page.reload();
    await page.waitForTimeout(200);

    page.once("dialog", (d) => d.accept("5678"));
    await page.click("#unlockBtn");
    await page.waitForTimeout(300);

    check("stats.html (parent, PIN entered on the main lock screen): weak-spot question text shown directly",
      await page.locator("#weakSpotList .history-row").count() === 1);
    check("stats.html (parent, PIN entered): no separate unlock prompt needed for that section",
      await page.locator("#weakSpotUnlockBtn").isHidden());

    await page.close();
  }
};
