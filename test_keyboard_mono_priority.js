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
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });
    await new Promise((r) => setTimeout(r, 40));

    const withDPressed = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(withDPressed.gate > 0.9, 'Gate should stay on with stacked keys');
    assert.ok(Math.abs(withDPressed.noteCv - (4 / 12)) < 0.03, 'Top held key should be D (E4)');

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    });
    await new Promise((r) => setTimeout(r, 50));

    const afterDRelease = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(afterDRelease.gate > 0.9, 'Gate should remain on while A is still held');
    assert.ok(Math.abs(afterDRelease.noteCv - 0) < 0.03, 'After releasing D, note should fall back to A');

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    });
    await new Promise((r) => setTimeout(r, 60));

    const allReleased = await page.evaluate(() => {
      const kb = window._workspace.getModulesByType('keyboard')[0];
      if (!kb) throw new Error('Keyboard module missing');
      return kb.getDebugValues();
    });

    assert.ok(allReleased.gate < 0.05, 'Gate should be off when all notes are released');

    console.log('Keyboard mono priority test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Keyboard mono priority test failed:', err);
  process.exit(1);
});
