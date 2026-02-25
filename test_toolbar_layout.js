import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1600, height: 900 });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    const initialState = await page.evaluate(() => {
      const topTier = document.querySelector('.top-tier');
      const secondTier = document.querySelector('.second-tier');
      const activeChip = document.querySelector('.toolbar-section-chip.active');
      const panels = Array.from(document.querySelectorAll('.toolbar-section-panel'));
      const drawer = document.querySelector('.toolbar-drawer');

      return {
        hasTopTier: !!topTier,
        hasSecondTier: !!secondTier,
        activeSection: activeChip?.getAttribute('data-section') || '',
        drawerVisible: !!drawer && !drawer.classList.contains('hidden'),
        visiblePanels: panels
          .filter((p) => !p.classList.contains('hidden'))
          .map((p) => p.getAttribute('data-section'))
      };
    });

    assert.equal(initialState.hasTopTier, true, 'Expected top-tier to render');
    assert.equal(initialState.hasSecondTier, true, 'Expected second-tier to render');
    assert.equal(initialState.activeSection, 'recipe', 'Expected recipe section active by default');
    assert.equal(initialState.drawerVisible, true, 'Drawer should be visible by default');
    assert.deepEqual(initialState.visiblePanels, ['recipe'], 'Only recipe panel should be visible initially');

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

    await page.evaluate(() => {
      const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
      presetChip?.click();
    });

    const closedState = await page.evaluate(() => {
      const drawer = document.querySelector('.toolbar-drawer');
      return {
        drawerHidden: !!drawer && drawer.classList.contains('hidden')
      };
    });

    assert.equal(closedState.drawerHidden, true, 'Clicking active chip should close drawer');

    console.log('Toolbar layout test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Toolbar layout test failed:', err);
  process.exit(1);
});
