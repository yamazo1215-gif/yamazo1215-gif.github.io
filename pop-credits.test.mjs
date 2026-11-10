import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works = JSON.parse(fs.readFileSync(new URL('./yamazo_works_master.json', import.meta.url)));
const records = JSON.parse(fs.readFileSync(new URL('./pop-credits-sources.json', import.meta.url)));
test('verified pop works are unique and preserve supported credits',()=>{
 assert.equal(records.length,9);
 for(const r of records){
  const found = works.filter(w=>w.id===r.id);
  assert.equal(found.length,1,r.title);
  const w=found[0];
  assert.equal(w.track_title,r.title);assert.equal(w.artist,r.artist);
  assert.equal(w.release_date,r.release_date);assert.deepEqual(w.roles,r.roles);
  assert.ok(r.sources.length);assert.equal(w.temporary,false);
  assert.equal(works.filter(v=>v.track_title===r.title&&v.artist===r.artist).length,1);
 }
 const aaa=works.find(w=>w.id==='verified-pop-aaa-one-night-animal');
 assert.match(aaa.credit_note,/山田知広/);assert.deepEqual(aaa.roles,['作曲']);
 assert.equal(works.find(w=>w.id==='verified-pop-gokigen-koe').release_date,'2012-07-11');
});
