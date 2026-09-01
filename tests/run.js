#!/usr/bin/env node
"use strict";

// Runs every tests/specs/*.spec.js file against a local static copy of the
// app. No test framework — each spec exports an async function receiving
// { browser, baseUrl, check } and calls check(description, condition) for
// every assertion. See tests/README.md for how to run this locally.
//
// By default this runs against Chromium only (fast, good for local
// iteration). Pass --browsers=chromium,firefox,webkit (or `npm run
// test:cross-browser`) to run the same specs against all three engines —
// useful since this is a PWA installed on a mix of devices, not just one
// browser.

const fs = require("fs");
const path = require("path");
const playwright = require("playwright");
const { startServer } = require("./lib/server");
const { createReporter } = require("./lib/reporter");

const ROOT_DIR = path.join(__dirname, "..");
const SPECS_DIR = path.join(__dirname, "specs");

const ENGINE_EXECUTABLE_ENV = {
  chromium: "PLAYWRIGHT_CHROMIUM_PATH",
  firefox: "PLAYWRIGHT_FIREFOX_PATH",
  webkit: "PLAYWRIGHT_WEBKIT_PATH"
};

function parseBrowsers(argv){
  const arg = argv.find((a) => a.startsWith("--browsers="));
  const raw = arg ? arg.slice("--browsers=".length) : "chromium";
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const name of names){
    if (!playwright[name]){
      throw new Error("Unknown browser \"" + name + "\" — expected chromium, firefox, or webkit.");
    }
  }
  return names;
}

async function main(){
  const browserNames = parseBrowsers(process.argv.slice(2));
  const { server, baseUrl } = await startServer(ROOT_DIR);
  const { check, summary } = createReporter();

  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".spec.js"))
    .sort();

  let ok = true;
  try {
    for (const engineName of browserNames){
      console.log("\n########## " + engineName + " ##########");
      const launchOptions = {};
      const envVar = ENGINE_EXECUTABLE_ENV[engineName];
      if (envVar && process.env[envVar]){
        launchOptions.executablePath = process.env[envVar];
      }
      const browser = await playwright[engineName].launch(launchOptions);
      const taggedCheck = (desc, cond) => check("[" + engineName + "] " + desc, cond);

      try {
        for (const file of specFiles){
          console.log("\n=== " + file + " ===");
          const spec = require(path.join(SPECS_DIR, file));
          await spec({ browser, baseUrl, check: taggedCheck });
        }
      } finally {
        await browser.close();
      }
    }
  } catch (err){
    console.error("\nTest run threw an error:", err);
    ok = false;
  } finally {
    server.close();
  }

  const allPassed = summary();
  process.exit(ok && allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
