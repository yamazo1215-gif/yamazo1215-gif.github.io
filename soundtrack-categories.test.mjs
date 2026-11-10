import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works=JSON.parse(fs.readFileSync('yamazo_works_master.json'));
const sources=JSON.parse(fs.readFileSync('soundtracks.json'));
const releases=JSON.parse(fs.readFileSync('releases.json'));
test('soundtrack releases are separate from their preserved score projects',()=>{
 assert.equal(works.filter(w=>w.category==='soundtrack').length,2);
 for(const source of sources){
  const album=works.find(w=>w.id===source.id);
  assert.equal(album.category,'soundtrack');
  assert.equal(works.find(w=>w.id===album.related_work_id)?.category,'score');
  assert.equal(releases.find(r=>r.id===album.release_id)?.release_type,'soundtrack');
  assert.ok(album.roles.length);
 }
 assert.equal(works.filter(w=>w.category==='score').length,21);
 assert.ok(works.filter(w=>w.category==='score').every(w=>w.credit_note==='劇伴音楽'));
});
test('Room Mate artwork catalog follows the score project rather than song',()=>{
 assert.equal(releases.find(r=>r.id==='release-98238').release_type,'score');
});
