const fs = require("fs");
const path = require("path");
// Published build: the web app is prebuilt by scripts/emergent/package.sh into ./site
const src = path.join(__dirname, "site");
const out = path.join(__dirname, "build");
if (!fs.existsSync(path.join(src, "index.html"))) { console.error("frontend/site missing: run scripts/emergent/package.sh"); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
console.log("copied prebuilt site to build/");
