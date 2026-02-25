import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    const outcome = await page.evaluate(async () => {
      const startBtn = document.getElementById('btn-master-play');
      startBtn?.click();
      await new Promise((r) => setTimeout(r, 300));

      const patch = {
        modules: [
          { id: 'dup', type: 'oscillator', x: 100, y: 100, state: { mode: 'pitch', octave: 0, semitone: 0, cents: 0, freq: 440, type: 'sine' } },
          { id: 'dup', type: 'filter', x: 250, y: 100, state: { cutoff: 800, res: 1, type: 'lowpass' } },
          { id: 'ok-gain', type: 'gain', x: 400, y: 100, state: { level: 0.8 } },
          { id: 'master', type: 'gain', x: 0, y: 0, state: {} },
          { type: 'delay', x: 0, y: 0, state: {} }
        ],
        connections: [
          { sourceModuleId: 'dup', targetModuleId: 'ok-gain', sourcePortId: 'audio', targetPortId: 'audio' },
          { sourceModuleId: 'dup', targetModuleId: 'missing', sourcePortId: 'audio', targetPortId: 'audio' },
          { sourceModuleId: 'missing', targetModuleId: 'ok-gain', sourcePortId: 'audio', targetPortId: 'audio' },
          { targetModuleId: 'ok-gain' }
        ]
      };

      // @ts-ignore
      const result = window._workspace.importState(JSON.stringify(patch));

      const ids = Array.from(document.querySelectorAll('.module[data-id]'))
        .map((el) => el.getAttribute('data-id'))
        .filter((id) => typeof id === 'string');

      const dupCount = ids.filter((id) => id === 'dup').length;
      return { result, ids, dupCount };
    });

    assert.equal(outcome.result.modulesCreated, 2, 'Expected only first duplicate + valid unique module to be created');
    assert.equal(outcome.dupCount, 1, 'Expected duplicate module id to be created only once');
    assert.ok(outcome.result.warnings.some((w) => w.includes('duplicate module id "dup"')), 'Expected duplicate-id warning');
    assert.ok(outcome.result.warnings.length > 0, 'Expected warnings for malformed content');
    assert.ok(outcome.ids.includes('master'), 'Master should still be present');
    assert.ok(outcome.ids.includes('dup'), 'Primary duplicate id should be present');
    assert.ok(outcome.ids.includes('ok-gain'), 'Valid unique module should be present');

    console.log('Duplicate-id import test passed');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('Duplicate-id import test failed:', err);
  process.exit(1);
});
