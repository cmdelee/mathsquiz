// A tiny dependency-free static file server, just for serving the app's
// own files (repo root) to Playwright during tests. No framework needed —
// the app itself has no build step, so the tests shouldn't need one either.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

// Starts a server rooted at `rootDir` on an OS-assigned free port.
// Returns { server, baseUrl } — call server.close() when done.
function startServer(rootDir){
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(rootDir, urlPath);

      // Don't serve anything outside rootDir.
      if (!filePath.startsWith(path.resolve(rootDir))){
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err){
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found: " + urlPath);
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, baseUrl: "http://127.0.0.1:" + port });
    });
  });
}

module.exports = { startServer };
