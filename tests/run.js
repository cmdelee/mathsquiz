#!/usr/bin/env node
"use strict";

// Runs every tests/specs/*.spec.js file against a local static copy of the
// app. No test framework — each spec exports an async function receiving
// { browser, baseUrl, check } and calls check(description, condition) for
// every assertion. See tests/README.md for how to run this locally.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./lib/server");
const { createReporter } = require("./lib/reporter");

const ROOT_DIR = path.join(__dirname, "..");
const SPECS_DIR = path.join(__dirname, "specs");

async function main(){
  const { server, baseUrl } = await startServer(ROOT_DIR);
  const launchOptions = {};
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH){
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const browser = await chromium.launch(launchOptions);
  const { check, summary } = createReporter();

  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".spec.js"))
    .sort();

  let ok = true;
  try {
    for (const file of specFiles){
      console.log("\n=== " + file + " ===");
      const spec = require(path.join(SPECS_DIR, file));
      await spec({ browser, baseUrl, check });
    }
  } catch (err){
    console.error("\nTest run threw an error:", err);
    ok = false;
  } finally {
    await browser.close();
    server.close();
  }

  const allPassed = summary();
  process.exit(ok && allPassed ? 0 : 1);
}

main();
