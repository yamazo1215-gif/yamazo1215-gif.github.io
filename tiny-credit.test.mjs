import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Tiny is one recording with co-composition and arrangement, dated to release not MV',()=>{
 const works=JSON.parse(fs.readFileSync('yamazo_works_master.json'));
 const matches=works.filter(w=>w.track_title==='Tiny'&&w.artist==='こっちのけんと');
 assert.equal(matches.length,1);const w=matches[0];
 assert.equal(w.release_date,'2022-08-30');assert.deepEqual(w.roles,['作曲・編曲']);
 assert.equal(w.credit_note,'作曲：こっちのけんと・yamazo / 編曲：yamazo');
 assert.equal(w.official_url,'https://linkco.re/dm2Qhdch');assert.equal(w.youtube,'https://youtu.be/SnSyIUvUafQ');
});
test('Tiny uses visually verified official jacket rather than a video thumbnail',()=>{
 const releases=JSON.parse(fs.readFileSync('releases.json'));
 const r=releases.find(r=>r.id==='manual-kocchi-no-kento-tiny');
 assert.equal(r.artwork.src,'assets/covers/kocchi-no-kento-tiny.jpg');
 assert.equal(r.artwork.width,1350);assert.equal(r.artwork.height,1350);
 assert.equal(r.artwork.source_url,'https://prtimes.jp/main/html/rd/p/000000019.000043620.html');
 assert.ok(fs.statSync(r.artwork.src).size>0);
});
