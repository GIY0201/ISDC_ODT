// Static source markup/style receipt; no browser, renderer or runtime execution claim.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const [reference,output]=process.argv.slice(2);
if(!reference||!output)throw Error('usage: node capture_original_node_work_panel.mjs <reference> <output.json>');
const commit='1a1e00297a0301637455b0ef2cf48b2e74576b07';
if(execFileSync('git',['-C',resolve(reference),'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==commit)throw Error('source commit mismatch');
const expected={
  'user_application/web/index.html':'e8be832dd29bcf2faa08952fdce298430dd7dc3d9391fe30aa074903486048b4',
  'user_application/web/styles/nodes.css':'f2e174c673449ee4dfdc8c1def9503ec985c0b8944014ef7b85c9e5d37464f82',
  'user_application/web/scripts/orbit/zoom_controls.js':'45ea08ebf27cd7d4c2b9d1d197e8f4c498eee235e7d6092317ee4b524b97bdbc',
};
const texts={};
for(const [path,hash]of Object.entries(expected)){
  const bytes=await readFile(resolve(reference,path));
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error(`source hash mismatch: ${path}`);
  texts[path]=bytes.toString('utf8');
}
const html=texts['user_application/web/index.html'],css=texts['user_application/web/styles/nodes.css'];
const formationStart=html.indexOf('<section class="ns-formation ns-panel"'),inspectorStart=html.indexOf('<aside class="ns-inspector ns-panel"',formationStart),tipStart=html.indexOf('<div id="node-tip"',inspectorStart);
if(Math.min(formationStart,inspectorStart,tipStart)<0)throw Error('source boundaries missing');
const sceneStart=css.indexOf('/* Scene */'),sceneEnd=css.indexOf('/* Formation tools:',sceneStart);
const presentation=css.slice(0,sceneStart)+css.slice(sceneEnd);
const receipt={source_commit:commit,source_hashes:expected,formationMarkup:html.slice(formationStart,inspectorStart).trim(),inspectorMarkup:html.slice(inspectorStart,tipStart).trim(),presentationRules:presentation.split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('#view-nodes ')&&!line.startsWith('#view-nodes {')),zoomWheelAmounts:[120,-120]};
const bytes=JSON.stringify(receipt,null,2)+'\n';await writeFile(resolve(output),bytes);
process.stdout.write(JSON.stringify({bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')})+'\n');
