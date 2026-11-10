import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works=JSON.parse(fs.readFileSync('yamazo_works_master.json'));
const sources=JSON.parse(fs.readFileSync('soundtracks.json'));
const releases=JSON.parse(fs.readFileSync('releases.json'));
test('soundtrack releases are separate from their preserved score projects',()=>{
 assert.equal(works.filter(w=>w.category==='soundtrack').length,sources.length);
 assert.ok(sources.length >= 7);
 for(const source of sources){
  const album=works.find(w=>w.id===source.id);
  assert.equal(album.category,'soundtrack');
  assert.equal(works.find(w=>w.id===album.related_work_id)?.category,'score');
  assert.equal(releases.find(r=>r.id===album.release_id)?.release_type,'soundtrack');
  assert.ok(album.roles.length);
  assert.ok(album.release_editions.length);
  assert.ok(album.release_date);
  assert.equal(album.release_date, source.release_date);
  assert.deepEqual(album.release_editions, source.release_editions);
  assert.equal(new Set(album.release_editions.map(e => [e.format,e.title,e.release_date,e.catalog_number].join('|'))).size, album.release_editions.length);
  for (const edition of album.release_editions) { assert.ok(edition.format); assert.ok(edition.url?.startsWith('https://')); }
 }
 assert.equal(works.filter(w=>w.category==='score').length,22);
 assert.ok(works.filter(w=>w.category==='score').every(w=>w.credit_note.startsWith('劇伴音楽')));
});
test('Room Mate artwork catalog follows the score project rather than song',()=>{
 assert.equal(releases.find(r=>r.id==='release-98238').release_type,'score');
});
test('verified missing albums preserve formats, bonus status and edition differences',()=>{
 const byId=new Map(works.map(w=>[w.id,w]));
 const editions=id=>byId.get(id).release_editions;
 assert.equal(works.filter(w=>w.category==='soundtrack').length,12);
 assert.deepEqual(editions('soundtrack-nine-rulers-crown').map(e=>e.format),['配信']);
 assert.deepEqual(editions('soundtrack-shonen-maid-ost').map(e=>e.format),['CD']);
 assert.deepEqual(editions('soundtrack-yamanosusume-next-summit-ost').map(e=>e.format),['BD/DVD特典CD']);
 assert.equal(byId.get('soundtrack-yamanosusume-next-summit-ost').release_date,'2023-02-03');
 const yamano=byId.get('soundtrack-yamanosusume-ost');
 assert.equal(yamano.release_date,'2018-07-18');assert.equal(yamano.related_releases.length,3);
 assert.equal(editions('soundtrack-yamanosusume-third-ost').find(e=>e.format==='配信').release_date,null);
 const hananoi=editions('soundtrack-hananoi-ost');
 assert.match(hananoi.find(e=>e.format==='CD').note,/32曲/);
 assert.match(hananoi.find(e=>e.format==='配信').note,/44曲/);
 assert.match(editions('soundtrack-boueibu-love-ost').find(e=>e.format==='CD同梱特典').note,/45曲/);
 assert.equal(byId.get('soundtrack-robihachi-ost').artist,'山田知広');
 assert.equal(new Set(works.map(w=>w.id)).size,works.length);
});
