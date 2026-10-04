// Draws the animated hero banner: a perspective grid rushing toward the viewer,
// a pulsing horizon glow, drifting sparks, and the name revealed with a light
// sweep that repeats. CSS @keyframes + SMIL only, so it plays in a README <img>.
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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aditya Bhoye. Founder of Veron. Full-stack and machine learning engineer.">
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
  <linearGradient id="sweep" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".5" stop-color="#fff" stop-opacity=".95"/>
    <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="-${W} 0;-${W} 0;${W} 0;${W} 0" keyTimes="0;.55;.85;1" dur="6s" begin="1.6s" repeatCount="indefinite"/>
  </linearGradient>
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
.rule{transform-origin:${VX}px 0;transform:scaleX(0);animation:draw 1s cubic-bezier(.2,.8,.2,1) 1.1s forwards}
@keyframes draw{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.glow,.x,.sparks circle,.horizon{animation:none}.name,.tag{animation:none;opacity:1}.rule{animation:none;transform:none}}
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
  </g>
  <rect class="rule" x="${VX - 150}" y="176" width="300" height="2" fill="#ff5722"/>
  <text class="tag" x="${VX}" y="212" text-anchor="middle" font-size="19" font-weight="600" letter-spacing="5" fill="#e6edf3">FOUNDER OF VERON  ·  FULL-STACK &amp; ML ENGINEER</text>
</g>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="17.5" fill="none" stroke="#ff5722" stroke-opacity=".35" stroke-width="1.5"/>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`${OUT}  ${(svg.length / 1024).toFixed(1)} KB`);
