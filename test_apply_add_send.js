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
      const applyBtn = drawer.querySelector('.apply-apply-btn');

      sourceType.value = 'preset';
      sourceType.dispatchEvent(new Event('change', { bubbles: true }));
      sourceItem.value = 'electro-fm-bell';
      sourceItem.dispatchEvent(new Event('change', { bubbles: true }));

      mode.value = 'add_send';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      targetType.value = 'master_send';
      targetType.dispatchEvent(new Event('change', { bubbles: true }));

      applyBtn.click();
      await new Promise((r) => setTimeout(r, 250));
    });

    const result = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');
      const cables = document.querySelectorAll('#cables-layer path.cable').length;
      return { ids, cables };
    });

    assert.ok(result.ids.includes('bell-filter'), 'Expected send chain module to be added');
    assert.ok(result.cables >= 3, 'Expected send apply to create extra routes');

    console.log('Apply add_send test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Apply add_send test failed:', err);
  process.exit(1);
});
