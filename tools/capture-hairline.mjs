// Records Hairline figures as seamless looping GIFs for the profile README.
// GitHub strips JavaScript, so the live figures are captured frame by frame
// under a fake clock (deterministic, no dropped frames), then encoded with ffmpeg.
//
//   node tools/capture-hairline.mjs [figure ...]
//
// Env: HAIRLINE_DIR  (dist folder of @lucasmarkes/hairline)
//      CHROME        (browser executable; defaults to installed Chrome)
//      WORK_DIR      (temporary frames; keep it off a full drive)

import { chromium } from "playwright-core";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const HAIRLINE_DIR = process.env.HAIRLINE_DIR ??
  "E:/Velto/docs/demo-video/node_modules/@lucasmarkes/hairline/dist";
const CHROME = process.env.CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const WORK_DIR = process.env.WORK_DIR ?? "E:/tmp-build/hairline-frames";
const OUT_DIR = resolve(import.meta.dirname, "../assets");

const FIGURES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["laptop", "phone", "terminal"];
const THEMES = { dark: "#0d1117", light: "#ffffff" };

const WIDTH = 480;               // CSS px; Hairline draws at 5:4
const HEIGHT = WIDTH * 4 / 5;
const SCALE = 2;                 // supersample, then downscale for clean lines
const FPS = 30;
const LOOP_MS = 4000;
const FRAMES = FPS * LOOP_MS / 1000;
const WARMUP_LOOPS = 2;          // let every spring settle onto the loop first
const INTENSITY = 0.7;
const MAX_BYTES = 3 * 1024 * 1024;

// Each figure answers a different part of the pointer, so each gets its own
// path (CSS px inside the 480 x 384 box). A sweep eases from `from` to `to`
// and back; an ellipse circles `c`. Both are closed, so frame N = frame 0.
const PATHS = {
  laptop: { sweep: { from: [240, 70], to: [240, 330] } },         // height sets the lid
  phone: { sweep: { from: [130, 80], to: [350, 320] } },          // across opens, down picks
  terminal: { sweep: { from: [235, 115], to: [235, 255] } },      // height walks the lines
  branches: { sweep: { from: [148, 140], to: [398, 262] } },      // along the main line
};

function pointerAt(figure, frame) {
  const t = frame / FRAMES;
  const { sweep, ellipse } = PATHS[figure];
  if (sweep) {
    const k = (1 - Math.cos(t * Math.PI * 2)) / 2;
    return {
      x: sweep.from[0] + (sweep.to[0] - sweep.from[0]) * k,
      y: sweep.from[1] + (sweep.to[1] - sweep.from[1]) * k,
    };
  }
  const a = t * Math.PI * 2;
  return {
    x: ellipse.c[0] + Math.cos(a) * ellipse.r[0],
    y: ellipse.c[1] + Math.sin(a) * ellipse.r[1],
  };
}

function page(figure, theme) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:${THEMES[theme]};overflow:hidden}
  #fig{width:${WIDTH}px;--hairline-plate:${THEMES[theme]}}
</style>
<div id="fig"></div>
<script type="module">
  import { ${figure} } from "/hairline/index.js";
  window.reads = [];
  ${figure}(document.getElementById("fig"), { intensity: ${INTENSITY}, theme: "${theme}", onRead: (s) => window.reads.push(s) });
</script>`;
}

async function capture(browser, figure, theme) {
  const dir = join(WORK_DIR, `${figure}-${theme}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme: theme,
    reducedMotion: "no-preference",
  });
  const tab = await context.newPage();
  await tab.route("http://hairline.local/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/hairline/")) {
      return route.fulfill({
        body: readFileSync(join(HAIRLINE_DIR, path.slice("/hairline/".length))),
        contentType: "text/javascript",
      });
    }
    return route.fulfill({ body: page(figure, theme), contentType: "text/html" });
  });

  await tab.clock.install({ time: 0 });
  await tab.goto("http://hairline.local/");
  await tab.waitForSelector("#fig svg");

  const step = 1000 / FPS;
  const start = pointerAt(figure, 0);
  await tab.mouse.move(start.x, start.y);

  for (let f = 0; f < FRAMES * WARMUP_LOOPS; f++) {
    const p = pointerAt(figure, f % FRAMES);
    await tab.mouse.move(p.x, p.y);
    await tab.clock.runFor(step);
  }
  // One extra frame past the loop: frame FRAMES must match frame 0.
  for (let f = 0; f <= FRAMES; f++) {
    const p = pointerAt(figure, f % FRAMES);
    await tab.mouse.move(p.x, p.y);
    await tab.clock.runFor(step);
    await tab.screenshot({
      path: join(dir, `${String(f).padStart(4, "0")}.png`),
      animations: "allow",
      caret: "initial",
    });
  }
  // The figure's captions prove the path reached its interactive parts.
  const reads = await tab.evaluate(() => [...new Set(window.reads)]);
  console.log(`  ${figure}-${theme} captions: ${reads.join(" | ")}`);
  await context.close();
  return dir;
}

function seamDiff(dir) {
  // PSNR between the last captured frame and the first; "inf" means identical.
  // ffmpeg reports the score on stderr.
  return spawnSync("ffmpeg", [
    "-hide_banner", "-i", join(dir, "0000.png"),
    "-i", join(dir, `${String(FRAMES).padStart(4, "0")}.png`),
    "-lavfi", "psnr", "-f", "null", "-",
  ]).stderr.toString();
}

function encode(dir, figure, theme) {
  const out = join(OUT_DIR, `${figure}-${theme}.gif`);
  // Frames 0..FRAMES-1 only; frame FRAMES is the seam check.
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(FPS), "-start_number", "0",
    "-i", join(dir, "%04d.png"), "-frames:v", String(FRAMES),
    "-vf",
    `scale=${WIDTH}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=48:stats_mode=full[p];` +
      `[b][p]paletteuse=dither=none:diff_mode=rectangle`,
    "-loop", "0", out,
  ]);
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const figure of FIGURES) {
    for (const theme of Object.keys(THEMES)) {
      const dir = await capture(browser, figure, theme);
      const psnr = seamDiff(dir).match(/average:(\S+)/)?.[1];
      const gif = encode(dir, figure, theme);
      const bytes = statSync(gif).size;
      const ok = bytes <= MAX_BYTES ? "ok" : "TOO BIG";
      console.log(`${figure}-${theme}.gif  ${(bytes / 1024).toFixed(0)} KB ${ok}  seam PSNR ${psnr}`);
    }
  }
} finally {
  await browser.close();
}
