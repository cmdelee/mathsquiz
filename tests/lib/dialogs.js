"use strict";

// admin.html and stats.html use window.prompt/confirm/alert for the PIN
// flow and destructive actions (no modal library, to keep the pages
// dependency-free) — Playwright needs a dialog handler or these hang the
// page. `promptAnswer` is what gets typed into any prompt() (defaults to
// the PIN used throughout these tests); confirm()/alert() are always
// accepted. Pass `onAlert` to capture an alert's message for assertions.
function attachDialogHandler(page, opts){
  opts = opts || {};
  const promptAnswer = opts.promptAnswer !== undefined ? opts.promptAnswer : "1234";
  page.on("dialog", (dialog) => {
    if (dialog.type() === "prompt"){
      dialog.accept(promptAnswer);
    } else {
      if (dialog.type() === "alert" && typeof opts.onAlert === "function"){
        opts.onAlert(dialog.message());
      }
      dialog.accept();
    }
  });
}

module.exports = { attachDialogHandler };
