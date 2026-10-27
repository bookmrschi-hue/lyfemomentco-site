// Original placeholder artwork for the magazine page, drawn as inline SVG.
// Everything here is typographic or an empty photo frame: no photos, faces,
// customer work or third-party artwork. Replace with real images by setting
// `image` on a product in magazine/content.json.

export const C = {
  butter: '#FBE29D',
  butterLight: '#FDF0C8',
  powder: '#A9CBE8',
  powderLight: '#DDEAF6',
  white: '#FFFFFF',
  copper: '#775537',
  turquoise: '#1BA3A8',
  ink: '#3A2A1C',
};

const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const SANS = "Jost, 'Helvetica Neue', Arial, sans-serif";
const SCRIPT = "Damion, 'Brush Script MT', cursive";

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

function stripes(id, color, w = 14) {
  return `<pattern id="${id}" width="${w * 2}" height="10" patternUnits="userSpaceOnUse"><rect width="${w * 2}" height="10" fill="${C.white}"/><rect width="${w}" height="10" fill="${color}"/></pattern>`;
}

// Empty photo frame with a small sun-and-hills glyph.
function frame(x, y, w, h, { fill = C.powderLight, label = 'Your photo', r = 6, labelSize } = {}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = Math.min(w, h);
  const g = s * 0.16;
  const fs = labelSize || Math.max(10, Math.round(s * 0.075));
  const showLabel = label && s > 70;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${C.copper}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="6 5"/>
    <circle cx="${cx + g * 0.9}" cy="${cy - g * 0.9}" r="${g * 0.35}" fill="${C.white}"/>
    <path d="M${cx - g * 1.5} ${cy + g * 0.6} L${cx - g * 0.4} ${cy - g * 0.5} L${cx + g * 0.4} ${cy + g * 0.2} L${cx + g * 0.9} ${cy - g * 0.2} L${cx + g * 1.5} ${cy + g * 0.6} Z" fill="${C.white}"/>
    ${showLabel ? `<text x="${cx}" y="${cy + g * 1.5}" text-anchor="middle" font-family="${SANS}" font-size="${fs}" font-weight="500" fill="${C.copper}">${label}</text>` : ''}
  </g>`;
}

function lines(x, y, w, n, { gap = 12, h = 4, color = C.copper, opacity = 0.35, last = 0.6 } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const lw = i === n - 1 ? w * last : w;
    out += `<rect x="${x}" y="${y + i * gap}" width="${lw}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="${opacity}"/>`;
  }
  return out;
}

// A magazine cover drawn at (x, y) with width w; height follows a 1:1.33 ratio.
function cover(x, y, w, { title = 'Cover Story', kicker = 'The Birthday Issue', name = 'Your Name Here', id } = {}) {
  const h = w * 1.33;
  const pid = id || nextId('cs');
  const pad = w * 0.07;
  return `<g>
    <defs>${stripes(pid, C.butter, w * 0.045)}</defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.02}" fill="${C.white}"/>
    <text x="${x + w / 2}" y="${y + pad + w * 0.13}" text-anchor="middle" font-family="${SERIF}" font-weight="800" font-size="${w * 0.15}" fill="${C.copper}">${title}</text>
    <text x="${x + w / 2}" y="${y + pad + w * 0.205}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="${w * 0.042}" letter-spacing="${w * 0.006}" fill="${C.ink}">VOL. 01 · ${name.toUpperCase()}</text>
    ${frame(x + pad, y + pad + w * 0.25, w - pad * 2, h * 0.52, { fill: C.powderLight })}
    <text x="${x + pad}" y="${y + h * 0.88}" font-family="${SCRIPT}" font-size="${w * 0.085}" fill="${C.copper}">${kicker}</text>
    <rect x="${x}" y="${y + h - w * 0.06}" width="${w}" height="${w * 0.06}" fill="url(#${pid})"/>
  </g>`;
}

function page(x, y, w, h, inner, { fill = C.white } = {}) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}"/>${inner}</g>`;
}

function svg(viewBox, body, { label, cls = 'art' } = {}) {
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" viewBox="${viewBox}" ${aria} xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// ---------- Product thumbnails (4:3 card art) ----------

const productMotifs = {
  magazine: () => {
    const bg = C.butterLight;
    return `<rect width="400" height="300" fill="${bg}"/>
      <g transform="rotate(-5 230 150)">${page(170, 40, 150, 200, lines(185, 70, 120, 6, { gap: 18 }))}</g>
      <g transform="rotate(3 150 150)">${cover(90, 30, 160, { kicker: 'Our favorite chapters' })}</g>`;
  },
  templates: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      ${[0, 1, 2].map((i) => {
        const x = 50 + i * 105;
        return page(x, 50 + (i % 2) * 14, 90, 120, `${frame(x + 10, 60 + (i % 2) * 14, 70, i === 1 ? 50 : 70, { label: '' })}${lines(x + 12, (i === 1 ? 122 : 142) + (i % 2) * 14, 64, i === 1 ? 4 : 2, { gap: 10, h: 3 })}`);
      }).join('')}
      <text x="200" y="230" text-anchor="middle" font-family="${SCRIPT}" font-size="30" fill="${C.copper}">pick a layout</text>`,
  pocket: () => `<rect width="400" height="300" fill="${C.butterLight}"/>
      <g transform="rotate(-4 200 150)">${cover(150, 55, 100, { title: 'Pocket', kicker: 'little moments' })}</g>`,
  newspaper: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      ${page(95, 25, 210, 260, `
        <text x="200" y="62" text-anchor="middle" font-family="${SERIF}" font-weight="800" font-size="26" fill="${C.ink}">The Daily Moment</text>
        <rect x="110" y="72" width="180" height="2" fill="${C.ink}"/>
        <text x="110" y="100" font-family="${SERIF}" font-weight="700" font-size="17" fill="${C.copper}">Big news, made personal</text>
        ${frame(110, 112, 100, 80, { label: '' })}
        ${lines(220, 116, 70, 6, { gap: 13, h: 3 })}
        ${lines(110, 206, 85, 5, { gap: 13, h: 3 })}
        ${lines(205, 206, 85, 5, { gap: 13, h: 3 })}`)}`,
  stickers: () => `<rect width="400" height="300" fill="${C.butterLight}"/>
      ${page(60, 50, 140, 190, '', { fill: C.white })}${page(200, 50, 140, 190, '', { fill: C.white })}
      <rect x="199" y="50" width="2" height="190" fill="${C.copper}" fill-opacity=".25"/>
      ${frame(78, 70, 50, 50, { label: '', r: 14 })}${frame(138, 100, 46, 46, { label: '', r: 23 })}${frame(85, 160, 60, 60, { label: '', r: 14 })}
      ${frame(222, 72, 58, 58, { label: '', r: 29 })}${frame(285, 130, 44, 44, { label: '', r: 12 })}${frame(225, 168, 52, 52, { label: '', r: 12 })}
      <path d="M318 82c-6-10-22-6-18 6 3 8 18 16 18 16s15-8 18-16c4-12-12-16-18-6z" fill="${C.turquoise}" fill-opacity=".8"/>`,
  photocard: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      <g transform="rotate(-3 200 150)">${page(110, 40, 180, 220, `${frame(125, 55, 150, 130)}<text x="200" y="215" text-anchor="middle" font-family="${SCRIPT}" font-size="26" fill="${C.copper}">with love</text>${lines(150, 232, 100, 1, { h: 3 })}`)}</g>`,
  instant: () => `<rect width="400" height="300" fill="${C.butterLight}"/>
      <g transform="rotate(-8 150 150)">${page(80, 55, 130, 155, frame(92, 67, 106, 106, { label: '' }))}</g>
      <g transform="rotate(6 250 150)">${page(190, 60, 130, 155, `${frame(202, 72, 106, 106, { label: '' })}<text x="255" y="200" text-anchor="middle" font-family="${SCRIPT}" font-size="18" fill="${C.copper}">best day</text>`)}</g>`,
  duo: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      ${page(70, 60, 120, 170, `${frame(80, 70, 100, 110, { label: 'then' })}${lines(90, 198, 80, 2, { gap: 10, h: 3 })}`)}
      ${page(210, 60, 120, 170, `${frame(220, 70, 100, 110, { label: 'now' })}${lines(230, 198, 80, 2, { gap: 10, h: 3 })}`)}`,
  prints: () => `<rect width="400" height="300" fill="${C.butterLight}"/>
      <g transform="rotate(-9 200 160)">${page(120, 70, 160, 120, frame(128, 78, 144, 104, { label: '' }))}</g>
      <g transform="rotate(-2 200 160)">${page(120, 70, 160, 120, frame(128, 78, 144, 104, { label: '' }))}</g>
      <g transform="rotate(5 200 160)">${page(120, 70, 160, 120, frame(128, 78, 144, 104))}</g>`,
  strip: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      <g transform="rotate(-4 200 150)">${page(165, 15, 70, 270, [0, 1, 2, 3].map((i) => frame(173, 23 + i * 62, 54, 54, { label: '' })).join(''))}</g>`,
  giftbox: () => {
    const id = nextId('gb');
    return `<rect width="400" height="300" fill="${C.butterLight}"/>
      <defs>${stripes(id, C.powder, 12)}</defs>
      <rect x="120" y="120" width="160" height="130" rx="6" fill="url(#${id})"/>
      <rect x="110" y="100" width="180" height="34" rx="6" fill="${C.powder}"/>
      <rect x="192" y="100" width="16" height="150" fill="${C.copper}" fill-opacity=".85"/>
      <path d="M200 100c-20-30-55-25-45-5 6 10 45 5 45 5zM200 100c20-30 55-25 45-5-6 10-45 5-45 5z" fill="none" stroke="${C.copper}" stroke-width="6" stroke-linejoin="round"/>
      ${page(268, 150, 70, 46, `<text x="303" y="179" text-anchor="middle" font-family="${SCRIPT}" font-size="16" fill="${C.copper}">for you</text>`)}`;
  },
  bundle: () => `<rect width="400" height="300" fill="${C.powderLight}"/>
      <g transform="rotate(-4 150 150)">${cover(70, 40, 140, { kicker: 'The whole story' })}</g>
      <g transform="rotate(6 280 150)">${page(240, 40, 50, 200, [0, 1, 2].map((i) => frame(246, 48 + i * 62, 38, 54, { label: '' })).join(''))}</g>
      <g transform="rotate(-3 320 210)">${page(270, 170, 100, 80, frame(278, 178, 84, 64, { label: '' }))}</g>`,
};

export function productArt(motif, label) {
  const fn = productMotifs[motif];
  if (!fn) throw new Error(`Unknown product motif "${motif}". Use one of: ${Object.keys(productMotifs).join(', ')}`);
  return svg('0 0 400 300', fn(), { label });
}

// ---------- Personalization journey pages ----------

const journeyMotifs = {
  cover: () => `<rect width="600" height="460" fill="${C.butterLight}"/>${cover(200, 30, 200, { kicker: 'The Birthday Issue' })}`,
  opening: () => `<rect width="600" height="460" fill="${C.powderLight}"/>
    ${page(200, 30, 200, 400, `
      <text x="300" y="90" text-anchor="middle" font-family="${SCRIPT}" font-size="30" fill="${C.copper}">Dear you,</text>
      ${lines(225, 120, 150, 10, { gap: 16, h: 4 })}
      <text x="300" y="320" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="18" fill="${C.ink}">This one is for you.</text>
      ${frame(260, 345, 80, 60, { label: '' })}`)}`,
  spread: () => `<rect width="600" height="460" fill="${C.butterLight}"/>
    ${page(60, 40, 240, 380, `${frame(75, 55, 210, 230)}<text x="75" y="318" font-family="${SERIF}" font-weight="800" font-size="24" fill="${C.copper}">That summer</text>${lines(75, 334, 200, 4, { gap: 14, h: 4 })}`)}
    ${page(300, 40, 240, 380, `${frame(315, 55, 100, 120, { label: '' })}${frame(425, 55, 100, 120, { label: '' })}${frame(315, 185, 210, 140)}${lines(315, 345, 200, 3, { gap: 14, h: 4 })}`)}
    <rect x="299" y="40" width="2" height="380" fill="${C.copper}" fill-opacity=".25"/>`,
  closing: () => `<rect width="600" height="460" fill="${C.powderLight}"/>
    ${page(200, 30, 200, 400, `
      ${frame(220, 50, 160, 170)}
      <text x="300" y="260" text-anchor="middle" font-family="${SERIF}" font-weight="800" font-size="22" fill="${C.copper}">To many more</text>
      ${lines(225, 285, 150, 6, { gap: 16, h: 4 })}
      <text x="300" y="400" text-anchor="middle" font-family="${SCRIPT}" font-size="26" fill="${C.copper}">love, all of us</text>`)}`,
  back: () => {
    const id = nextId('bc');
    return `<rect width="600" height="460" fill="${C.butterLight}"/><defs>${stripes(id, C.powder, 14)}</defs>
    ${page(200, 30, 200, 400, `<rect x="200" y="30" width="200" height="400" rx="4" fill="url(#${id})"/>
      <rect x="225" y="150" width="150" height="160" rx="6" fill="${C.white}"/>
      ${frame(240, 165, 120, 90, { label: '' })}
      <text x="300" y="290" text-anchor="middle" font-family="${SCRIPT}" font-size="22" fill="${C.copper}">the end, for now</text>`)}`;
  },
};

export function journeyArt(motif, label) {
  const fn = journeyMotifs[motif];
  if (!fn) throw new Error(`Unknown journey motif "${motif}"`);
  return svg('0 0 600 460', fn(), { label });
}

// ---------- Hero mockup: a cover in front of an open spread ----------

export function heroArt(label) {
  const sid = nextId('hs');
  return svg('0 0 560 620', `
    <defs>${stripes(sid, C.powder, 18)}</defs>
    <ellipse cx="290" cy="590" rx="230" ry="18" fill="${C.copper}" fill-opacity=".12"/>
    <g transform="rotate(6 360 300)">
      <rect x="190" y="70" width="340" height="460" rx="6" fill="${C.white}"/>
      <rect x="190" y="70" width="340" height="56" fill="url(#${sid})"/>
      ${frame(215, 150, 290, 200)}
      <text x="350" y="392" font-family="${SERIF}" font-weight="800" font-size="30" fill="${C.copper}">Chapter two</text>
      ${lines(350, 410, 150, 6, { gap: 16, h: 5 })}
    </g>
    <g transform="rotate(-4 200 330)">
      ${cover(40, 90, 300, { title: 'Cover Story', kicker: 'The Birthday Issue', name: 'Your Name Here' })}
    </g>`, { label, cls: 'art art--hero' });
}

// ---------- Social and Pinterest artwork (rendered to PNG/JPG) ----------

export function coverForSocial(x, y, w, opts) {
  return cover(x, y, w, opts);
}
export { frame as socialFrame, stripes as socialStripes, lines as socialLines };
