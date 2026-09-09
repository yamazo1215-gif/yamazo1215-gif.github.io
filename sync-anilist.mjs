import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const STAFF_ID=149067;
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const QUERY=`query YamazoWorks($page:Int!,$staff:Int!){Staff(id:$staff){id name{full} staffMedia(type:ANIME,page:$page,perPage:50,sort:START_DATE_DESC){pageInfo{currentPage hasNextPage} edges{staffRole node{id title{native romaji english} startDate{year month day} format siteUrl coverImage{large}}}}}}`;
export const normalizeTitle=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
function url(s){if(!s)return '';if(new URL(s).protocol!=='https:')throw Error('Invalid source URL');return s;}
export function normalizeEdges(edges,staffId=STAFF_ID){
 const records=new Map();
 for(const e of edges){
  if(e.staffRole?.trim()!=='Music')continue;
  const n=e.node,d=n?.startDate||{};
  if(!Number.isInteger(n?.id)||n.id<=0||!(n.title?.native||n.title?.romaji||n.title?.english))throw Error('Malformed Music record');
  if(d.year!=null&&(!Number.isInteger(d.year)||d.year<1900||d.year>2200))throw Error('Invalid year');
  records.set(n.id,{id:`anilist-${n.id}`,anilistId:n.id,title:n.title.native||n.title.romaji||n.title.english,titleEn:n.title.english||'',year:d.year||null,startDate:d.year?`${d.year}-${String(d.month||1).padStart(2,'0')}-${String(d.day||1).padStart(2,'0')}`:'',category:'anime',role:'Music',detail:'劇伴音楽',image:url(n.coverImage?.large),url:url(n.siteUrl||`https://anilist.co/anime/${n.id}`),sources:[`https://anilist.co/staff/${staffId}`,`https://anilist.co/anime/${n.id}`],source:'anilist-api'});
 }
 return [...records.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export async function fetchWorks(fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),staffId=STAFF_ID,acceptedNames=['yamazo'],allowEmpty=false){
 const all=[];
 for(let page=1;page<=100;page++){
  let payload;
  for(let attempt=0;attempt<3;attempt++){
   const r=await fetcher('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables:{page,staff:staffId}}),signal:AbortSignal.timeout(30000)});
   if(r.status===429||r.status>=500){if(attempt===2)throw Error(`AniList unavailable: HTTP ${r.status}`);const delay=Number(r.headers.get('retry-after'));await wait(Math.min(60000,delay>0?delay*1000:2000*2**attempt));continue;}
   if(!r.ok)throw Error(`AniList unavailable: HTTP ${r.status}. Existing Works preserved.`);
   payload=await r.json();break;
  }
  if(payload?.errors?.length)throw Error(`AniList error: ${payload.errors.map(e=>e.message).join('; ')}`);
  const s=payload?.data?.Staff,c=s?.staffMedia;
  if(s?.id!==staffId||!acceptedNames.includes(s.name?.full?.trim().toLowerCase())||!Array.isArray(c?.edges)||typeof c.pageInfo?.hasNextPage!=='boolean'||c.pageInfo.currentPage!==page)throw Error('Incomplete response or staff identity mismatch');
  all.push(...c.edges);
  if(!c.pageInfo.hasNextPage){const result=normalizeEdges(all,staffId);if(!result.length&&!allowEmpty)throw Error('Empty Music response; refusing update');return result;}
  await wait(1100);
 }
 throw Error('Pagination limit reached; refusing partial update');
}
// Resolve aliases from AniList itself; do not guess staff IDs from names.
export async function fetchAliasWorks(fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))){
 const query=`query AliasStaff($search:String!){Page(page:1,perPage:25){pageInfo{hasNextPage} staff(search:$search){id name{full native alternative}}}}`;
 const r=await fetcher('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables:{search:'Tomohiro Yamada'}}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(`Alias lookup failed: HTTP ${r.status}; retaining current site`);
 const data=await r.json();if(data.errors?.length||!Array.isArray(data.data?.Page?.staff)||data.data.Page.pageInfo?.hasNextPage!==false)throw Error('Incomplete alias lookup');
 const candidates=data.data.Page.staff.filter(s=>s.id!==STAFF_ID&&Number.isInteger(s.id)&&s.id>0&&(['tomohiro yamada','yamada tomohiro'].includes(s.name.full?.toLowerCase())||s.name.native?.replace(/\s/g,'')==='山田知広'));
 const verified=[];const anchors=new Set([21321,105928,100133]);
 for(const staff of candidates){
  const works=await fetchWorks(fetcher,wait,staff.id,[staff.name.full.toLowerCase()],true);
  // Two independently verified music credits distinguish this composer from namesakes.
  if(works.filter(w=>anchors.has(w.anilistId)).length<2){console.warn(`Skipped unverified namesake staff ${staff.id}`);continue;}
  for(const w of works)verified.push({...w,creditedAs:['山田知広','Tomohiro Yamada']});
 }
 return verified;
}
export function mergeWorks(previous,incoming){
 const byId=new Map(previous.map(w=>[w.id,w])),added=[],changed=[];
 for(const fresh of incoming){
  let prior=byId.get(fresh.id);
  if(!prior){prior=[...byId.values()].find(w=>!w.anilistId&&normalizeTitle(w.title)===normalizeTitle(fresh.title));if(prior)byId.delete(prior.id);}
  const merged=prior?{...prior,...fresh,sources:[...new Set([...prior.sources,...fresh.sources])]}:fresh;
  if(!prior)added.push(merged.id);else if(JSON.stringify(prior)!==JSON.stringify(merged))changed.push(merged.id);
  byId.set(merged.id,merged);
 }
 const missing=previous.filter(p=>p.source==='anilist-api'&&!incoming.some(n=>n.id===p.id)).map(p=>p.id);
 return {records:[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id)),added,changed,missing};
}
export async function sync(root=ROOT,fetcher=fetch){
 const file=path.join(root,'anilist.json'),before=await fs.readFile(file,'utf8');
 const primary=await fetchWorks(fetcher);
 const aliases=await fetchAliasWorks(fetcher);
 const incoming=mergeWorks(primary,aliases).records;
 const result=mergeWorks(JSON.parse(before),incoming);
 const serialized=JSON.stringify(result.records,null,2)+'\n';
 if(before!==serialized){await fs.writeFile(file+'.tmp',serialized);await fs.rename(file+'.tmp',file);}
 const status={lastSuccessfulSync:new Date().toISOString(),staffId:STAFF_ID,count:result.records.length,added:result.added,changed:result.changed,missing:result.missing};
 await fs.writeFile(path.join(root,'sync-status.json'),JSON.stringify(status,null,2)+'\n');
 const summary=`AniList Music: ${result.records.length}; added ${result.added.length}; changed ${result.changed.length}; absent from source (retained) ${result.missing.length}.`;
 console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))sync().catch(e=>{console.error(e.message);process.exitCode=1});
