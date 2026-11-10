import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works=JSON.parse(fs.readFileSync('yamazo_works_master.json'));
test('Diamond first season is credited to Flying-Pan without per-track attribution',()=>{
 const score=works.find(w=>w.id==='score-diamond-no-ace-first');
 const ost=works.find(w=>w.id==='soundtrack-diamond-no-ace-first');
 assert.equal(score.work_title,'ダイヤのA（第1期）');assert.equal(score.artist,'Flying-Pan');
 assert.equal(score.release_date,'2013-10-06');assert.equal(ost.artist,'Flying-Pan');
 assert.equal(ost.related_work_id,score.id);assert.equal(ost.release_date,'2015-03-18');
 assert.deepEqual(ost.release_editions.map(e=>e.format),['CD','配信']);
 assert.equal(ost.release_editions[0].catalog_number,'PCCG-01453');
 assert.doesNotMatch(JSON.stringify([score,ost]),/yamazo|actII|OST2|第2期/);
});
test('The Legendary Hero Is Dead lists all four official music credits in order',()=>{
 const work=works.find(w=>w.id==='seed-anime-4');
 assert.equal(work.artist,'うたたね歌菜 / 奈良悠樹 / yamazo / MOKA☆');
 assert.deepEqual(work.roles,['劇伴（共同）']);assert.match(work.credit_note,/共同担当/);
 assert.equal(work.official_url,'https://heroisdead.com/staff/');
});
