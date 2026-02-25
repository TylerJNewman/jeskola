import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      document.getElementById('btn-master-play')?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    const summary = await page.evaluate(async () => {
      const openApply = document.querySelector('.apply-open-btn');
      openApply?.click();
      const drawer = document.querySelector('.apply-drawer');
      if (!drawer) throw new Error('Apply drawer missing');

      const sourceType = drawer.querySelector('.apply-source-type');
      const sourceItem = drawer.querySelector('.apply-source-item');
      const mode = drawer.querySelector('.apply-mode');
      const summaryEl = drawer.querySelector('.apply-summary');

      sourceType.value = 'preset';
      sourceType.dispatchEvent(new Event('change', { bubbles: true }));
      sourceItem.value = 'sub-bass';
      sourceItem.dispatchEvent(new Event('change', { bubbles: true }));
      mode.value = 'add_layer';
      mode.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 100));
      return summaryEl?.textContent || '';
    });

    assert.ok(summary.includes('Adds modules:'), 'Expected preview summary to include module count');
    assert.ok(summary.includes('Adds connections:'), 'Expected preview summary to include connection count');
    assert.ok(summary.includes('Renamed IDs:'), 'Expected preview summary to include rename count');

    console.log('Apply preview summary test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Apply preview summary test failed:', err);
  process.exit(1);
});
