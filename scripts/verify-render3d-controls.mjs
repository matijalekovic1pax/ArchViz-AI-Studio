#!/usr/bin/env node
/**
 * Guards against Render3D controls going dead.
 *
 * The 3D-to-Render panel accumulated eight controls that were read from the UI,
 * stored in state, and then never referenced when the prompt was built — the
 * generation mode, every shadow and ambient setting, sun intensity and the
 * vehicle count. Nothing failed; the sliders simply did nothing. This asserts
 * that every leaf of Render3DSettings is actually consumed by the render-3d
 * prompt builder, so the next one is caught at commit time instead of by a user
 * wondering why a slider has no effect.
 *
 * Run: npm run verify:render3d
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const types = read('types.ts');
const engine = read('engine/promptEngine.ts');

/** Pull the render-3d prompt builder out of the engine by its own landmarks. */
const builderStart = engine.indexOf('  const r3d = workflow.render3d;\n  const hasSourceImage');
const builderEnd = engine.indexOf('const formatToggle = (value: boolean)');
if (builderStart < 0 || builderEnd < 0) {
  console.error('verify:render3d — could not locate the render-3d prompt builder.');
  console.error('If it was renamed or moved, update the landmarks in this script.');
  process.exit(1);
}
const builder = engine.slice(builderStart, builderEnd);

/**
 * Each entry is a leaf setting and the token that proves the builder consumes
 * it. Accessor text is used rather than the bare field name so that a mention
 * in an unrelated mode's code cannot satisfy the check.
 */
const REQUIRED = [
  ['lighting.preset',            'light.preset'],
  ['lighting.sun.azimuth',       'light.sun.azimuth'],
  ['lighting.sun.elevation',     'light.sun.elevation'],
  ['lighting.sun.colorTemp',     'light.sun.colorTemp'],
  ['lighting.sun.intensity',     'light.sun.intensity'],
  ['lighting.shadows.enabled',   'light.shadows.enabled'],
  ['lighting.shadows.intensity', 'light.shadows.intensity'],
  ['lighting.shadows.color',     'light.shadows.color'],
  ['lighting.ambient.intensity', 'light.ambient.intensity'],
  ['lighting.ambient.occlusion', 'light.ambient.occlusion'],
  ['atmosphere.mood',            'atm.mood'],
  ['atmosphere.fog.density',     'atm.fog.density'],
  ['atmosphere.bloom.intensity', 'atm.bloom.intensity'],
  ['scenery.preset',             'scene.preset'],
  ['scenery.people.count',       'scene.people.count'],
  ['scenery.trees.count',        'scene.trees.count'],
  ['scenery.cars.count',         'scene.cars.count'],
  ['render.resolution',          'rend.resolution'],
  ['render.aspectRatio',         'rend.aspectRatio'],
  ['render.viewType',            'rend.viewType'],
  ['color.paletteEnabled',       'colour.paletteEnabled'],
  ['color.dominant',             'colour.dominant'],
  ['color.accent',               'colour.accent'],
  ['color.whiteBalance',         'colour.whiteBalance'],
  ['color.saturation',           'colour.saturation'],
  ['color.contrast',             'colour.contrast'],
  ['color.grade',                'colour.grade'],
  ['camera.focalLength',         'camera.focalLength'],
  ['camera.eyeHeight',           'camera.eyeHeight'],
  ['camera.aperture',            'camera.aperture'],
  ['camera.exposure',            'camera.exposure'],
  ['materials',                  'r3d.materials'],
  ['control.adherence',          'r3d.control.adherence'],
  ['control.negativePrompt',     'r3d.control.negativePrompt'],
];

const dead = REQUIRED.filter(([, token]) => !builder.includes(token));

/** Every generation mode must reach its own prompt text, not be clamped away. */
const modeIssues = [];
if (/renderMode === 'enhance'\s*\?\s*'enhance'\s*:\s*DEFAULT_RENDER_GENERATION_MODE/.test(engine)) {
  modeIssues.push('renderMode is clamped to enhance/strict-realism — concept-push cannot be reached.');
}
const panel = read('components/panels/right/Render3DPanel.tsx');
for (const mode of ['strict-realism', 'enhance', 'concept-push']) {
  const offered = mode === 'strict-realism'
    ? panel.includes('DEFAULT_RENDER_GENERATION_MODE')
    : panel.includes(`'${mode}'`);
  if (!offered) modeIssues.push(`Generation mode "${mode}" is not offered by the panel.`);
}

/** Any Render3DSettings leaf missing from REQUIRED is an unguarded control. */
const settingsBlock = types.slice(
  types.indexOf('export interface Render3DSettings'),
  types.indexOf('}', types.indexOf('export interface Render3DSettings')) + 1
);
const sections = [...settingsBlock.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
const unguarded = sections.filter((section) => !REQUIRED.some(([path]) => path.split('.')[0] === section));

let failed = false;
if (dead.length) {
  failed = true;
  console.error(`\n${dead.length} Render3D control(s) never reach the prompt:\n`);
  for (const [path, token] of dead) console.error(`  ${path.padEnd(28)} (looked for "${token}")`);
}
if (unguarded.length) {
  failed = true;
  console.error(`\nRender3DSettings section(s) with no coverage entry: ${unguarded.join(', ')}`);
  console.error('Add them to REQUIRED in scripts/verify-render3d-controls.mjs.');
}
if (modeIssues.length) {
  failed = true;
  console.error('');
  for (const issue of modeIssues) console.error(`  ${issue}`);
}

if (failed) {
  console.error('\nverify:render3d FAILED\n');
  process.exit(1);
}

console.log(`verify:render3d — ${REQUIRED.length} controls reach the prompt, all 3 generation modes reachable.`);
