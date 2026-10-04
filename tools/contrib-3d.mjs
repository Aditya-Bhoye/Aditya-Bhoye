// Draws the last year of contributions as an isometric 3D graph. On load the
// blocks rise in one smooth wave from the oldest week to the newest, then hold.
// Pure SVG + CSS @keyframes, so it animates inside a README <img>.
//
//   GH_TOKEN=... node tools/contrib-3d.mjs [out-dir]
//
// Writes profile-3d-dark.svg and profile-3d-light.svg.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const USER = process.env.GH_USER ?? "Aditya-Bhoye";
const TOKEN = process.env.GH_TOKEN;
const OUT = process.argv[2] ?? "dist";
if (!TOKEN) throw new Error("GH_TOKEN is not set");

// ---------------------------------------------------------------- data

async function calendar() {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date weekday contributionCount } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const cells = cal.weeks.flatMap((week, w) =>
    week.contributionDays.map((day) => ({
      w, d: day.weekday, date: day.date, count: day.contributionCount,
    })));
  return { total: cal.totalContributions, weeks: cal.weeks.length, cells };
}

// ---------------------------------------------------------------- geometry

// Oblique axes: weeks run right and slightly down, days run down-left. This
// keeps a year wide and short instead of a long isometric diagonal.
const U = { x: 12, y: 3.2 };   // one week
const V = { x: -8, y: 8 };     // one day
const GAP = 0.82;              // block footprint, so the grid reads as cells
const MIN_H = 4;
const MAX_H = 46;
const MARGIN = 24;

function layout(weeks) {
  const ox = MARGIN + 7 * -V.x;
  const oy = MARGIN + MAX_H + 8;
  return {
    // centre of a cell on the ground
    at: (w, d) => ({ x: ox + (w + 0.5) * U.x + (d + 0.5) * V.x, y: oy + (w + 0.5) * U.y + (d + 0.5) * V.y }),
    width: Math.ceil(ox + weeks * U.x + MARGIN),
    height: Math.ceil(oy + weeks * U.y + 7 * V.y + MARGIN),
  };
}

const f = (n) => +n.toFixed(2);
// A cell's top face, centred on 0,0 and scaled by k.
const face = (k) => {
  const ux = (U.x * k) / 2, uy = (U.y * k) / 2, vx = (V.x * k) / 2, vy = (V.y * k) / 2;
  return [[-ux - vx, -uy - vy], [ux - vx, uy - vy], [ux + vx, uy + vy], [-ux + vx, -uy + vy]]
    .map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
};
// The two side faces that face the viewer hang below the +V edge (front) and
// the +U edge (right). Each gets a frame whose x axis runs along that edge and
// whose y axis points down the screen, so scaleY(0) folds it onto the ground.
const sides = (x, y, k) => {
  const u = { x: U.x * k, y: U.y * k }, v = { x: V.x * k, y: V.y * k };
  const p3 = { x: x - u.x / 2 + v.x / 2, y: y - u.y / 2 + v.y / 2 }; // start of +V edge
  const p1 = { x: x + u.x / 2 - v.x / 2, y: y + u.y / 2 - v.y / 2 }; // start of +U edge
  return {
    front: `matrix(${f(u.x)},${f(u.y)},0,1,${f(p3.x)},${f(p3.y)})`,
    right: `matrix(${f(v.x)},${f(v.y)},0,1,${f(p1.x)},${f(p1.y)})`,
  };
};

// ---------------------------------------------------------------- themes

const THEMES = {
  dark: {
    bg: "#0d1117", tile: "#161b22", tileEdge: "#21262d", text: "#e6edf3", muted: "#8b949e",
    levels: ["#7a2a12", "#b33a16", "#e04a1c", "#ff5722"],
  },
  light: {
    bg: "#ffffff", tile: "#ebedf0", tileEdge: "#d8dce1", text: "#1f2328", muted: "#59636e",
    levels: ["#ffab91", "#ff7043", "#f4511e", "#d4141a"],
  },
};

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------- svg

function render(data, theme) {
  const t = THEMES[theme];
  const g = layout(data.weeks);

  // Heights and tones scale against the 95th percentile, so one huge day
  // does not flatten the rest of the year.
  const counts = data.cells.map((c) => c.count).filter(Boolean).sort((a, b) => a - b);
  const cap = counts[Math.floor((counts.length - 1) * 0.95)] || 1;
  const level = (n) => Math.min(3, Math.floor((Math.min(n, cap) / cap) * 3.999));
  const height = (n) => MIN_H + (Math.min(n, cap) / cap) * (MAX_H - MIN_H);

  // One pass, oldest week first: each block rises over RISE seconds, starting
  // WAVE * (its week / all weeks) seconds in. Then everything holds still.
  const START = 0.3;
  const WAVE = 1.6;
  const RISE = 0.7;
  const EASE = "cubic-bezier(.2,.8,.2,1)";

  const css = [
    `@keyframes rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}`,
    `.r{transform:scaleY(0);animation:rise ${RISE}s ${EASE} forwards}`,
    `.lbl{opacity:0;animation:fade .8s ease-out .2s forwards}@keyframes fade{to{opacity:1}}`,
  ];
  const tiles = [];
  const blocks = [];

  for (const c of data.cells) {
    const { x, y } = g.at(c.w, c.d);
    tiles.push(`<polygon points="${face(GAP)}" transform="translate(${f(x)},${f(y)})"/>`);
  }

  // Back to front, so nearer blocks paint over farther ones.
  const depth = (c) => c.w * U.y + c.d * V.y;
  const active = data.cells.filter((c) => c.count > 0).sort((a, b) => depth(a) - depth(b));
  active.forEach((c, i) => {
    const { x, y } = g.at(c.w, c.d);
    const h = f(height(c.count));
    const top = t.levels[level(c.count)];
    const delay = f(START + (c.w / data.weeks) * WAVE + (c.d / 7) * 0.08);
    // The top face starts on the ground and lifts by h; the side faces unfold
    // up from the ground at the same pace.
    css.push(`@keyframes t${i}{from{transform:translateY(${h}px)}to{transform:translateY(0)}}`,
      `.t${i}{transform:translateY(${h}px);animation:t${i} ${RISE}s ${EASE} ${delay}s forwards}`);
    const { front, right } = sides(x, y, GAP);
    blocks.push(
      `<g><title>${c.date}: ${c.count} contribution${c.count === 1 ? "" : "s"}</title>` +
        `<g transform="${front}"><rect class="r" style="animation-delay:${delay}s" y="${-h}" width="1" height="${h}" fill="${shade(top, 0.72)}"/></g>` +
        `<g transform="${right}"><rect class="r" style="animation-delay:${delay}s" y="${-h}" width="1" height="${h}" fill="${shade(top, 0.55)}"/></g>` +
        `<g transform="translate(${f(x)},${f(y - h)})"><polygon class="t${i}" points="${face(GAP)}" fill="${top}"/></g></g>`,
    );
  });

  const days = active.length;
  const label =
    `<g class="lbl"><text x="${g.width - MARGIN}" y="${MARGIN + 14}" text-anchor="end" font-size="15" font-weight="600" fill="${t.text}">${data.total} contributions in the last year</text>` +
    `<text x="${g.width - MARGIN}" y="${MARGIN + 32}" text-anchor="end" font-size="12" fill="${t.muted}">${days} active days</text></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="${data.total} contributions in the last year, drawn as a 3D graph">
<style>
svg{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
${css.join("\n")}
@media (prefers-reduced-motion:reduce){.r,[class^=t],.lbl{animation:none!important;transform:none!important;opacity:1!important}}
</style>
<rect width="100%" height="100%" rx="10" fill="${t.bg}"/>
${label}
<g fill="${t.tile}" stroke="${t.tileEdge}" stroke-width="0.6">${tiles.join("")}</g>
<g>${blocks.join("")}</g>
</svg>
`;
}

// ---------------------------------------------------------------- main

const data = await calendar();
mkdirSync(OUT, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  const svg = render(data, theme);
  const file = join(OUT, `profile-3d-${theme}.svg`);
  writeFileSync(file, svg);
  console.log(`${file}  ${(svg.length / 1024).toFixed(0)} KB`);
}
