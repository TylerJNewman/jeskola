import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync('./src/presets.ts', 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const context = {
  module: { exports: {} },
  exports: {}
};
context.exports = context.module.exports;
vm.createContext(context);
vm.runInContext(transpiled, context);

const presets = context.module.exports.PRESETS;
const presetLabels = context.module.exports.PRESET_LABELS;
const presetOrder = context.module.exports.PRESET_ORDER;
const recipes = context.module.exports.RECIPES;
const recipeLabels = context.module.exports.RECIPE_LABELS;
const recipeOrder = context.module.exports.RECIPE_ORDER;
const recipeDescriptions = context.module.exports.RECIPE_DESCRIPTIONS;

assert.ok(presets && typeof presets === 'object', 'PRESETS must be an object');
assert.ok(presetLabels && typeof presetLabels === 'object', 'PRESET_LABELS must be an object');
assert.ok(Array.isArray(presetOrder), 'PRESET_ORDER must be an array');
assert.ok(recipes && typeof recipes === 'object', 'RECIPES must be an object');
assert.ok(recipeLabels && typeof recipeLabels === 'object', 'RECIPE_LABELS must be an object');
assert.ok(recipeDescriptions && typeof recipeDescriptions === 'object', 'RECIPE_DESCRIPTIONS must be an object');
assert.ok(Array.isArray(recipeOrder), 'RECIPE_ORDER must be an array');

const keys = Object.keys(presets);
assert.ok(keys.length >= 20, `Expected at least 20 presets, got ${keys.length}`);
assert.equal(new Set(presetOrder).size, presetOrder.length, 'PRESET_ORDER must not contain duplicates');
assert.equal(presetOrder.length, keys.length, 'PRESET_ORDER length must match presets count');

for (const key of keys) {
  assert.ok(typeof presetLabels[key] === 'string' && presetLabels[key].length > 0, `Missing label for preset key: ${key}`);
}

const composedLabelCount = Object.values(presetLabels).filter((label) => label.includes('+')).length;
assert.ok(composedLabelCount >= 8, `Expected at least 8 composed presets, got ${composedLabelCount}`);
assert.ok(recipeOrder.length >= 5, `Expected at least 5 recipes, got ${recipeOrder.length}`);
assert.equal(new Set(recipeOrder).size, recipeOrder.length, 'RECIPE_ORDER must not contain duplicates');
assert.equal(recipeOrder.length, Object.keys(recipes).length, 'RECIPE_ORDER length must match recipe count');

for (const key of recipeOrder) {
  assert.ok(typeof recipeLabels[key] === 'string' && recipeLabels[key].length > 0, `Missing label for recipe key: ${key}`);
  assert.ok(typeof recipeDescriptions[key] === 'string' && recipeDescriptions[key].length > 0, `Missing description for recipe key: ${key}`);
}

function validatePatchCollection(collection, collectionLabel) {
  for (const [name, presetJson] of Object.entries(collection)) {
    const parsed = JSON.parse(presetJson);

    assert.ok(Array.isArray(parsed.modules), `${collectionLabel}/${name}: modules must be an array`);
    assert.ok(Array.isArray(parsed.connections), `${collectionLabel}/${name}: connections must be an array`);

    const ids = new Set();
    for (const mod of parsed.modules) {
      assert.equal(typeof mod.id, 'string', `${collectionLabel}/${name}: module id must be string`);
      assert.ok(!ids.has(mod.id), `${collectionLabel}/${name}: duplicate module id ${mod.id}`);
      ids.add(mod.id);
    }

    for (const conn of parsed.connections) {
      assert.equal(typeof conn.sourceModuleId, 'string', `${collectionLabel}/${name}: sourceModuleId must be string`);
      assert.equal(typeof conn.targetModuleId, 'string', `${collectionLabel}/${name}: targetModuleId must be string`);
      assert.ok(ids.has(conn.sourceModuleId), `${collectionLabel}/${name}: unknown source module ${conn.sourceModuleId}`);
      assert.ok(conn.targetModuleId === 'master' || ids.has(conn.targetModuleId), `${collectionLabel}/${name}: unknown target module ${conn.targetModuleId}`);
    }

    const reachesMaster = parsed.connections.some(
      (c) => c.targetModuleId === 'master' && (c.targetPortId || 'audio') === 'audio'
    );
    assert.ok(reachesMaster, `${collectionLabel}/${name}: must include an audio route to master`);
  }
}

validatePatchCollection(presets, 'preset');
validatePatchCollection(recipes, 'recipe');

console.log(
  `Preset integrity OK (${keys.length} presets checked, ${composedLabelCount} composed, ${recipeOrder.length} recipes checked)`
);
