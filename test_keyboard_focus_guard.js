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
    await page.focus('#bpm-input');
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        active.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 60));

    const values = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(values.gate < 0.05, 'Focused input should block keyboard note triggering');

    console.log('Keyboard focus guard test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Keyboard focus guard test failed:', err);
  process.exit(1);
});
