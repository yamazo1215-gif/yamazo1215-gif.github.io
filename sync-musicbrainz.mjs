import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const ARTIST='4a5c8e5f-5de6-4960-ac09-734fc0c36723';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const labels={composer:'作曲',arranger:'編曲',lyricist:'作詞',mix:'ミックス',programming:'プログラミング',remixer:'リミックス','audio director':'音楽ディレクション'};
const instruments={guitar:'ギター','electric guitar':'エレキギター','acoustic guitar':'アコースティックギター','bass guitar':'ベース',bass:'ベース','drum set':'ドラム',drums:'ドラム',percussion:'パーカッション','other instruments':'楽器演奏'};
export function normalizeArtist(artist,recordings={}){
 if(artist.id!==ARTIST||artist.name.toLowerCase()!=='yamazo'||!Array.isArray(artist.relations))throw Error('MusicBrainz artist identity or relations mismatch');
 const rows=new Map();
 for(const r of artist.relations){
  const type=r['target-type'];
  if(!['work','recording'].includes(type)||!(r.type in labels||r.type==='instrument'))continue;
  const item=r[type];if(!uuid.test(item?.id)||!item.title)throw Error('Incomplete credit');
  const rec=type==='recording'?recordings[item.id]:null;
  if(type==='recording'&&(!rec||rec.id!==item.id||!Array.isArray(rec.relations)))throw Error('Missing recording details');
  const linked=rec?.relations.filter(x=>x['target-type']==='work'&&x.type==='performance'&&uuid.test(x.work?.id))||[];
  // Never combine unrelated songs just because titles are equal.
  const work=linked.length===1?linked[0].work:type==='work'?item:null;
  const id=work?`mb-work-${work.id}`:`mb-recording-${item.id}`;
  const row=rows.get(id)||{id,title:work?.title||item.title,year:null,category:'song',roles:[],artists:[],detail:'',sources:[],source:'musicbrainz',url:`https://musicbrainz.org/${work?'work':'recording'}/${work?.id||item.id}`,creditedAs:['yamazo']};
  const role=r.type==='instrument'?(r.attributes?.length?r.attributes.map(a=>instruments[a]||a).join('・'):'楽器演奏'):labels[r.type];
  row.roles=[...new Set([...row.roles,role])];
  const artists=(rec?.['artist-credit']||[]).map(a=>a.name||a.artist?.name).filter(Boolean);
  row.artists=[...new Set([...row.artists,...artists])];
  row.sources=[...new Set([...row.sources,`https://musicbrainz.org/${type}/${item.id}`,`https://musicbrainz.org/artist/${ARTIST}`])];
  // Use the recording's first-release-date, never the last reissue date.
  const date=rec?.['first-release-date'];
  if(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(date||'')){row.year=row.year===null?Number(date.slice(0,4)):Math.min(row.year,Number(date.slice(0,4)));if(!row.startDate||date<row.startDate)row.startDate=date;}
  row.role=row.roles.join('・');row.detail=row.artists.join(' / ');
  rows.set(id,row);
 }
 if(!rows.size)throw Error('Empty MusicBrainz import refused');
 return [...rows.values()].sort((a,b)=>(b.year||0)-(a.year||0)||a.title.localeCompare(b.title,'ja'));
}
export function mergeRecords(previous,incoming){
 const map=new Map(previous.map(w=>[w.id,w]));
 for(const row of incoming)map.set(row.id,{...map.get(row.id),...row});
 return [...map.values()];
}
export async function sync(root=ROOT,fetcher=fetch){
 let last=0;
 async function get(entity,id,inc){
  for(let attempt=0;attempt<3;attempt++){
   await new Promise(r=>setTimeout(r,Math.max(0,1100-(Date.now()-last))));last=Date.now();
   const res=await fetcher(`https://musicbrainz.org/ws/2/${entity}/${id}?inc=${inc}&fmt=json`,{headers:{'User-Agent':'yamazo-site/1.0 (https://www.yamazo.jp)'},signal:AbortSignal.timeout(30000)});
   if(res.ok)return res.json();
   if(![429,500,502,503,504].includes(res.status)||attempt===2)throw Error(`MusicBrainz HTTP ${res.status}`);
   await new Promise(r=>setTimeout(r,Math.min(60000,Math.max(3000,Number(res.headers.get('retry-after')||0)*1000))));
  }
 }
 const artist=await get('artist',ARTIST,'aliases+url-rels+work-rels+recording-rels');
 if(artist.id!==ARTIST||artist.name?.toLowerCase()!=='yamazo'||!Array.isArray(artist.relations))throw Error('Wrong artist');
 const recordings={};
 for(const id of new Set(artist.relations.filter(r=>r['target-type']==='recording'&&(r.type in labels||r.type==='instrument')).map(r=>r.recording?.id))){
  if(!uuid.test(id))throw Error('Invalid recording ID');
  recordings[id]=await get('recording',id,'work-rels+artist-credits');
 }
 const incoming=normalizeArtist(artist,recordings);
 const file=path.join(root,'musicbrainz.json');
 const previous=JSON.parse(await fs.readFile(file,'utf8'));
 const merged=mergeRecords(previous,incoming);
 const status={checkedAt:new Date().toISOString(),source:`https://musicbrainz.org/artist/${ARTIST}`,count:incoming.length,added:incoming.filter(w=>!previous.some(p=>p.id===w.id)).map(w=>w.id),updated:incoming.filter(w=>previous.some(p=>p.id===w.id&&JSON.stringify(p)!==JSON.stringify(w))).map(w=>w.id),missing:previous.filter(p=>!incoming.some(w=>w.id===p.id)).map(w=>w.id)};
 await fs.writeFile(file+'.tmp',JSON.stringify(merged,null,2)+'\n');await fs.rename(file+'.tmp',file);
 await fs.writeFile(path.join(root,'musicbrainz-status.json'),JSON.stringify(status,null,2)+'\n');
 return status;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))sync().then(s=>console.log(JSON.stringify(s))).catch(e=>{console.error(e.message);process.exitCode=1;});
