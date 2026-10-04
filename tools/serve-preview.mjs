// Serves the profile folder so preview.html can load the GIFs over http.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TYPES = { ".html": "text/html", ".gif": "image/gif", ".svg": "image/svg+xml", ".css": "text/css" };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(ROOT, path === "\\" || path === "/" ? "preview.html" : path);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  let body;
  try {
    body = await readFile(file);
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(body);
}).listen(4317, "127.0.0.1");
