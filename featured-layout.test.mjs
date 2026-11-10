import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works=JSON.parse(fs.readFileSync('yamazo_works_master.json'));
const releases=JSON.parse(fs.readFileSync('releases.json'));
test('Haikara supplied key visual replaces score imagery, not soundtrack artwork',()=>{
 const score=works.find(w=>w.id==='anilist-188138');
 assert.equal(score.image,'assets/covers/haikara-user-keyvisual.jpg');
 assert.ok(fs.statSync(score.image).size>0);
 assert.equal(releases.find(r=>r.id===score.release_id).artwork.src,score.image);
 const ost=works.find(w=>w.id==='soundtrack-haikara-ost');
 assert.equal(ost.image,'');
 assert.equal(releases.find(r=>r.id===ost.release_id).artwork.src,'assets/covers/manual-soundtrack-haikara-ost.jpg');
 assert.equal(works.filter(w=>w.featured).length,4);
});
test('featured introduction uses bounded compact artwork and responsive widths',()=>{
 const css=fs.readFileSync('styles.css','utf8');
 assert.match(css,/\.featured-card \{ grid-template-columns: 120px minmax\(0, 1fr\)/);
 assert.match(css,/\.featured-visual \{ width: 120px; height: 160px/);
 assert.match(css,/\.featured-visual \{ width: 84px; height: 118px/);
 assert.match(css,/\.featured-section \{ padding: 2rem 0/);
});
