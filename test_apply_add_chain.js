import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

async function loadPreset(page, key) {
  await page.evaluate(async ({ key }) => {
    const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
    presetChip?.click();
    const presetPanel = document.querySelector('.toolbar-section-panel[data-section="preset"]');
    const presetSelect = presetPanel?.querySelector('select');
    const loadPresetBtn = Array.from(presetPanel?.querySelectorAll('.control-btn') || [])
      .find((b) => b.textContent?.trim() === 'LOAD PRESET');
    if (!presetSelect || !loadPresetBtn) throw new Error('Preset controls not found');
    presetSelect.value = key;
    loadPresetBtn.click();
    await new Promise((r) => setTimeout(r, 250));
  }, { key });
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      document.getElementById('btn-master-play')?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    await loadPreset(page, 'sub-bass');

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
      if (!sourceType || !sourceItem || !mode || !targetType || !targetModule || !applyBtn) {
        throw new Error('Apply controls missing');
      }

      sourceType.value = 'preset';
      sourceType.dispatchEvent(new Event('change', { bubbles: true }));
      sourceItem.value = 'acid-drive';
      sourceItem.dispatchEvent(new Event('change', { bubbles: true }));

      mode.value = 'add_chain';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      targetType.value = 'after_module';
      targetType.dispatchEvent(new Event('change', { bubbles: true }));
      targetModule.value = 'sub-filter';
      targetModule.dispatchEvent(new Event('change', { bubbles: true }));

      applyBtn.click();
      await new Promise((r) => setTimeout(r, 250));
    });

    const result = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');
      const cableCount = document.querySelectorAll('#cables-layer path.cable').length;
      return { ids, cableCount };
    });

    const expected = ['master', 'sub-osc1', 'sub-osc2', 'sub-filter', 'drive-osc', 'drive-dist', 'drive-filter'];
    assert.equal(result.ids.length, expected.length, 'Unexpected module count for add_chain apply');
    for (const id of expected) assert.ok(result.ids.includes(id), `Missing expected module ${id}`);
    assert.equal(result.cableCount, 5, 'Unexpected cable count for add_chain apply');

    console.log('Apply add_chain test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Apply add_chain test failed:', err);
  process.exit(1);
});
