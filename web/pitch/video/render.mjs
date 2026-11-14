// Echo pitch: headless-Chrome renderer with no dependencies (Node 24 WebSocket + Chrome DevTools Protocol).
// Pages are served from web/ by a tiny local server, so ../../shared/ui.css and ES modules resolve.
//
//   node render.mjs stills  <page> <t1,t2,...> <outDir>     PNG per time (page must expose renderFrame(t))
//   node render.mjs slides  <page> <n1,n2,...> <outDir>     PNG per slide (page must expose showSlide(n))
//   node render.mjs frames  <page> <from> <to> <fps> <outDir> [workers]   numbered PNGs, resumable
//   node render.mjs pdf     <page> <out.pdf>                deck to PDF (page must expose printMode())
//   node render.mjs contact <inDir> <out.png> [cols]        contact sheet of the PNGs in inDir
// <page> is relative to web/, e.g. "pitch/video/film.html?stamp".
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { existsSync, statSync, createReadStream } from "node:fs";
import { join, extname, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..", "..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".ttf": "font/ttf", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".json": "application/json", ".mp4": "video/mp4",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((done) => {
    const srv = createServer(async (req, res) => {
      try {
        const path = resolve(WEB, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
        if (!path.startsWith(WEB + sep)) return res.writeHead(403).end();
        const type = TYPES[extname(path)] ?? "application/octet-stream";
        const size = statSync(path).size;
        // HTTP Range, so <video> can seek during renders
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
        if (range) {
          const start = range[1] ? Number(range[1]) : size - Number(range[2]);
          const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (start >= size || start > end) return res.writeHead(416, { "content-range": `bytes */${size}` }).end();
          res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes" });
          return createReadStream(path, { start, end }).pipe(res);
        }
        res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-store" });
        createReadStream(path).pipe(res);
      } catch {
        res.writeHead(404).end();
      }
    });
    srv.listen(0, "127.0.0.1", () => done(srv));
  });
}

function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? fail(new Error(m.error.message)) : ok(m.result);
    }
  };
  const open = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  return {
    open,
    send: (method, params = {}) => new Promise((ok, fail) => {
      const i = ++id;
      pending.set(i, { ok, fail });
      ws.send(JSON.stringify({ id: i, method, params }));
    }),
    close: () => ws.close(),
  };
}

let nextPort = 9400 + Math.floor(Math.random() * 400);

/** Opens a page in its own headless Chrome; resolves once window.ready is true. */
async function openPage(server, page) {
  const port = nextPort++;
  const profile = await mkdtemp(join(tmpdir(), "echo-chrome-"));
  const url = `http://127.0.0.1:${server.address().port}/${page}`;
  const proc = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", "--font-render-hinting=none", "--window-size=1920,1080", url,
  ], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 120 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && t.url.startsWith("http://127.0.0.1"));
    } catch {}
    if (!target) await sleep(150);
  }
  if (!target) throw new Error("Chrome did not open the page");
  const c = cdp(target.webSocketDebuggerUrl);
  await c.open;
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const r = await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  for (let i = 0; ; i++) {
    try {
      if (await evaluate("window.ready === true")) break;
    } catch {}
    if (i > 300) throw new Error(`page never set window.ready: ${url}`);
    await sleep(50);
  }
  const shot = async (file, { transparent = false } = {}) => {
    if (transparent) await c.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    const { data } = await c.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(file, Buffer.from(data, "base64"));
  };
  const close = async () => {
    c.close();
    proc.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  return { evaluate, shot, send: c.send, close };
}

const pad = (n, w = 5) => String(n).padStart(w, "0");

async function stills(page, times, outDir) {
  await mkdir(outDir, { recursive: true });
  const server = await serve();
  const p = await openPage(server, page);
  try {
    for (const [i, t] of times.entries()) {
      await p.evaluate(`renderFrame(${t})`);
      const file = join(outDir, `still_${pad(i, 2)}.png`);
      await p.shot(file);
      console.log(`t=${t}\t${file}`);
    }
  } finally {
    await p.close();
    server.close();
  }
}

async function slides(page, numbers, outDir) {
  await mkdir(outDir, { recursive: true });
  const server = await serve();
  const p = await openPage(server, page);
  try {
    for (const n of numbers) {
      await p.evaluate(`showSlide(${n})`);
      const file = join(outDir, `slide_${pad(n, 2)}.png`);
      await p.shot(file);
      console.log(`slide ${n}\t${file}`);
    }
  } finally {
    await p.close();
    server.close();
  }
}

async function frames(page, from, to, fps, outDir, workers = 3) {
  await mkdir(outDir, { recursive: true });
  const first = Math.round(from * fps), last = Math.round(to * fps) - 1;
  const todo = [];
  for (let i = first; i <= last; i++) if (!existsSync(join(outDir, `${pad(i)}.png`))) todo.push(i);
  console.log(`${last - first + 1} frames, ${todo.length} to render, ${workers} workers`);
  const server = await serve();
  let cursor = 0, done = 0;
  const work = async () => {
    const p = await openPage(server, page);
    try {
      while (cursor < todo.length) {
        const i = todo[cursor++];
        await p.evaluate(`renderFrame(${i / fps})`);
        await p.shot(join(outDir, `${pad(i)}.png`));
        if (++done % 30 === 0) console.log(`${done}/${todo.length}`);
      }
    } finally {
      await p.close();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, workers) }, work));
  server.close();
}

async function pdf(page, out) {
  const server = await serve();
  const p = await openPage(server, page);
  try {
    await p.evaluate("printMode()");
    const { data } = await p.send("Page.printToPDF", {
      printBackground: true, preferCSSPageSize: true,
      paperWidth: 20, paperHeight: 11.25, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(data, "base64"));
    console.log(out);
  } finally {
    await p.close();
    server.close();
  }
}

async function contact(inDir, out, cols = 4) {
  const files = (await readdir(inDir)).filter((f) => f.endsWith(".png")).sort();
  if (!files.length) throw new Error(`no PNGs in ${inDir}`);
  const rows = Math.ceil(files.length / cols);
  const list = join(inDir, "_contact.txt");
  await writeFile(list, files.map((f) => `file '${join(inDir, f).replaceAll("\\", "/")}'`).join("\n"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", `scale=640:-1,pad=648:368:4:4:color=0x02070f,tile=${cols}x${rows}`, "-frames:v", "1", out]);
  await rm(list);
  console.log(`${out} (${files.length} images, ${cols}x${rows})`);
}

const [cmd, ...a] = process.argv.slice(2);
const nums = (s) => s.split(",").map(Number);
const run = {
  stills: () => stills(a[0], nums(a[1]), resolve(a[2])),
  slides: () => slides(a[0], nums(a[1]), resolve(a[2])),
  frames: () => frames(a[0], Number(a[1]), Number(a[2]), Number(a[3]), resolve(a[4]), Number(a[5] ?? 3)),
  pdf: () => pdf(a[0], resolve(a[1])),
  contact: () => contact(resolve(a[0]), resolve(a[1]), Number(a[2] ?? 4)),
}[cmd];
if (!run) {
  console.error("usage: node render.mjs stills|slides|frames|pdf|contact …");
  process.exit(1);
}
await run();
