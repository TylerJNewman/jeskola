import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('./src/presets.ts', 'utf8');
const transformed = source.replace(
  /export const PRESETS:\s*Record<string,\s*string>\s*=/,
  'globalThis.PRESETS ='
);

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(transformed, context);

const presets = context.globalThis.PRESETS;
assert.ok(presets && typeof presets === 'object', 'PRESETS must be an object');

for (const [name, presetJson] of Object.entries(presets)) {
  const parsed = JSON.parse(presetJson);

  assert.ok(Array.isArray(parsed.modules), `${name}: modules must be an array`);
  assert.ok(Array.isArray(parsed.connections), `${name}: connections must be an array`);

  const ids = new Set();
  for (const mod of parsed.modules) {
    assert.equal(typeof mod.id, 'string', `${name}: module id must be string`);
    assert.ok(!ids.has(mod.id), `${name}: duplicate module id ${mod.id}`);
    ids.add(mod.id);
  }

  const reachesMaster = parsed.connections.some(
    (c) => c.targetModuleId === 'master' && (c.targetPortId || 'audio') === 'audio'
  );
  assert.ok(reachesMaster, `${name}: must include an audio route to master`);
}

console.log(`Preset integrity OK (${Object.keys(presets).length} presets checked)`);
