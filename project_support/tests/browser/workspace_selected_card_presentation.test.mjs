import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../../user_application/web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../../user_application/web/styles/workspace.css',import.meta.url),'utf8');
test('example alert is initially hidden and reserves no app row',()=>{
 assert.match(html,/<div[^>]*class="alertline"[^>]*hidden/);
 const rows=[...css.matchAll(/\.app\{[^}]*grid-template-rows:([^;}]+)/g)].map(match=>match[1].trim());
 assert.ok(rows.length>=2);
 for(const row of rows)assert.match(row,/^(?:50|44)px 32px minmax\(0,1fr\)$/);
 assert.match(css,/\.alertline\[hidden\]\{display:none!important\}/);
 assert.match(html,/id="alert-text"/);
 assert.match(html,/id="alert-open"/);
});
test('selected card owns collapsed diagnostic text and existing focus action without globe overlay',()=>{
 const surface=html.match(/<div id="workspace-globe-surface">([\s\S]*?)<\/div>\s*<\/div>/)?.[1];
 assert.ok(surface);
 assert.match(surface,/id="stored-orbit-globe"/);
 assert.match(surface,/id="orbit-solar-overlay"/);
 assert.doesNotMatch(surface,/orbit-globe-status|orbit-globe-caption/);
 const card=html.match(/<section class="glass overview"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(card);
 assert.match(card,/<details id="desktop-sat-details"><summary>상세정보<\/summary>[\s\S]*id="orbit-globe-status"[\s\S]*<\/details>/);
 assert.doesNotMatch(card,/<details[^>]*\bopen(?:\s|>)/);
 assert.match(card,/id="orbit-globe-focus"[^>]*disabled/);
 assert.equal([...html.matchAll(/id="orbit-globe-status"/g)].length,1);
 assert.equal([...html.matchAll(/id="orbit-globe-focus"/g)].length,1);
});
test('matched-model thumbnail starts empty and hidden with accessible description',()=>{
 const image=html.match(/<img[^>]*id="desktop-sat-thumbnail"[^>]*>/)?.[0];
 assert.ok(image);
 assert.match(image,/\bhidden/);
 assert.match(image,/alt="선택 위성의 연결된 3D 모델 미리보기"/);
 assert.doesNotMatch(image,/\bsrc=/);
 assert.match(css,/\.desktop \.overview\{[^}]*max-height:[^}]*overflow:auto/);
});
