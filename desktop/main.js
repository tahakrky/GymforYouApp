const { app, BrowserWindow, shell, Menu } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Sabit port: localStorage (giriş token'ı) origin'e bağlı, port değişirse oturum kaybolur.
const PORT = 47631;
const ROOT = path.join(__dirname, "app");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html"); // SPA
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 600,
    backgroundColor: "#09090B", autoHideMenuBar: true, title: "GymForYou",
    icon: path.join(__dirname, "build", "icon.png"),
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://localhost:${PORT}`);
  // Uygulama dışı linkler tarayıcıda açılsın
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) shell.openExternal(url);
    return { action: "deny" };
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(async () => {
    try { await startServer(); } catch (e) { console.error("Sunucu başlamadı:", e); }
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
