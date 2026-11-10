import test from 'node:test';
import assert from 'node:assert/strict';
import { soundtrackFormats, renderSoundtrackEditions } from './soundtrack-editions.mjs';
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const safe = value => { try { return new URL(value).protocol === 'https:' ? esc(value) : ''; } catch { return ''; } };
test('media badges deduplicate without combining edition dates or track lists', () => {
 const work = {category:'soundtrack',release_editions:[
  {format:'CD',title:'通常盤',release_date:'2024-09-25',catalog_number:'WAGE-13010',note:'32曲',url:'https://example.com/cd'},
  {format:'配信',title:'Complete Edition',release_date:'2024-09-25',note:'44曲',url:'https://example.com/digital'},
  {format:'CD',title:'再発盤',release_date:'2025-01-01'}
 ]};
 assert.deepEqual(soundtrackFormats(work),['CD','配信']);
 const html=renderSoundtrackEditions(work,esc,safe);
 assert.equal((html.match(/<li>/g)||[]).length,3);
 assert.match(html,/Complete Edition · 配信/);assert.match(html,/32曲/);assert.match(html,/44曲/);
 assert.match(html,/datetime="2025-01-01"/);
});
test('bonus CDs are explicit and unknown dates are not invented', () => {
 const html=renderSoundtrackEditions({category:'soundtrack',release_editions:[{format:'BD/DVD特典CD',note:'初回生産特典'}]},esc,safe);
 assert.match(html,/BD\/DVD特典CD/);assert.doesNotMatch(html,/<time/);
 assert.equal(renderSoundtrackEditions({category:'score',release_editions:[{format:'CD'}]},esc,safe),'');
});
test('edition fields are escaped and unsafe URLs are omitted', () => {
 const html=renderSoundtrackEditions({category:'soundtrack',release_editions:[{format:'<script>',note:'<img>',url:'javascript:alert(1)'}]},esc,safe);
 assert.match(html,/&lt;script>/);assert.doesNotMatch(html,/<script>|<img>|href=/);
});
