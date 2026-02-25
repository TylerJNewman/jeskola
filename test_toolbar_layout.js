import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1600, height: 900 });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    const wideState = await page.evaluate(() => {
      const topTier = document.querySelector('.top-tier');
      const secondTier = document.querySelector('.second-tier');
      const activeChip = document.querySelector('.toolbar-section-chip.active');
      const panels = Array.from(document.querySelectorAll('.toolbar-section-panel'));

      return {
        hasTopTier: !!topTier,
        hasSecondTier: !!secondTier,
        activeSection: activeChip?.getAttribute('data-section') || '',
        compact: document.body.classList.contains('toolbar-compact'),
        hiddenCount: panels.filter((p) => p.classList.contains('hidden')).length
      };
    });

    assert.equal(wideState.hasTopTier, true, 'Expected top-tier to render');
    assert.equal(wideState.hasSecondTier, true, 'Expected second-tier to render');
    assert.equal(wideState.activeSection, 'recipe', 'Expected recipe section active by default');
    assert.equal(wideState.compact, false, 'Wide viewport should not be compact mode');
    assert.equal(wideState.hiddenCount, 0, 'Wide viewport should keep all section panels visible');

    await page.setViewport({ width: 1200, height: 900 });
    await new Promise((r) => setTimeout(r, 100));

    const compactState = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll('.toolbar-section-panel'));
      const visiblePanels = panels.filter((p) => !p.classList.contains('hidden'));
      return {
        compact: document.body.classList.contains('toolbar-compact'),
        visibleCount: visiblePanels.length,
        visibleSection: visiblePanels[0]?.getAttribute('data-section') || ''
      };
    });

    assert.equal(compactState.compact, true, 'Narrow viewport should enable compact mode');
    assert.equal(compactState.visibleCount, 1, 'Compact mode should show one section panel');
    assert.equal(compactState.visibleSection, 'recipe', 'Recipe should be visible by default in compact mode');

    await page.evaluate(() => {
      const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
      presetChip?.click();
    });

    const switchedState = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll('.toolbar-section-panel'));
      const visiblePanels = panels.filter((p) => !p.classList.contains('hidden'));
      const activeChip = document.querySelector('.toolbar-section-chip.active');
      return {
        visibleCount: visiblePanels.length,
        visibleSection: visiblePanels[0]?.getAttribute('data-section') || '',
        activeSection: activeChip?.getAttribute('data-section') || ''
      };
    });

    assert.equal(switchedState.visibleCount, 1, 'Compact mode should still show one panel after switching');
    assert.equal(switchedState.visibleSection, 'preset', 'Preset panel should be visible after selecting preset chip');
    assert.equal(switchedState.activeSection, 'preset', 'Preset chip should become active after click');

    console.log('Toolbar layout test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Toolbar layout test failed:', err);
  process.exit(1);
});
