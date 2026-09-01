"use strict";

// A minimal pass/fail reporter shared across spec files — no test framework,
// just a counter and console output, matching the rest of this repo's
// no-build-step philosophy.
function createReporter(){
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(desc, cond){
    if (cond){
      passed++;
      console.log("  PASS: " + desc);
    } else {
      failed++;
      failures.push(desc);
      console.log("  FAIL: " + desc);
    }
  }

  function summary(){
    console.log("\n" + passed + " passed, " + failed + " failed");
    if (failures.length){
      console.log("\nFailed checks:");
      failures.forEach((f) => console.log("  - " + f));
    }
    return failed === 0;
  }

  return { check, summary };
}

module.exports = { createReporter };
