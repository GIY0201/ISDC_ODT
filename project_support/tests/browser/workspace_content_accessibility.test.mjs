import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../../../user_application/web/styles/workspace.css',import.meta.url),'utf8');
const appearance=readFileSync(new URL('../../../user_application/web/styles/workspace_appearance.css',import.meta.url),'utf8');

test('grouped definition lists keep their own row layout instead of acquiring a second column grid',()=>{
 assert.doesNotMatch(appearance,/dl:not\(\.ns-values\):not\(\.sim-metric-grid\)\{/);
 assert.match(appearance,/dl:has\(>dt\):not\(\.ns-values\):not\(\.sim-metric-grid\)/);
});

test('scroll owner cannot be expanded beyond the work area by a feature minimum height',()=>{
 assert.match(css,/#screen>\[data-work-section-hidden=false\][^{]*\{[^}]*min-height:0!important/);
 assert.match(css,/#screen>\.view:not\(\.wall-live\) \.panel\{[^}]*flex:0 0 auto[^}]*overflow:visible/);
 assert.match(css,/#screen #satellite-nodes \.ns-detail\{[^}]*overflow:visible/);
});

test('resizable work windows reflow map and authoring grids using their container width',()=>{
 assert.match(appearance,/@container[^{}]*max-width:760px[^{}]*\{\s*\.work-window \.sa-layout\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(appearance,/@container[^{}]*max-width:620px[^{}]*\{\s*\.work-window \.gs-map-workspace\{grid-template-columns:minmax\(0,1fr\)/);
});

test('sticky table headings use the current theme and the resting clock cannot cover task controls',()=>{
 assert.match(css,/\.cp-table th\s*\{[^}]*background:var\(--workspace-frame/);
 assert.match(appearance,/body:has\(#work-window:not\(\[hidden\]\)\) \.workspace-time-dock:not\(:hover\):not\(:focus-within\)\{[^}]*z-index:29/);
});

test('keyboard details focus and reduced-motion diagram display are explicitly supported',()=>{
 assert.match(css,/summary:focus-visible[^{}]*\{[^}]*outline:/);
 assert.match(appearance,/@media\(prefers-reduced-motion:reduce\)\{\.nd \.nd-flow\{animation:none/);
});

test('header help text remains visible when narrow-screen header metadata is hidden',()=>{
 assert.match(appearance,/\.panel>header \.workspace-help-content small\{[^}]*display:block/);
});
