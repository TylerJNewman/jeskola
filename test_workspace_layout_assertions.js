import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import puppeteer from 'puppeteer';

function loadWorkspaceLayout() {
  const source = fs.readFileSync('./src/lib/workspace-layout.ts', 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const context = { module: { exports: {} }, exports: {} };
  context.exports = context.module.exports;
  vm.createContext(context);
  vm.runInContext(transpiled, context);
  return context.module.exports.WORKSPACE_LAYOUT;
}

async function openPresetAndLoad(page, labelContains) {
  const ensurePresetDrawer = async () => {
    const hasSelect = await page.evaluate(() => !!document.querySelector('aside select'));
    if (hasSelect) return;
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((el) => (el.textContent || '').trim().toLowerCase() === 'preset');
      btn?.click();
    });
    await page.waitForSelector('aside select');
  };

  await ensurePresetDrawer();

  const selected = await page.evaluate((needle) => {
    const select = document.querySelector('aside select');
    if (!select) return '';
    const options = Array.from(select.options);
    const match = options.find((o) => (o.textContent || '').toLowerCase().includes(needle.toLowerCase()));
    const fallback = options.find((o) => o.value);
    const picked = match || fallback;
    if (!picked) return '';
    select.value = picked.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return picked.textContent || '';
  }, labelContains);

  if (!selected) throw new Error('Unable to select a preset option');

  await page.evaluate(() => {
    const loadBtn = Array.from(document.querySelectorAll('button'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'load preset');
    loadBtn?.click();
  });

  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

(async () => {
  const layout = loadWorkspaceLayout();
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 2048, height: 1400 });
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    await openPresetAndLoad(page, 'classic mono lead');

    const measured = await page.evaluate(() => {
      const firstNode = document.querySelector('.react-flow__node');
      const moduleRoot = firstNode?.firstElementChild;
      const header = moduleRoot?.firstElementChild;
      const body = moduleRoot?.querySelector('.module-body-content');
      const handle = firstNode?.querySelector('.react-flow__handle');
      const palette = Array.from(document.querySelectorAll('aside'))
        .find((el) => (el.textContent || '').toLowerCase().includes('modules'));
      const cable = Array.from(document.querySelectorAll('.react-flow__edge path[stroke]'))
        .find((p) => p.getAttribute('stroke') && p.getAttribute('stroke') !== 'transparent');

      if (!firstNode || !header || !body || !handle || !palette || !cable) return null;

      const hs = window.getComputedStyle(header);
      const bs = window.getComputedStyle(body);
      const ps = window.getComputedStyle(palette);
      const handleRect = handle.getBoundingClientRect();

      return {
        moduleMinWidth: Math.round(firstNode.getBoundingClientRect().width),
        headerPaddingTop: Math.round(parseFloat(hs.paddingTop)),
        headerPaddingLeft: Math.round(parseFloat(hs.paddingLeft)),
        bodyPaddingTop: Math.round(parseFloat(bs.paddingTop)),
        bodyPaddingLeft: Math.round(parseFloat(bs.paddingLeft)),
        bodyGap: Math.round(parseFloat(bs.rowGap || bs.gap)),
        handleSize: Math.round(handleRect.width),
        paletteTop: Math.round(parseFloat(ps.top)),
        paletteRight: Math.round(parseFloat(ps.right)),
        paletteWidth: Math.round(parseFloat(ps.width)),
        palettePadding: Math.round(parseFloat(ps.paddingTop)),
        cableStrokeWidth: Math.round(parseFloat(cable.getAttribute('stroke-width') || '0')),
      };
    });

    assert.ok(measured, 'Expected node, handle, cable, and palette elements to exist');

    assert.equal(measured.moduleMinWidth, layout.module.minWidth, 'Module min width should match layout token');
    assert.equal(measured.headerPaddingTop, layout.module.headerPaddingY, 'Header vertical padding should match token');
    assert.equal(measured.headerPaddingLeft, layout.module.headerPaddingX, 'Header horizontal padding should match token');
    assert.equal(measured.bodyPaddingTop, layout.module.bodyPaddingY, 'Body vertical padding should match token');
    assert.equal(measured.bodyPaddingLeft, layout.module.bodyPaddingX, 'Body horizontal padding should match token');
    assert.equal(measured.bodyGap, layout.module.bodyGap, 'Body gap should match token');
    assert.equal(measured.handleSize, layout.module.handleSize, 'Handle size should match token');
    assert.equal(measured.paletteTop, layout.palette.topOffset, 'Palette top offset should match token');
    assert.equal(measured.paletteRight, layout.palette.rightOffset, 'Palette right offset should match token');
    assert.equal(measured.paletteWidth, layout.palette.width, 'Palette width should match token');
    assert.equal(measured.palettePadding, layout.palette.padding, 'Palette padding should match token');
    assert.equal(measured.cableStrokeWidth, layout.cables.visibleStroke, 'Cable width should match token');

    console.log('Workspace layout assertion test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Workspace layout assertion test failed:', err);
  process.exit(1);
});
