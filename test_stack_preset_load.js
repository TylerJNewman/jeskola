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
      const stackChip = document.querySelector('.toolbar-section-chip[data-section="stack"]');
      stackChip?.click();

      const stackPanel = document.querySelector('.toolbar-section-panel[data-section="stack"]');
      if (!stackPanel) {
        throw new Error('Stack panel not found');
      }

      const stackPresetSelect = stackPanel.querySelector('.stack-preset-select');
      const loadStackPresetBtn = Array.from(stackPanel.querySelectorAll('.control-btn'))
        .find((el) => el.textContent?.trim() === 'LOAD STACK PRESET');

      if (!stackPresetSelect || !loadStackPresetBtn) {
        throw new Error('Stack preset controls not found');
      }

      // 0 = Acid Movement
      stackPresetSelect.value = '0';
      loadStackPresetBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    const result = await page.evaluate(() => {
      const moduleIds = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');

      const cableCount = document.querySelectorAll('#cables-layer path.cable').length;
      return { moduleIds, cableCount };
    });

    const expectedIds = [
      'master',
      'drive-osc',
      'drive-dist',
      'drive-filter',
      'mod-slow-wobble-lfo',
      'mod-envelope-pump-gain',
      'mod-envelope-pump-adsr'
    ];

    assert.equal(result.moduleIds.length, expectedIds.length, 'Unexpected module count for stack preset load');
    for (const id of expectedIds) {
      assert.ok(result.moduleIds.includes(id), `Expected module id ${id} in stack preset load`);
    }
    assert.equal(result.cableCount, 6, 'Unexpected cable count for stack preset load');

    console.log('Stack preset load test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Stack preset load test failed:', err);
  process.exit(1);
});
