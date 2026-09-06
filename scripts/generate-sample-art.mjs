/**
 * Generates the flat-lay artwork used by the sample closet.
 *
 * These stand in for real photographs so the app can be demoed with something
 * in it. They're drawn rather than photographed, which keeps them licence-free
 * and visually consistent — every piece is shot on the same "studio" backdrop
 * at the same 3:4 crop the app's cards expect.
 *
 *   node scripts/generate-sample-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sample");
const W = 600;
const H = 800;

/** Lighten / darken a hex colour for cheap fabric shading. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount))),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Backdrop, soft contact shadow, and the fabric gradient every garment uses.
 * `scale` lets small pieces (earrings) fill the same crop as a full-length coat.
 */
function frame(id, base, body, { backdrop = "#f3ece3", scale = 1.2 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${shade(backdrop, 0.35)}"/>
      <stop offset="1" stop-color="${shade(backdrop, -0.07)}"/>
    </linearGradient>
    <linearGradient id="cloth" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${shade(base, 0.16)}"/>
      <stop offset="0.5" stop-color="${base}"/>
      <stop offset="1" stop-color="${shade(base, -0.2)}"/>
    </linearGradient>
    <linearGradient id="cloth2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(base, -0.06)}"/>
      <stop offset="1" stop-color="${shade(base, -0.3)}"/>
    </linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#3a2c22" stop-opacity="0.13"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="drop" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#3a2c22" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g transform="translate(300 430) scale(${scale}) translate(-300 -430)">
    <ellipse cx="300" cy="648" rx="196" ry="44" fill="#3a2c22" opacity="0.10" filter="url(#soft)"/>
    <g filter="url(#drop)">${body}</g>
  </g>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>
`.replace(/\bid="(bg|cloth|cloth2|vig|soft|drop)"/g, `id="$1-${id}"`)
    .replace(/url\(#(bg|cloth|cloth2|vig|soft|drop)\)/g, `url(#$1-${id})`);
}

const seam = (d, w = 2) =>
  `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="${w}" stroke-linecap="round"/>`;
const stitch = (d) =>
  `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="1.6" stroke-dasharray="6 5" stroke-linecap="round"/>`;

/* ------------------------------------------------------------------ tops */

const blouse = () => `
  <path d="M232 196 L188 214 Q150 232 140 268 L112 384 Q108 400 124 406 L166 420 Q180 424 184 410 L196 372 L192 560 Q192 596 226 598 L374 598 Q408 596 408 560 L404 372 L416 410 Q420 424 434 420 L476 406 Q492 400 488 384 L460 268 Q450 232 412 214 L368 196 L300 268 Z" fill="url(#cloth)"/>
  <path d="M232 196 L300 268 L368 196 L344 186 Q300 216 256 186 Z" fill="url(#cloth2)"/>
  ${seam("M300 276 L300 590")}
  ${seam("M196 372 Q200 480 200 580")}
  ${seam("M404 372 Q400 480 400 580")}
  <g fill="#fff" fill-opacity="0.55">
    <circle cx="300" cy="330" r="6"/><circle cx="300" cy="400" r="6"/>
    <circle cx="300" cy="470" r="6"/><circle cx="300" cy="540" r="6"/>
  </g>
  ${stitch("M150 262 Q160 250 176 244")}
  ${stitch("M450 262 Q440 250 424 244")}`;

const cardigan = () => `
  <path d="M228 200 L182 220 Q146 238 138 274 L110 398 Q106 414 122 420 L164 434 Q178 438 182 424 L196 380 L194 588 Q194 620 224 622 L376 622 Q406 620 406 588 L404 380 L418 424 Q422 438 436 434 L478 420 Q494 414 490 398 L462 274 Q454 238 418 220 L372 200 Q300 244 228 200 Z" fill="url(#cloth)"/>
  <path d="M286 214 L286 618 L314 618 L314 214 Q300 220 286 214 Z" fill="url(#cloth2)" opacity="0.75"/>
  ${seam("M232 214 Q252 258 258 320")}
  ${seam("M368 214 Q348 258 342 320")}
  <g fill="#fff" fill-opacity="0.6">
    <circle cx="300" cy="300" r="7"/><circle cx="300" cy="372" r="7"/>
    <circle cx="300" cy="444" r="7"/><circle cx="300" cy="516" r="7"/>
  </g>
  <g stroke="#000" stroke-opacity="0.10" stroke-width="2" fill="none">
    <path d="M222 400 L222 600"/><path d="M254 396 L254 604"/>
    <path d="M346 396 L346 604"/><path d="M378 400 L378 600"/>
  </g>`;

/* --------------------------------------------------------------- bottoms */

const trousers = (wide) => `
  <path d="M204 210 L396 210 L404 292 Q404 300 396 300 L204 300 Q196 300 196 292 Z" fill="url(#cloth2)"/>
  <path d="M199 296 L401 296 L${wide ? 438 : 414} 660 Q440 676 420 678 L346 678 Q332 678 330 664 L300 400 L270 664 Q268 678 254 678 L180 678 Q160 676 162 660 Z" fill="url(#cloth)"/>
  ${seam("M300 300 L300 400")}
  ${seam("M232 320 Q222 500 210 660")}
  ${seam("M368 320 Q378 500 390 660")}
  ${stitch("M204 236 L396 236")}
  <rect x="282" y="222" width="36" height="18" rx="4" fill="#000" fill-opacity="0.14"/>
  <g fill="none" stroke="#000" stroke-opacity="0.13" stroke-width="2">
    <path d="M226 318 Q244 340 262 322"/><path d="M338 322 Q356 340 374 318"/>
  </g>`;

const jeans = () => `
  ${trousers(false)}
  <g fill="none" stroke="#e8c98f" stroke-opacity="0.55" stroke-width="2.4" stroke-dasharray="7 5">
    <path d="M204 240 L396 240"/>
    <path d="M232 330 Q222 500 212 654"/>
    <path d="M368 330 Q378 500 388 654"/>
    <path d="M226 318 Q244 344 262 320"/>
    <path d="M338 320 Q356 344 374 318"/>
  </g>
  <path d="M300 302 L300 396" stroke="#e8c98f" stroke-opacity="0.4" stroke-width="2" fill="none"/>`;

const leggings = () => `
  <path d="M212 208 L388 208 L392 268 L208 268 Z" fill="url(#cloth2)"/>
  <path d="M209 264 L391 264 L372 668 Q370 682 356 682 L322 682 Q310 682 309 670 L300 420 L291 670 Q290 682 278 682 L244 682 Q230 682 228 668 Z" fill="url(#cloth)"/>
  ${seam("M300 268 L300 420")}
  ${seam("M244 300 Q234 500 240 664")}
  ${seam("M356 300 Q366 500 360 664")}
  <path d="M212 208 L388 208 L390 232 L210 232 Z" fill="#fff" fill-opacity="0.16"/>
  ${stitch("M266 300 Q262 480 258 660")}
  ${stitch("M334 300 Q338 480 342 660")}`;

const slipSkirt = () => `
  <path d="M214 216 L386 216 L390 262 L210 262 Z" fill="url(#cloth2)"/>
  <path d="M210 258 L390 258 L436 618 Q438 634 420 636 L180 636 Q162 634 164 618 Z" fill="url(#cloth)"/>
  ${seam("M262 264 Q246 440 224 626")}
  ${seam("M338 264 Q354 440 376 626")}
  ${seam("M300 262 L300 632")}
  <path d="M210 258 L390 258 L394 292 Q300 306 206 292 Z" fill="#fff" fill-opacity="0.14"/>`;

/* -------------------------------------------------------------- dresses */

const midiDress = () => `
  <path d="M236 178 L196 200 Q166 216 160 246 L142 322 Q139 336 153 341 L186 352 Q198 356 202 344 L212 312 L206 372 L394 372 L388 312 L398 344 Q402 356 414 352 L447 341 Q461 336 458 322 L440 246 Q434 216 404 200 L364 178 L300 236 Z" fill="url(#cloth)"/>
  <path d="M236 178 L300 236 L364 178 L344 168 Q300 198 256 168 Z" fill="url(#cloth2)"/>
  <path d="M204 366 L396 366 L410 480 L190 480 Z" fill="url(#cloth)"/>
  <path d="M188 474 L412 474 L432 596 L168 596 Z" fill="url(#cloth2)"/>
  <path d="M166 590 L434 590 L456 706 Q458 720 442 720 L158 720 Q142 720 144 706 Z" fill="url(#cloth)"/>
  ${seam("M300 240 L300 366")}
  ${stitch("M204 372 L396 372")}
  ${stitch("M188 480 L412 480")}
  ${stitch("M166 596 L434 596")}
  <path d="M206 372 L394 372 L396 392 L204 392 Z" fill="#000" fill-opacity="0.08"/>`;

/* ------------------------------------------------------------- outerwear */

const coat = () => `
  <path d="M224 178 L176 200 Q138 220 130 258 L100 396 Q96 414 113 420 L158 434 Q173 438 177 424 L192 376 L188 664 Q188 692 216 694 L384 694 Q412 692 412 664 L408 376 L423 424 Q427 438 442 434 L487 420 Q504 414 500 396 L470 258 Q462 220 424 200 L376 178 L300 250 Z" fill="url(#cloth)"/>
  <path d="M224 178 L300 250 L268 690 L216 692 Q188 690 188 664 L192 376 L177 424 Q173 438 158 434 L113 420 Q96 414 100 396 L130 258 Q138 220 176 200 Z" fill="url(#cloth2)" opacity="0.55"/>
  <path d="M224 178 L300 250 L262 262 Q232 224 210 190 Z" fill="#fff" fill-opacity="0.2"/>
  <path d="M376 178 L300 250 L338 262 Q368 224 390 190 Z" fill="#fff" fill-opacity="0.2"/>
  <path d="M186 430 L414 430 L414 470 L186 470 Z" fill="url(#cloth2)"/>
  <rect x="272" y="424" width="56" height="52" rx="8" fill="#000" fill-opacity="0.22"/>
  <g fill="#000" fill-opacity="0.2">
    <circle cx="252" cy="352" r="8"/><circle cx="348" cy="352" r="8"/>
    <circle cx="252" cy="546" r="8"/><circle cx="348" cy="546" r="8"/>
  </g>
  ${stitch("M232 500 L232 560")}
  ${stitch("M368 500 L368 560")}`;

/* ----------------------------------------------------------------- shoes */

const boots = () => {
  const one = (x, flip) => `
    <g transform="translate(${x} 0)${flip ? " scale(-1 1) translate(-260 0)" : ""}">
      <path d="M96 250 Q92 236 108 234 L186 234 Q202 236 200 252 L192 400 Q190 430 208 448 L236 474 Q248 486 246 502 L244 528 Q243 542 228 542 L104 542 Q90 542 90 528 L92 300 Z" fill="url(#cloth)"/>
      <path d="M90 528 L246 528 L246 556 Q246 568 232 568 L104 568 Q90 568 90 556 Z" fill="#2f2622"/>
      <path d="M96 250 Q92 236 108 234 L186 234 Q202 236 200 252 L198 288 L94 288 Z" fill="#fff" fill-opacity="0.14"/>
      ${seam("M120 300 Q116 420 116 520")}
      ${stitch("M104 470 L236 470")}
      <path d="M186 246 Q214 300 210 380" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="3"/>
    </g>`;
  return one(30, false) + one(310, true);
};

/* ------------------------------------------------------------------ bags */

const tote = () => `
  <path d="M170 330 L430 330 L462 646 Q464 664 446 664 L154 664 Q136 664 138 646 Z" fill="url(#cloth)"/>
  <g fill="none" stroke="#000" stroke-opacity="0.10" stroke-width="2">
    ${Array.from({ length: 11 }, (_, i) => `<path d="M${172 + i * 26} 334 L${166 + i * 28} 660"/>`).join("")}
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${170 - i * 1.6} ${360 + i * 36} L${430 + i * 1.6} ${360 + i * 36}"/>`).join("")}
  </g>
  <path d="M170 330 L430 330 L436 386 L164 386 Z" fill="#fff" fill-opacity="0.16"/>
  <g fill="none" stroke-linecap="round">
    <path d="M226 340 Q220 196 300 194 Q380 196 374 340" stroke="url(#cloth2)" stroke-width="18"/>
    <path d="M232 236 Q262 202 300 200 Q338 202 368 236" stroke="#fff" stroke-opacity="0.22" stroke-width="7"/>
  </g>`;

/* -------------------------------------------------------------- jewelry */

const studs = () => {
  const ear = (cx, cy) => `
    <g>
      <ellipse cx="${cx}" cy="${cy + 62}" rx="46" ry="11" fill="#3a2c22" opacity="0.16"/>
      <circle cx="${cx}" cy="${cy}" r="52" fill="url(#pearl)"/>
      <ellipse cx="${cx - 16}" cy="${cy - 20}" rx="17" ry="12" transform="rotate(-28 ${cx - 16} ${cy - 20})" fill="#fff" fill-opacity="0.85"/>
      <path d="M${cx - 44} ${cy + 22} A52 52 0 0 0 ${cx + 36} ${cy + 38}" fill="none" stroke="#b9a68c" stroke-opacity="0.5" stroke-width="7"/>
      <g transform="translate(${cx} ${cy})">
        <rect x="26" y="30" width="34" height="7" rx="3.5" transform="rotate(38)" fill="#c9ab63"/>
        <circle cx="45" cy="49" r="10" fill="#d8bd7d"/>
        <circle cx="45" cy="49" r="4.5" fill="#a98a4c"/>
      </g>
    </g>`;
  return `<defs>
      <radialGradient id="pearl" cx="0.34" cy="0.3" r="0.82">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.55" stop-color="#f4efe6"/>
        <stop offset="1" stop-color="#d9cdba"/>
      </radialGradient>
    </defs>${ear(214, 386)}${ear(388, 424)}`;
};

/* ---------------------------------------------------------- accessories */

/**
 * Drawn as a scarf hanging in a loop with both ends falling — a folded square
 * just reads as a cushion at card size, where the drape is unmistakable.
 */
const scarf = (base) => {
  const motifs = (seed) =>
    Array.from({ length: 9 }, (_, i) => {
      const x = 20 + (i % 2) * 46 + ((i * 13 + seed * 7) % 11);
      const y = 40 + ((i / 2) | 0) * 92 + ((i * 29 + seed * 5) % 17);
      const r = 12 + ((i + seed) % 3) * 3;
      return `<g transform="translate(${x} ${y}) rotate(${(i * 37 + seed * 23) % 60 - 30})">
        <path d="M0 ${-r} Q${r * 0.85} 0 0 ${r} Q${-r * 0.85} 0 0 ${-r}Z" fill="#fff" fill-opacity="0.62"/>
        <path d="M${-r} 0 Q0 ${r * 0.85} ${r} 0 Q0 ${-r * 0.85} ${-r} 0Z" fill="${shade(base, -0.42)}" fill-opacity="0.45"/>
        <circle r="3.4" fill="#f4e6c8"/></g>`;
    }).join("");

  const fringe = (x0, x1, y, tilt) =>
    Array.from({ length: 8 }, (_, i) => {
      const x = x0 + ((x1 - x0) / 7) * i;
      return `<path d="M${x} ${y + i * tilt} l${-2 + (i % 3)} 30" stroke="${shade(base, -0.28)}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
    }).join("");

  return `
  <defs>
    <clipPath id="tailL"><path d="M214 276 Q206 440 200 596 L286 606 Q292 434 298 288 Z"/></clipPath>
    <clipPath id="tailR"><path d="M386 276 Q394 440 400 596 L314 606 Q308 434 302 288 Z"/></clipPath>
  </defs>

  <!-- right tail sits behind, so the loop overlaps both cleanly -->
  <path d="M386 276 Q394 440 400 596 L314 606 Q308 434 302 288 Z" fill="url(#cloth2)"/>
  <g clip-path="url(#tailR)" opacity="0.55"><g transform="translate(300 276)">${motifs(3)}</g></g>
  ${fringe(316, 398, 598, -1.2)}

  <path d="M214 276 Q206 440 200 596 L286 606 Q292 434 298 288 Z" fill="url(#cloth)"/>
  <g clip-path="url(#tailL)" opacity="0.55"><g transform="translate(196 276)">${motifs(1)}</g></g>
  ${fringe(202, 284, 598, 1.2)}

  <!-- the loop -->
  <path d="M300 168 Q392 168 402 240 Q410 300 372 314 Q356 320 348 300 Q338 262 300 258 Q262 262 252 300 Q244 320 228 314 Q190 300 198 240 Q208 168 300 168 Z" fill="url(#cloth)"/>
  <path d="M300 168 Q392 168 402 240 Q406 268 392 288 Q396 250 380 222 Q352 190 300 190 Q248 190 220 222 Q204 250 208 288 Q194 268 198 240 Q208 168 300 168 Z" fill="#fff" fill-opacity="0.22"/>
  ${seam("M232 300 Q246 254 300 248 Q354 254 368 300")}
  <path d="M286 254 Q300 250 314 254 L312 300 L288 300 Z" fill="#000" fill-opacity="0.10"/>`;
};

/* ----------------------------------------------------------------- build */

const PIECES = [
  { file: "silk-blouse", base: "#efe6d6", art: blouse, backdrop: "#e8ddd0" },
  { file: "wide-leg-trousers", base: "#2b2724", art: () => trousers(true), backdrop: "#efe6db" },
  { file: "midi-dress", base: "#bf3b34", art: midiDress, backdrop: "#f0e4da" },
  { file: "wool-coat", base: "#c2a077", art: coat, backdrop: "#eee6dc" },
  { file: "ankle-boots", base: "#8a5a3c", art: boots, backdrop: "#efe7dc" },
  { file: "market-tote", base: "#d9c092", art: tote, backdrop: "#ece4d8" },
  { file: "slip-skirt", base: "#2f6b4f", art: slipSkirt, backdrop: "#eae4d8" },
  { file: "pearl-studs", base: "#f2ece2", art: studs, backdrop: "#e6dcd0", scale: 1.85 },
  { file: "cashmere-cardigan", base: "#d8c4a8", art: cardigan, backdrop: "#ece3d6" },
  { file: "straight-jeans", base: "#41618c", art: jeans, backdrop: "#ece5da" },
  { file: "running-leggings", base: "#4a4a4e", art: leggings, backdrop: "#ebe4da" },
  { file: "silk-scarf", base: "#a8456a", art: (b) => scarf(b), backdrop: "#eee5d9" },
];

mkdirSync(OUT, { recursive: true });
for (const { file, base, art, backdrop, scale } of PIECES) {
  writeFileSync(
    join(OUT, `${file}.svg`),
    frame(file, base, art(base), { backdrop, scale }),
  );
}
console.log(`Wrote ${PIECES.length} flat-lays to public/sample/`);
