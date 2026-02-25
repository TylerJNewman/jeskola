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

    const runLoadCheck = async (presetKey, expectedIds, expectedCableCount) => {
      await page.evaluate(async ({ presetKey }) => {
        const presetSelect = document.querySelector('.select-preset');
        const buttons = Array.from(document.querySelectorAll('.controls .control-btn'));
        const loadPresetBtn = buttons.find((b) => b.textContent?.trim() === 'LOAD PRESET');

        if (!presetSelect || !loadPresetBtn) {
          throw new Error('Preset controls not found');
        }

        presetSelect.value = presetKey;
        loadPresetBtn.click();
        await new Promise((r) => setTimeout(r, 250));
      }, { presetKey });

      const result = await page.evaluate(() => {
        const moduleIds = Array.from(document.querySelectorAll('.module[data-id]'))
          .map((el) => el.getAttribute('data-id'))
          .filter((id) => typeof id === 'string');

        const cableCount = document.querySelectorAll('#cables-layer path.cable').length;

        return { moduleIds, cableCount };
      });

      assert.equal(result.moduleIds.length, expectedIds.length, `Expected ${expectedIds.length} modules for ${presetKey}`);
      for (const id of expectedIds) {
        assert.ok(result.moduleIds.includes(id), `Expected module id ${id} for ${presetKey}`);
      }
      assert.equal(result.cableCount, expectedCableCount, `Unexpected cable count for ${presetKey}`);
    };

    await runLoadCheck(
      'acid-drive-slow-wobble',
      ['master', 'drive-osc', 'drive-dist', 'drive-filter', 'mod-slow-wobble-lfo'],
      4
    );

    await runLoadCheck(
      'classic-pluck-wide-echo',
      ['master', 'pluck-osc', 'pluck-adsr', 'pluck-gain', 'pluck-delay', 'mod-wide-echo-delay'],
      5
    );

    console.log('Composed preset load test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Composed preset load test failed:', err);
  process.exit(1);
});
