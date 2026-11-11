import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read = p => JSON.parse(fs.readFileSync(p));
const works = read('yamazo_works_master.json');
const releases = read('releases.json');
const audit = read('artwork-review-2026-11-11.json');
test('16 verified jacket assets cover 18 intended cards with provenance and intact bytes', () => {
  assert.equal(audit.length,16);
  assert.equal(audit.flatMap(a=>a.work_ids).length,18);
  for(const a of audit) {
    const r=releases.find(r=>r.id===a.release_id);
    assert.deepEqual(r.artwork.src,a.src);
    assert.ok(a.source_url.startsWith('https://'));
    assert.ok(a.original_url.startsWith('https://'));
    assert.ok(a.width>0&&a.height>0);
    assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);
    for(const id of a.work_ids) assert.equal(works.find(w=>w.id===id).release_id,a.release_id);
  }
});
test('unverified package composites and later-series visuals are not assigned', () => {
  for(const id of ['soundtrack-yamanosusume-next-summit-ost','score-diamond-no-ace-first']) {
    const w=works.find(w=>w.id===id);
    assert.ok(!w.image);
    const a=releases.find(r=>r.id===w.release_id)?.artwork;
    assert.equal(a.review.image_type,'key-visual');
    assert.ok(!a.src.includes('reference'));
    assert.ok(!a.alt.includes('ジャケット'));
  }
  const love=works.find(w=>w.id==='soundtrack-boueibu-love-ost');
  assert.equal(releases.find(r=>r.id===love.release_id).artwork.src,'assets/covers/soundtrack-boueibu-love-ost-digital.jpg');
});

test('approved key visuals have intact verified bytes',()=>{
 for(const a of read('key-visual-review-2026-11-11.json')) {
  assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);
  assert.ok(a.source_url.startsWith('https://'));
 }
});
