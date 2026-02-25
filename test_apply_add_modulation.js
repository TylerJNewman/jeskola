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

    await page.evaluate(async () => {
      const openApply = document.querySelector('.apply-open-btn');
      openApply?.click();
      const drawer = document.querySelector('.apply-drawer');
      if (!drawer) throw new Error('Apply drawer missing');

      const sourceType = drawer.querySelector('.apply-source-type');
      const sourceItem = drawer.querySelector('.apply-source-item');
      const mode = drawer.querySelector('.apply-mode');
      const targetType = drawer.querySelector('.apply-target-type');
      const targetModule = drawer.querySelector('.apply-target-module');
      const applyBtn = drawer.querySelector('.apply-apply-btn');

      sourceType.value = 'preset';
      sourceType.dispatchEvent(new Event('change', { bubbles: true }));
      sourceItem.value = 'wobble-bass';
      sourceItem.dispatchEvent(new Event('change', { bubbles: true }));

      mode.value = 'add_modulation';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      targetType.value = 'auto';
      targetType.dispatchEvent(new Event('change', { bubbles: true }));
      if (targetModule.options.length > 1) {
        targetModule.selectedIndex = 1;
      }
      targetModule.dispatchEvent(new Event('change', { bubbles: true }));

      applyBtn.click();
      await new Promise((r) => setTimeout(r, 250));
    });

    const result = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');
      return { ids };
    });

    assert.ok(result.ids.includes('wobble-lfo'), 'Expected modulation source module to be added');
    assert.ok(result.ids.length > 2, 'Expected additive modulation to add modules');

    console.log('Apply add_modulation test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Apply add_modulation test failed:', err);
  process.exit(1);
});
