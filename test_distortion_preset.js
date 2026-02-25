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

      const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
      presetChip?.click();

      const presetPanel = document.querySelector('.toolbar-section-panel[data-section="preset"]');
      const presetSelect = presetPanel?.querySelector('select');
      const loadPresetBtn = Array.from(presetPanel?.querySelectorAll('.control-btn') || [])
        .find((b) => b.textContent?.trim() === 'LOAD PRESET');

      if (!presetSelect || !loadPresetBtn) {
        throw new Error('Preset controls not found');
      }

      presetSelect.value = 'acid-drive';
      loadPresetBtn.click();

      await new Promise((r) => setTimeout(r, 250));
    });

    const result = await page.evaluate(() => {
      const moduleIds = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');

      const cableCount = document.querySelectorAll('#cables-layer path.cable').length;

      return { moduleIds, cableCount };
    });

    const expectedIds = ['master', 'drive-osc', 'drive-dist', 'drive-filter'];

    assert.equal(result.moduleIds.length, expectedIds.length, `Expected ${expectedIds.length} modules after acid-drive import`);
    for (const id of expectedIds) {
      assert.ok(result.moduleIds.includes(id), `Expected module id ${id} to exist`);
    }

    assert.equal(result.cableCount, 3, 'Expected 3 cables for acid-drive preset');

    console.log('Distortion preset test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Distortion preset test failed:', err);
  process.exit(1);
});
