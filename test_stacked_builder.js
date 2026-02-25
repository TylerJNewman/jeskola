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

      const allSelects = Array.from(stackPanel.querySelectorAll('select'));
      const stackBaseSelect = allSelects.find((sel) =>
        !Array.from(sel.querySelectorAll('option')).some((opt) => opt.value === '') &&
        Array.from(sel.querySelectorAll('option')).some((opt) => opt.value === 'acid-drive')
      );
      const stackModifierSelects = allSelects.filter((sel) =>
        Array.from(sel.querySelectorAll('option')).some((opt) => opt.value === 'slow-wobble')
      );
      const stackBtn = Array.from(stackPanel.querySelectorAll('.control-btn'))
        .find((el) => el.textContent?.trim() === 'LOAD STACK');

      if (!stackBaseSelect || stackModifierSelects.length < 2 || !stackBtn) {
        throw new Error('Stack controls not found');
      }

      stackBaseSelect.value = 'acid-drive';
      stackModifierSelects[0].value = 'slow-wobble';
      stackModifierSelects[1].value = 'envelope-pump';
      if (stackModifierSelects[2]) stackModifierSelects[2].value = '';

      stackBtn.click();
      await new Promise((r) => setTimeout(r, 250));
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

    assert.equal(result.moduleIds.length, expectedIds.length, 'Unexpected module count for stacked preset builder');
    for (const id of expectedIds) {
      assert.ok(result.moduleIds.includes(id), `Expected module id ${id} in stacked preset`);
    }

    assert.equal(result.cableCount, 6, 'Unexpected cable count for stacked preset builder');

    console.log('Stacked preset builder test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Stacked preset builder test failed:', err);
  process.exit(1);
});
