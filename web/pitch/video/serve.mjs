// Local preview server for web/ with HTTP Range support, so footage videos can seek (python's http.server cannot).
//   node web/pitch/video/serve.mjs [port]      then open http://127.0.0.1:5173/pitch/video/film.html
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.argv[2] ?? 5173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ttf": "font/ttf", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
  ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav",
};

createServer((req, res) => {
  let path = resolve(WEB, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path.startsWith(WEB + sep) && path !== WEB) return res.writeHead(403).end();
  let st;
  try {
    st = statSync(path);
    if (st.isDirectory()) { path = resolve(path, "index.html"); st = statSync(path); }
  } catch {
    return res.writeHead(404).end("not found");
  }
  const type = TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) return res.writeHead(416, { "content-range": `bytes */${st.size}` }).end();
    res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes", "cache-control": "no-store" });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": st.size, "accept-ranges": "bytes", "cache-control": "no-store" });
  createReadStream(path).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${WEB} at http://127.0.0.1:${PORT}/pitch/video/film.html`));
