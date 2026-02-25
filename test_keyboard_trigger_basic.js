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

    const pressed = await page.evaluate(() => {
      const ws = window._workspace;
      const kb = ws.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(pressed.gate > 0.9, 'Gate should be on when key is held');
    assert.ok(Math.abs(pressed.noteCv - 0) < 0.03, 'A key should map to C4 (0V)');

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    });
    await new Promise((r) => setTimeout(r, 60));

    const released = await page.evaluate(() => {
      const ws = window._workspace;
      const kb = ws.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(released.gate < 0.05, 'Gate should return to zero on key release');

    console.log('Keyboard basic trigger test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Keyboard basic trigger test failed:', err);
  process.exit(1);
});
