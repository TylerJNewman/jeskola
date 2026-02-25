import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    await page.evaluate(async () => {
      const startBtn = document.getElementById('btn-master-play');
      startBtn?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    await page.evaluate(async () => {
      const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
      presetChip?.click();

      const presetPanel = document.querySelector('.toolbar-section-panel[data-section="preset"]');
      const presetSelect = presetPanel?.querySelector('select');
      const loadPresetBtn = Array.from(presetPanel?.querySelectorAll('.control-btn') || [])
        .find((b) => b.textContent?.trim() === 'LOAD PRESET');
      if (!presetSelect || !loadPresetBtn) {
        throw new Error('Preset controls not found');
      }

      const order = [
        'sub-bass',
        'ethereal-drone',
        'sci-fi-fm',
        'classic-pluck',
        'acid-bass-sweep',
        'acid-drive',
        'ambient-pad',
        'wobble-bass'
      ];

      for (const key of order) {
        presetSelect.value = key;
        loadPresetBtn.click();
      }

      await new Promise((r) => setTimeout(r, 200));
    });

    const result = await page.evaluate(() => {
      const moduleEls = Array.from(document.querySelectorAll('.module[data-id]'));
      const moduleIds = moduleEls
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');

      const cableCount = document.querySelectorAll('#cables-layer path.cable').length;
      return { moduleIds, cableCount };
    });

    const expectedIds = ['master', 'wobble-osc', 'wobble-filter', 'wobble-lfo', 'wobble-gain'];

    assert.equal(result.moduleIds.length, expectedIds.length, `Expected ${expectedIds.length} modules after final import`);
    for (const id of expectedIds) {
      assert.ok(result.moduleIds.includes(id), `Expected module id ${id} to exist after rapid imports`);
    }

    // wobble-bass has 4 connections
    assert.equal(result.cableCount, 4, 'Expected cable count to match final preset graph');

    console.log('Rapid import switch test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Rapid import switch test failed:', err);
  process.exit(1);
});
