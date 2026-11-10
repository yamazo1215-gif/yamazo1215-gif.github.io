import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const works = JSON.parse(fs.readFileSync(new URL('./yamazo_works_master.json', import.meta.url)));
const releases = JSON.parse(fs.readFileSync(new URL('./releases.json', import.meta.url)));
const sources = JSON.parse(fs.readFileSync(new URL('./manual-artwork-sources.json', import.meta.url)));
const releaseMap = new Map(releases.map(r => [r.id, r]));
test('manually reviewed covers have matching works, source evidence, and local image bytes', () => {
  // Other verified works may be added without changing this reviewed artwork batch.
  assert.ok(works.length >= 102);
  assert.equal(new Set(works.map(w=>w.id)).size, works.length);
  assert.equal(new Set(releases.map(r=>r.id)).size, releases.length);
  for (const source of sources) {
    const work = works.find(w => w.id === source.work_id);
    assert.ok(work, source.work_id);
    const artwork = releaseMap.get(work.release_id)?.artwork;
    assert.equal(artwork?.src, source.local_path);
    assert.match(source.source_url, /^https:\/\//);
    assert.match(source.original_url, /^https:\/\//);
    assert.ok(source.edition && source.checked_at);
    const data = fs.readFileSync(new URL(source.local_path, import.meta.url));
    assert.ok(data.length > 1000);
    assert.ok(data.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])) || data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || data.subarray(8,12).toString()==='WEBP');
    assert.doesNotMatch(source.original_url, /X-Amz-Signature|[?&]token=/i);
  }
});
test('the SAO placeholder is not presented as cover art', () => {
  const work = works.find(w=>w.id==='legacy-022');
  const src = work.image || releaseMap.get(work.release_id)?.artwork?.src || '';
  assert.doesNotMatch(src, /noimg/);
  assert.match(work.track_title, /Underworld/);
});
