import test from 'node:test';import assert from 'node:assert/strict';
import {ARTIST,normalizeArtist,mergeRecords} from './sync-musicbrainz.mjs';
const work={id:'11111111-1111-1111-1111-111111111111',title:'同じ曲'};
const rid='22222222-2222-2222-2222-222222222222';
const a=relations=>({id:ARTIST,name:'yamazo',relations});
const composer={'target-type':'work',type:'composer',work};
const arrangement={'target-type':'recording',type:'arranger',recording:{id:rid,title:'同じ曲 (Instrumental)'}};
const details={[rid]:{id:rid,'first-release-date':'2019-04-12','artist-credit':[{name:'歌手'}],relations:[{'target-type':'work',type:'performance',work}]}};
test('canonical work links combine recording and composition roles without title guessing',()=>{
 const rows=normalizeArtist(a([composer,arrangement]),details);assert.equal(rows.length,1);assert.equal(rows[0].role,'作曲・編曲');assert.equal(rows[0].detail,'歌手');assert.equal(rows[0].year,2019);
 const unlinked=structuredClone(details);unlinked[rid].relations=[];assert.equal(normalizeArtist(a([composer,arrangement]),unlinked).length,2);
});
test('reject wrong artist, empty response and missing recording before writing',()=>{
 assert.throws(()=>normalizeArtist({id:ARTIST,name:'someone else',relations:[]}));assert.throws(()=>normalizeArtist(a([])));assert.throws(()=>normalizeArtist(a([arrangement]),{}));
});
test('merge is idempotent and retains temporarily missing credits',()=>{
 const rows=normalizeArtist(a([composer]));assert.deepEqual(mergeRecords(rows,rows),rows);assert.deepEqual(mergeRecords(rows,[]),rows);
});
test('failed source leaves published data byte-for-byte unchanged',async()=>{
 const fs=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');const {sync}=await import('./sync-musicbrainz.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yamazo-mb-test-'));const original='[{"id":"keep","title":"Existing"}]\n';
 try{await fs.writeFile(path.join(dir,'musicbrainz.json'),original);await assert.rejects(sync(dir,async()=>new Response('',{status:403})));assert.equal(await fs.readFile(path.join(dir,'musicbrainz.json'),'utf8'),original);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
