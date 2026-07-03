import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer';

const BASELINE_DIR = path.join(process.cwd(), 'test', 'visual-baselines', 'workspace');
const UPDATE_BASELINES = process.env.UPDATE_VISUAL_BASELINES === '1';

const SCENARIOS = [
  {
    name: 'default-chain',
    labelHint: 'classic mono lead',
    clip: { x: 0, y: 44, width: 2048, height: 1220 },
  },
  {
    name: 'lfo-modulated-filter',
    labelHint: 'wobble',
    clip: { x: 0, y: 44, width: 2048, height: 1220 },
  },
  {
    name: 'palette-visible',
    labelHint: 'classic mono lead',
    clip: { x: 1510, y: 54, width: 300, height: 560 },
  },
];

async function openPresetAndLoad(page, labelContains) {
  const ensurePresetDrawer = async () => {
    const hasSelect = await page.evaluate(() => !!document.querySelector('aside select'));
    if (hasSelect) return;
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((el) => (el.textContent || '').trim().toLowerCase() === 'preset');
      btn?.click();
    });
    await page.waitForSelector('aside select');
  };

  await ensurePresetDrawer();

  const selected = await page.evaluate((needle) => {
    const select = document.querySelector('aside select');
    if (!select) return '';

    const options = Array.from(select.options);
    const match = options.find((o) => (o.textContent || '').toLowerCase().includes(needle.toLowerCase()));
    const fallback = options.find((o) => o.value);
    const picked = match || fallback;
    if (!picked) return '';

    select.value = picked.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return picked.textContent || '';
  }, labelContains);

  if (!selected) {
    throw new Error(`Unable to select preset for scenario hint: ${labelContains}`);
  }

  await page.evaluate(() => {
    const loadBtn = Array.from(document.querySelectorAll('button'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'load preset');
    loadBtn?.click();
  });

  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

function ensureBaselineMatch(name, currentPath) {
  const baselinePath = path.join(BASELINE_DIR, `${name}.png`);
  const currentBuffer = fs.readFileSync(currentPath);

  if (UPDATE_BASELINES || !fs.existsSync(baselinePath)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.copyFileSync(currentPath, baselinePath);
    return { updated: true, baselinePath };
  }

  const baselineBuffer = fs.readFileSync(baselinePath);
  assert.deepEqual(
    currentBuffer,
    baselineBuffer,
    `Visual regression mismatch for ${name}. Re-run with UPDATE_VISUAL_BASELINES=1 to update baseline after review.`
  );
  return { updated: false, baselinePath };
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeskola-visual-'));

  try {
    await page.setViewport({ width: 2048, height: 1400 });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    const results = [];

    for (const scenario of SCENARIOS) {
      await openPresetAndLoad(page, scenario.labelHint);

      const outPath = path.join(runDir, `${scenario.name}.png`);
      await page.screenshot({ path: outPath, clip: scenario.clip });
      const outcome = ensureBaselineMatch(scenario.name, outPath);
      results.push({ name: scenario.name, ...outcome });
    }

    const updatedCount = results.filter((r) => r.updated).length;
    if (updatedCount > 0) {
      console.log(`Workspace visual baselines created/updated (${updatedCount}):`);
      for (const result of results.filter((r) => r.updated)) {
        console.log(`- ${result.name}: ${result.baselinePath}`);
      }
    } else {
      console.log('Workspace visual regression test passed');
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Workspace visual regression test failed:', err);
  process.exit(1);
});
