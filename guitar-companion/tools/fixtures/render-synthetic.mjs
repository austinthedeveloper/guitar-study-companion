// Renders synthetic (invented, copyright-free) tab images for e2e and
// fixture tests into fixtures/synthetic/. Re-run when the design changes:
//   node tools/fixtures/render-synthetic.mjs
// The .heic variant is produced separately with macOS `sips` (see README).
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// Invented lick (also the expected transcription), high string = index 0.
const events = [
  { order: 0, stringIndex: 1, fret: 15, label: '15' },
  { order: 1, stringIndex: 0, fret: 15, label: '15' },
  { order: 2, stringIndex: 0, fret: 17, label: '17' },
  { order: 3, stringIndex: 1, fret: 17, label: '17' },
  { order: 4, stringIndex: 1, fret: 15, label: '15' },
  { order: 5, stringIndex: 2, fret: 14, label: '14' },
  { order: 5, stringIndex: 1, fret: 15, label: '15' },
  { order: 6, stringIndex: 3, fret: null, label: 'x' },
  { order: 7, stringIndex: 2, fret: 12, label: '12' },
];

const W = 1400,
  H = 460,
  top = 220,
  gap = 34,
  left = 190,
  step = 130;
const lines = Array.from(
  { length: 6 },
  (_, i) =>
    `<line x1="80" x2="${W - 60}" y1="${top + i * gap}" y2="${top + i * gap}" stroke="#222" stroke-width="2"/>`,
).join('');
const notes = events
  .map((e) => {
    const x = left + e.order * step,
      y = top + e.stringIndex * gap;
    return `<rect x="${x - 18}" y="${y - 14}" width="36" height="28" fill="#fdfcf8"/><text x="${x}" y="${y + 9}" font-size="26" text-anchor="middle" font-family="Times New Roman, serif">${e.label}</text>`;
  })
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#fdfcf8"/>
  <text x="80" y="70" font-size="30" font-weight="bold" font-family="Times New Roman, serif">Synthetic Test Lick</text>
  <text x="80" y="110" font-size="20" font-family="Times New Roman, serif" fill="#444">Invented for automated tests. Not from any publication.</text>
  ${lines}
  <text x="92" y="${top + 2 * gap - 10}" font-size="22" font-weight="bold" font-family="serif">T</text>
  <text x="92" y="${top + 3 * gap - 6}" font-size="22" font-weight="bold" font-family="serif">A</text>
  <text x="92" y="${top + 4 * gap - 2}" font-size="22" font-weight="bold" font-family="serif">B</text>
  <path d="M ${left + 10} ${top + gap - 18} q 10 -30 20 -42" stroke="#222" fill="none" stroke-width="2"/>
  <text x="${left + 30}" y="${top - 62}" font-size="20" font-family="serif">full</text>
  ${notes}
  <line x1="80" x2="80" y1="${top}" y2="${top + 5 * gap}" stroke="#222" stroke-width="2"/>
  <line x1="${W - 60}" x2="${W - 60}" y1="${top}" y2="${top + 5 * gap}" stroke="#222" stroke-width="2"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await page.screenshot({ path: 'fixtures/synthetic/synthetic-lick.png' });
await page.screenshot({
  path: 'fixtures/synthetic/synthetic-lick.jpg',
  type: 'jpeg',
  quality: 90,
});
await browser.close();

writeFileSync(
  'fixtures/synthetic/synthetic-lick.expected.json',
  JSON.stringify(
    {
      stringCount: 6,
      rhythmKnown: false,
      events: events.map(({ order, stringIndex, fret }, i) => ({
        id: `e${i + 1}`,
        order,
        stringIndex,
        fret,
        durationTicks: null,
        techniques: fret === null ? ['dead-note'] : i === 0 ? ['bend'] : [],
        ...(i === 0 ? { bendSemitones: 2 } : {}),
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Rendered fixtures/synthetic/synthetic-lick.{png,jpg} and expected JSON',
);
