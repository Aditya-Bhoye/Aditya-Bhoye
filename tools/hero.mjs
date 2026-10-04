// Draws the animated hero banner: a perspective grid rushing toward the viewer,
// a pulsing horizon glow and drifting sparks. The name loops through a sleek
// light sweep, then three glints catch its edges, then rests. Under it, three titles type in and out
// in turn. CSS @keyframes + SMIL only, so it plays in a README <img>.
//
//   node tools/hero.mjs [out-file]

import { writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "assets/hero.svg";
const W = 1200;
const H = 380;
const HORIZON = 250;
const VX = W / 2;
const f = (n) => +n.toFixed(1);

// Floor: rays from the vanishing point, and cross lines that slide from the
// horizon to the bottom edge, accelerating, so the floor moves toward you.
const rays = [];
for (let i = -24; i <= 24; i++) {
  rays.push(`<line x1="${VX}" y1="${HORIZON}" x2="${f(VX + i * 95)}" y2="${H}"/>`);
}
const CROSS = 9;
const FLOW = 3.6;
const cross = [];
for (let i = 0; i < CROSS; i++) {
  cross.push(`<line class="x" x1="0" x2="${W}" y1="${HORIZON}" y2="${HORIZON}" style="animation-delay:${f((-i * FLOW) / CROSS)}s"/>`);
}

// Sparks above the horizon: fixed spots, staggered twinkle.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sparks = [];
for (let i = 0; i < 46; i++) {
  const x = f(rnd() * W);
  const y = f(18 + rnd() * (HORIZON - 40));
  const r = f(0.6 + rnd() * 1.4);
  sparks.push(`<circle cx="${x}" cy="${y}" r="${r}" style="animation-delay:${f(-rnd() * 4)}s;animation-duration:${f(2.5 + rnd() * 3)}s"/>`);
}

// The name loop, in seconds: a slow sweep, three glints, rest.
const NAME_LOOP = 10;
const SWEEP = 3.6;
const NAME_BEGIN = 1.4;
const k = (t) => +(t / NAME_LOOP).toFixed(4);

// Scattered at random all around the name: above, below, both ends and over
// the letters. A fixed seed keeps the build stable; times are random too, all
// inside the window after the sweep.
const NAME_BOX = { x0: VX - 410, x1: VX + 410, top: 74, base: 152 };
let gseed = 2027;
const grnd = () => ((gseed = (gseed * 48271) % 2147483647) / 2147483647);
// Ten spots spaced evenly round the name (so no side gets crowded) plus four
// over the letters, each nudged at random; firing order is random too.
const ring = Array.from({ length: 10 }, (_, i) => {
  const a = ((i + 0.5 + (grnd() - 0.5) * 0.6) / 10) * Math.PI * 2;
  return { x: VX + Math.cos(a) * 430, y: 113 + Math.sin(a) * 50 };
});
const over = Array.from({ length: 4 }, (_, i) => ({
  x: NAME_BOX.x0 + 70 + ((i + 0.5) / 4) * (NAME_BOX.x1 - NAME_BOX.x0 - 140) + (grnd() - 0.5) * 60,
  y: NAME_BOX.top + 14 + grnd() * 46,
}));
const GLINTS = [...ring, ...over].map((p) => ({
  x: f(p.x), y: f(p.y), at: f(SWEEP + 0.05 + grnd() * 3.4), size: Math.round(16 + grnd() * 22),
}));
const loop = `dur="${NAME_LOOP}s" begin="${NAME_BEGIN}s" repeatCount="indefinite"`;
const glints = GLINTS.map(({ x, y, at, size }) => {
  const times = `keyTimes="0;${k(at)};${k(at + 0.35)};${k(at + 1)};1"`;
  const ease = `calcMode="spline" keySplines="0 0 1 1;.25 .6 .4 1;.5 0 .75 .4;0 0 1 1"`;
  const ray = (len, w) => `M0,${-len}C${w},${-w} ${w},${-w} ${len},0C${w},${w} ${w},${w} 0,${len}C${-w},${w} ${-w},${w} ${-len},0C${-w},${-w} ${-w},${-w} 0,${-len}Z`;
  return `<g transform="translate(${x},${y})"><g opacity="0">` +
    `<animate attributeName="opacity" values="0;0;1;0;0" ${times} ${ease} ${loop}/>` +
    `<g><animateTransform attributeName="transform" type="scale" values=".05;.05;1;.3;.3" ${times} ${ease} ${loop}/>` +
    `<animateTransform attributeName="transform" type="rotate" values="0;0;12;35;35" ${times} additive="sum" ${loop}/>` +
    `<circle r="${f(size * 0.55)}" fill="#ffc4ad" opacity=".55" filter="url(#soft)"/>` +
    `<path d="${ray(size, 2.2)}" fill="#fff"/>` +
    `<path d="${ray(size * 0.42, 1.1)}" fill="#fff" opacity=".8" transform="rotate(45)"/>` +
    `<circle r="3.2" fill="#fff"/></g></g></g>`;
});

// Titles: each types in, holds, and erases, one after another.
const TITLES = [
  "Founder of Veron, a billing app for bars",
  "Full-stack engineer: app, server, database",
  "Machine learning engineer: PyTorch, scikit-learn",
];
const SLOT = 4;
const TITLE_LOOP = SLOT * TITLES.length;
const TITLE_BEGIN = 1.3;
const TITLE_Y = 214;
const TITLE_SIZE = 22;
const CHAR = 0.58 * TITLE_SIZE; // textLength pins every font to this advance
const kt = (t) => +(t / TITLE_LOOP).toFixed(4);
const titles = TITLES.map((line, i) => {
  const w = f(line.length * CHAR);
  const x0 = f(VX - w / 2);
  const s0 = i * SLOT;
  const times = [0, kt(s0), kt(s0 + 1.4), kt(s0 + 3.1), kt(s0 + 3.5), 1].join(";");
  const widths = [0, 0, w, w, 0, 0].join(";");
  const carets = [x0, x0, x0 + w, x0 + w, x0, x0].map(f).join(";");
  const anim = `dur="${TITLE_LOOP}s" begin="${TITLE_BEGIN}s" repeatCount="indefinite" keyTimes="${times}"`;
  return `<clipPath id="type${i}"><rect x="${x0}" y="${TITLE_Y - 24}" width="0" height="34"><animate attributeName="width" values="${widths}" ${anim}/></rect></clipPath>` +
    `<text clip-path="url(#type${i})" x="${x0}" y="${TITLE_Y}" textLength="${w}" lengthAdjust="spacingAndGlyphs" class="title">${line}</text>` +
    `<rect class="caret" x="${x0}" y="${TITLE_Y - 19}" width="2.5" height="24" opacity="0">` +
    `<animate attributeName="x" values="${carets}" ${anim}/>` +
    `<animate attributeName="opacity" calcMode="discrete" values="0;1;1;1;0;0" ${anim}/></rect>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aditya Bhoye. ${TITLES.join(". ")}.">
<defs>
  <radialGradient id="glow" cx="50%" cy="${(HORIZON / H) * 100}%" r="55%">
    <stop offset="0" stop-color="#ff5722" stop-opacity=".55"/>
    <stop offset=".35" stop-color="#d4141a" stop-opacity=".22"/>
    <stop offset="1" stop-color="#0d1117" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fade" x1="0" y1="${HORIZON}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".25" stop-color="#fff" stop-opacity=".7"/>
    <stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <mask id="floorMask"><rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#fade)"/></mask>
  <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset=".55" stop-color="#ffd6c9"/>
    <stop offset="1" stop-color="#ff8a65"/>
  </linearGradient>
  <!-- The sweep: a bright band that slides across the name every few seconds. -->
  <linearGradient id="sweep" x1="0" y1="0" x2="${W}" y2="160" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".36" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".45" stop-color="#ffe3d9" stop-opacity=".35"/>
    <stop offset=".5" stop-color="#fff" stop-opacity=".85"/>
    <stop offset=".55" stop-color="#ffe3d9" stop-opacity=".35"/>
    <stop offset=".64" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="-${W} 0;${W} 0;${W} 0" keyTimes="0;${k(SWEEP)};1" calcMode="spline" keySplines=".42 0 .58 1;0 0 1 1" ${loop}/>
  </linearGradient>
  <filter id="soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>
<style>
text{font-family:"Segoe UI","SF Pro Display",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.glow{transform-origin:${VX}px ${HORIZON}px;animation:pulse 5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
.floor line{stroke:#ff5722;stroke-width:1.1;opacity:.55}
.x{animation:flow ${FLOW}s cubic-bezier(.55,0,1,.45) infinite}
@keyframes flow{from{transform:translateY(0);opacity:0}15%{opacity:.7}to{transform:translateY(${H - HORIZON}px);opacity:.9}}
.sparks circle{fill:#ffb199;animation:twinkle 3s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:.1}50%{opacity:.9}}
.horizon{animation:beam 5s ease-in-out infinite}
@keyframes beam{0%,100%{opacity:.6}50%{opacity:1}}
.name{opacity:0;animation:rise 1.1s cubic-bezier(.2,.8,.2,1) .2s forwards}
.tag{opacity:0;animation:rise 1s cubic-bezier(.2,.8,.2,1) .8s forwards}
@keyframes rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
.title{font-family:Consolas,"SF Mono",Menlo,"DejaVu Sans Mono",monospace;font-size:${TITLE_SIZE}px;font-weight:600;fill:#ff8a65}
.caret{fill:#ff5722;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{fill-opacity:0}}
.rule{transform-origin:${VX}px 0;transform:scaleX(0);animation:draw 1s cubic-bezier(.2,.8,.2,1) 1.1s forwards}
@keyframes draw{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.glow,.x,.sparks circle,.horizon{animation:none}.name{animation:none;opacity:1}.rule{animation:none;transform:none}}
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect class="glow" width="${W}" height="${H}" fill="url(#glow)"/>
  <g class="sparks">${sparks.join("")}</g>
  <g class="floor" mask="url(#floorMask)">${rays.join("")}${cross.join("")}</g>
  <line class="horizon" x1="0" x2="${W}" y1="${HORIZON}" y2="${HORIZON}" stroke="#ff8a65" stroke-width="1.5"/>
  <g class="name">
    <text x="${VX}" y="150" text-anchor="middle" font-size="96" font-weight="800" letter-spacing="6" fill="url(#ink)">ADITYA BHOYE</text>
    <text x="${VX}" y="150" text-anchor="middle" font-size="96" font-weight="800" letter-spacing="6" fill="url(#sweep)">ADITYA BHOYE</text>
    ${glints.join("\n    ")}
  </g>
  <rect class="rule" x="${VX - 150}" y="176" width="300" height="2" fill="#ff5722"/>
  ${titles.join("\n  ")}
</g>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="17.5" fill="none" stroke="#ff5722" stroke-opacity=".35" stroke-width="1.5"/>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`${OUT}  ${(svg.length / 1024).toFixed(1)} KB`);
