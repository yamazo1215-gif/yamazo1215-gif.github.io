import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalize,titleKey,evaluate,candidate,finalize,fingerprint,mbEntity } from './artwork/matching.mjs';
import { ogp, musicbrainz, localAnime } from './artwork/providers.mjs';
import { publicIP,publicURL } from './artwork/http.mjs';
import { planApproval,approve } from './approve-artwork.mjs';
import { imageExtension } from './fetch-artwork.mjs';
import {resolve} from './find-artwork.mjs';
const work={id:'mb-work-test',category:'song',track_title:'Test Song',artist:'Artist',year:2020};
const meta={title:'Test Song',artist:'Artist',year:2020,category:'song',provider:'cover-art-archive',image:'https://example.org/cover.jpg',source_url:'https://example.org/release',release_id:'release-test',membership:'recording → release',identity:'stored recording'};
const c=()=>candidate(work,meta);
const dataset=(w=work,s=c())=>({schema_version:2,items:[{work_id:w.id,work_fingerprint:fingerprint(w),category:w.category,suggestions:[s]}]});
const decisions=[{work_id:work.id,decision:'accept',suggestion_id:c().id}];
test('normalization preserves sequel numbers and versions',()=>{
 assert.equal(normalize('ＡＢＣ！ １２'),normalize('abc12'));assert.equal(titleKey('TVアニメ「少年メイド」'),titleKey('少年メイド'));
 for(const [a,b] of [['One Room','One Room セカンドシーズン'],['LOVE!','LOVE! LOVE!'],['Song','Song (Live)'],['Work','Work O.S.T.']]) assert.notEqual(titleKey(a),titleKey(b));
});
test('title+artist+year+recording membership eligible; contradictions cap scores',()=>{
 assert.equal(c().status,'auto_eligible');
 for(const change of [{title:'Different'},{year:2021},{artist:'Other'},{provider:'itunes'}]) assert.notEqual(candidate(work,{...meta,...change}).status,'auto_eligible');
 assert.equal(candidate(work,{...meta,year:2021}).status,'hold');
 assert.equal(candidate({...work,id:'legacy-001'},meta).status,'hold');
 assert.notEqual(candidate({...work,artist:'Artist / Voice'},meta).status,'auto_eligible');
});
test('competing releases require human review',()=>{
 const result=finalize([c(),candidate(work,{...meta,release_id:'other',image:'https://example.org/other.jpg'})]);
 assert.ok(result.every(s=>s.status==='review'&&s.blockers.includes('competing_releases')));
});
test('release and release-group stay distinct; lookalike hosts rejected',()=>{
 const id='12345678-1234-1234-1234-123456789abc';assert.equal(mbEntity(`https://musicbrainz.org/release/${id}`).type,'release');
 assert.equal(mbEntity(`https://evil.org/musicbrainz.org/release/${id}`),null);
});
test('OGP supports attribute order, relative URLs, entities and generic logos',()=>{
 assert.deepEqual(ogp(`<meta content='/img.jpg' property='og:image'><meta content='A &amp; B' property='og:title'>`,'https://example.org/work'),{title:'A & B',image:'https://example.org/img.jpg',generic:false});
 assert.equal(ogp('<meta property="og:image" content="/common/logo.png">','https://example.org').generic,true);
 assert.equal(ogp('<meta property="og:image" content="javascript:alert(1)">','https://example.org').image,'');
 assert.notEqual(candidate(work,{...meta,provider:'page-ogp'}).status,'auto_eligible');
});
test('existing local AniList can match renamed master IDs but cannot auto approve by title',()=>{
 const w={id:'custom',category:'score',work_title:'ABC!',year:2020};const [s]=localAnime(w,[{id:'anilist-1',anilistId:1,title:'ＡＢＣ',year:2020,image:'https://example.org/a.jpg',url:'https://anilist.co/anime/1'}]);assert.ok(s);assert.notEqual(s.status,'auto_eligible');
});
test('MusicBrainz recording membership uses front artwork from the correct release endpoint',async()=>{
 const rec='12345678-1234-1234-1234-123456789abc',rel='22345678-1234-1234-1234-123456789abc',calls=[];
 const client={get:async url=>{calls.push(url);if(url.includes('/recording/'))return {id:rec,title:'Test Song','artist-credit':[{name:'Artist'}],releases:[{id:rel,title:'Album',date:'2020-01-01',status:'Official'}]};if(url===`https://coverartarchive.org/release/${rel}`)return {images:[{front:false,image:'https://example.org/back.jpg'},{front:true,image:'https://example.org/front.jpg'}]};throw Error('Unexpected URL '+url)}};
 const result=await musicbrainz(work,[{id:work.id,sources:[`https://musicbrainz.org/recording/${rec}`]}],client);
 assert.equal(result.errors.length,0);assert.equal(result.suggestions[0].artwork.src,'https://example.org/front.jpg');assert.equal(result.suggestions[0].release_title,'Album');assert.ok(calls.every(u=>!u.includes('release-group')));
});
test('approval validates the entire batch and protects master, confirmed art, stale candidates and release collisions',()=>{
 const p=planApproval([work],[],dataset(),decisions);assert.equal(p.works[0].release_id,'release-test');assert.equal(work.release_id,undefined);
 assert.throws(()=>planApproval([{...work,year:2021}],[],dataset(),decisions),/Stale/);
 assert.throws(()=>planApproval([work],[],dataset(),[...decisions,...decisions]),/duplicate/);
 const w={...work,image:'https://example.org/current.jpg'};assert.throws(()=>planApproval([w],[],dataset(w),decisions),/confirmed/);
 assert.throws(()=>planApproval([work],[{id:'release-test',artwork:{src:'https://example.org/other.jpg'}}],dataset(),decisions),/Conflicting/);
 assert.throws(()=>planApproval([work],[],dataset(work,{...c(),status:'review'}),[{...decisions[0],mode:'auto'}]),/not auto/);
 assert.throws(()=>planApproval([work],[],dataset(),[{...decisions[0],suggestion_id:'missing'}]),/Unknown suggestion/);
});
test('private network URLs and malformed image payloads rejected',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.2','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1']) assert.equal(publicIP(ip),false);
 assert.equal(publicIP('8.8.8.8'),true);await assert.rejects(publicURL('https://127.0.0.1/'),/Non-public/);
 assert.throws(()=>imageExtension(Buffer.from('<html>'),'image/jpeg'),/invalid/);
});
test('dry-run preserves source files; apply records audit and skips confirmed works on next collection',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'yamazo-artwork-test-'));
 try {
  const files={'yamazo_works_master.json':[work],'releases.json':[],'anilist.json':[],'musicbrainz.json':[],'artwork_candidates.json':dataset(),'decisions.json':decisions};
  for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(root,name),JSON.stringify(value));
  const before=await fs.readFile(path.join(root,'yamazo_works_master.json'),'utf8');await approve(root,'decisions.json');assert.equal(await fs.readFile(path.join(root,'yamazo_works_master.json'),'utf8'),before);
  await approve(root,'decisions.json',{apply:true});const catalog=JSON.parse(await fs.readFile(path.join(root,'releases.json')));assert.equal(catalog[0].artwork.approval.mode,'human');
  const result=await resolve(root,{offline:true});assert.equal(result.summary.processed,0);assert.equal(result.items.length,0);
 } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('CV artist notation agrees without erasing different performer identities',async()=>{
 const {artistKey,relevant}=await import('./artwork/matching.mjs');
 assert.equal(artistKey('有馬かな / 潘めぐみ'),artistKey('有馬かな(CV:潘めぐみ)'));
 assert.notEqual(artistKey('有馬かな / 潘めぐみ'),artistKey('有馬かな(CV:別人)'));
 assert.equal(relevant(work,candidate(work,{...meta,title:'Unrelated',release_title:'Different Album'})),true);
 assert.equal(relevant(work,candidate(work,{...meta,provider:'itunes',title:'Unrelated',release_title:'Different Album'})),false);
});

test('official product adapter excludes benefits and preserves product evidence',async()=>{
 const {discography}=await import('./artwork/providers.mjs');
 const html='<div class="music_title_wrap"><div class="music_i01">リモート☆ホスト</div><span class="music_i04">Club A</span></div><h1>商品情報</h1><div class="pic_box img_100"><img src="/jacket.jpg"></div><h5>発売日</h5><div>2021年11月17日</div><strong>2．Song</strong><div>歌：Artist</div><img src="/benefits.jpg">';
 const result=discography(html,'https://remohos.com/music/test.html',{...work,year:2021,track_title:'Song'});
 assert.equal(result.artwork.src,'https://remohos.com/jacket.jpg');assert.equal(result.year,2021);assert.ok(result.evidence.some(e=>e.code==='title_exact'));assert.notEqual(result.status,'auto_eligible');
 assert.equal(discography(html,'https://other.org/music/test.html',work),null);
});

test('auto approval requires recent successful image validation',()=>{
 assert.throws(()=>planApproval([work],[],dataset(),[{...decisions[0],mode:'auto'}]),/not auto/);
 const s={...c(),image_validation:{ok:true,checked_at:new Date().toISOString()}};
 assert.equal(planApproval([work],[],dataset(work,s),[{...decisions[0],mode:'auto'}]).applied.length,1);
});

test('failed providers retain previous candidates below auto eligibility across parallel works',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'yamazo-failure-test-'));
 try {
  const works=[work,{...work,id:'second',track_title:'Other'},{...work,id:'confirmed',image:'https://example.org/current.jpg'}];
  const files={'yamazo_works_master.json':works,'releases.json':[],'anilist.json':[],'musicbrainz.json':[],'artwork_candidates.json':dataset()};
  for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(root,name),JSON.stringify(value));
  const result=await resolve(root,{client:{get:async()=>{throw Error('Fixture provider unavailable')}}});
  assert.equal(result.summary.processed,2);assert.equal(result.summary.already_illustrated,1);
  const retained=result.items.find(i=>i.work_id===work.id);assert.equal(retained.suggestions[0].status,'review');assert.ok(retained.errors.length);assert.ok(retained.suggestions[0].blockers.includes('retained_previous_candidate'));
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'yamazo_works_master.json'))).length,3);
  await assert.rejects(fs.access(path.join(root,'artwork_candidates.progress.json')));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
