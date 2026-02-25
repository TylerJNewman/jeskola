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
      const keyboardBtn = document.querySelector('.add-module-btn[data-type="keyboard"]');
      keyboardBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 120));
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    await new Promise((r) => setTimeout(r, 40));

    const beforeBlur = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });
    assert.ok(beforeBlur.gate > 0.9, 'Precondition failed: gate should be high before blur');

    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await new Promise((r) => setTimeout(r, 60));

    const afterBlur = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });
    assert.ok(afterBlur.gate < 0.05, 'Blur should force all keyboard gates off');

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    });

    console.log('Keyboard blur cleanup test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Keyboard blur cleanup test failed:', err);
  process.exit(1);
});
