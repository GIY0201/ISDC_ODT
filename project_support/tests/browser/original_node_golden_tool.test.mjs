import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOriginalNodeGolden} from '../../tooling/capture_original_nodes.mjs';

test('original capture rejects missing or modified source rather than manufacturing a golden', async()=>{
 const root=await mkdtemp(join(tmpdir(),'isdc-node-golden-'));
 try {
  await assert.rejects(createOriginalNodeGolden({sourceRoot:root}), /ENOENT/);
  const p=join(root,'digital_twin/simulation/browser');await mkdir(p,{recursive:true});
  await writeFile(join(p,'satellite_dynamics.js'), 'export const EARTH_A_KM=1;');
  await assert.rejects(createOriginalNodeGolden({sourceRoot:root}), /source_hash_mismatch/);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('source root is explicit and reference access is confined to the two approved modules', async()=>{
 await assert.rejects(createOriginalNodeGolden({}), /source_root_required/);
 await assert.rejects(createOriginalNodeGolden({sourceRoot:''}), /source_root_required/);
});
