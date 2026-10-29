// frontend/dist -> desktop/app
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "..", "frontend", "dist");
const dst = path.join(__dirname, "..", "app");
if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error("frontend/dist bulunamadı. Önce: cd frontend && yarn build:native");
  process.exit(1);
}
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log("dist kopyalandı ->", dst);
