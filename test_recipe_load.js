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
      const controls = document.querySelector('.controls');
      if (!controls) {
        throw new Error('Controls not found');
      }

      const allSelects = Array.from(controls.querySelectorAll('select'));
      const recipeSelect = allSelects.find((sel) =>
        Array.from(sel.querySelectorAll('option')).some((opt) => opt.value === 'classic-acid-bassline')
      );
      const recipeBtn = Array.from(controls.querySelectorAll('.control-btn'))
        .find((el) => el.textContent?.trim() === 'LOAD RECIPE');

      if (!recipeSelect || !recipeBtn) {
        throw new Error('Recipe controls not found');
      }

      recipeSelect.value = 'classic-acid-bassline';
      recipeBtn.click();
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
      'mod-envelope-pump-gain',
      'mod-envelope-pump-adsr'
    ];

    assert.equal(result.moduleIds.length, expectedIds.length, 'Unexpected module count for classic acid recipe');
    for (const id of expectedIds) {
      assert.ok(result.moduleIds.includes(id), `Expected module id ${id} in classic acid recipe`);
    }

    assert.equal(result.cableCount, 5, 'Unexpected cable count for classic acid recipe');

    console.log('Recipe load test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Recipe load test failed:', err);
  process.exit(1);
});
