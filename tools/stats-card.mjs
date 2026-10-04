// Draws a GitHub stats card from the GraphQL API, so the README never waits
// on a public stats server.
//
//   GH_TOKEN=... node tools/stats-card.mjs [out-dir]
//
// Writes stats-dark.svg and stats-light.svg.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const USER = process.env.GH_USER ?? "Aditya-Bhoye";
const TOKEN = process.env.GH_TOKEN;
const OUT = process.argv[2] ?? "dist";
// Notebook files store their outputs (plots, images) as text, so their byte
// counts say little about how much code is in them.
const EXCLUDE = new Set((process.env.EXCLUDE_LANGS ?? "Jupyter Notebook").split(",").map((s) => s.trim()).filter(Boolean));
if (!TOKEN) throw new Error("GH_TOKEN is not set");

async function stats() {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection { contributionCalendar { totalContributions } }
      repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
        totalCount
        nodes {
          isFork
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
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
  const user = json.data.user;
  const repos = user.repositories.nodes;

  // Languages only from repositories Aditya owns and did not fork. Raw bytes
  // let one notebook full of embedded outputs swamp everything, so each
  // language scores sqrt(bytes) * sqrt(repos), as github-readme-stats does
  // with size_weight=0.5 and count_weight=0.5.
  const bytes = new Map();
  const count = new Map();
  for (const repo of repos.filter((r) => !r.isFork)) {
    for (const { size, node } of repo.languages.edges) {
      if (EXCLUDE.has(node.name)) continue;
      bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
      count.set(node.name, (count.get(node.name) ?? 0) + 1);
    }
  }
  const score = [...bytes.keys()].map((name) => [name, Math.sqrt(bytes.get(name)) * Math.sqrt(count.get(name))]);
  const top = score.sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sum = top.reduce((n, [, v]) => n + v, 0) || 1;
  const languages = top.map(([name, v]) => ({ name, share: v / sum }));

  return {
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    repos: user.repositories.totalCount,
    stars: repos.reduce((n, r) => n + r.stargazerCount, 0),
    languages,
  };
}

const THEMES = {
  dark: {
    bg: "#0d1117", border: "#21262d", text: "#e6edf3", muted: "#8b949e", track: "#161b22",
    accent: "#ff5722", tones: ["#ff5722", "#ff8a65", "#d4141a", "#b33a16", "#ffccbc"],
  },
  light: {
    bg: "#ffffff", border: "#d8dee4", text: "#1f2328", muted: "#59636e", track: "#ebedf0",
    accent: "#d4141a", tones: ["#ff5722", "#d4141a", "#ff8a65", "#8b0a0a", "#ffab91"],
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f = (n) => +n.toFixed(2);

function render(s, theme) {
  const t = THEMES[theme];
  const W = 495;
  const H = 195;
  const rows = [
    ["Contributions (last year)", s.contributions],
    ["Public repositories", s.repos],
    ["Stars earned", s.stars],
  ];
  const left = rows.map(([label, value], i) => {
    const y = 78 + i * 38;
    return `<g class="in" style="animation-delay:${f(0.15 + i * 0.12)}s">` +
      `<text x="25" y="${y}" font-size="12" fill="${t.muted}">${label}</text>` +
      `<text x="25" y="${y + 20}" font-size="20" font-weight="700" fill="${t.accent}">${value}</text></g>`;
  }).join("");

  // Stacked bar of the top languages, then a legend under it.
  const BX = 250;
  const BW = 220;
  let x = BX;
  const bar = s.languages.map((l, i) => {
    const w = Math.max(2, l.share * BW);
    const seg = `<rect x="${f(x)}" y="66" width="${f(w)}" height="8" fill="${t.tones[i]}"/>`;
    x += w;
    return seg;
  }).join("");
  const legend = s.languages.map((l, i) => {
    const y = 98 + i * 19;
    return `<g class="in" style="animation-delay:${f(0.3 + i * 0.1)}s">` +
      `<circle cx="${BX + 5}" cy="${y - 4}" r="4.5" fill="${t.tones[i]}"/>` +
      `<text x="${BX + 16}" y="${y}" font-size="12" fill="${t.text}">${esc(l.name)}</text>` +
      `<text x="${BX + BW}" y="${y}" font-size="12" text-anchor="end" fill="${t.muted}">${(l.share * 100).toFixed(1)}%</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats for ${USER}">
<style>
svg{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.in{opacity:0;animation:in .6s ease-out forwards}
.bar{transform-origin:${BX}px 0;transform:scaleX(0);animation:grow 1.1s .35s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes grow{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.in,.bar{animation:none;opacity:1;transform:none}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="3" rx="1.5" fill="${t.accent}"/>
<text x="25" y="38" font-size="16" font-weight="600" fill="${t.text}">GitHub stats</text>
<text x="${BX}" y="38" font-size="16" font-weight="600" fill="${t.text}">Top languages</text>
<text x="${BX}" y="54" font-size="10" fill="${t.muted}">by size and repositories${EXCLUDE.size ? " · notebooks excluded" : ""}</text>
${left}
<clipPath id="track"><rect x="${BX}" y="66" width="${BW}" height="8" rx="4"/></clipPath>
<g clip-path="url(#track)"><rect x="${BX}" y="66" width="${BW}" height="8" fill="${t.track}"/><g class="bar">${bar}</g></g>
${legend}
</svg>
`;
}

const data = await stats();
mkdirSync(OUT, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  const file = join(OUT, `stats-${theme}.svg`);
  writeFileSync(file, render(data, theme));
  console.log(file);
}
console.log(JSON.stringify(data));
