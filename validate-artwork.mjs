import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from './artwork/http.mjs';
import {imageExtension} from './fetch-artwork.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
// Validate the best candidate per work; no image files are stored or published.
export async function validate(root=ROOT,{all=false,retryFailed=false}={}) {
 const file=path.join(root,'artwork_candidates.json'),data=JSON.parse(await fs.readFile(file,'utf8')),urls=new Set();
 for(const item of data.items) for(const s of (retryFailed?item.suggestions.filter(s=>s.image_validation?.ok===false):all?item.suggestions:item.suggestions.slice(0,1))) urls.add(s.artwork.src);
 const results=new Map(),queue=[...urls];
 async function worker(){while(queue.length){const url=queue.shift();try{const r=await request(url,{},8*1024*1024);imageExtension(r.body,r.mime);results.set(url,{ok:true,checked_at:new Date().toISOString(),mime:r.mime,bytes:r.body.length});}catch(e){results.set(url,{ok:false,checked_at:new Date().toISOString(),error:e.message});}console.log(`${results.size}/${urls.size} ${results.get(url).ok?'OK':'FAILED'} ${url}`);}}
 await Promise.all([worker(),worker(),worker()]);
 for(const item of data.items) for(const s of item.suggestions) if(results.has(s.artwork.src)){s.image_validation=results.get(s.artwork.src);if(!s.image_validation.ok){s.match_confidence??=s.confidence;s.match_status??=s.status;s.blockers=[...new Set([...s.blockers,'image_unavailable'])];s.confidence=s.score=Math.min(s.confidence,69);s.status='hold';}else{s.blockers=s.blockers.filter(b=>b!=='image_unavailable');s.confidence=s.score=s.match_confidence??s.confidence;s.status=s.match_status??s.status;}}
 for(const item of data.items) item.suggestions.sort((a,b)=>b.confidence-a.confidence);
 data.summary={...data.summary,auto_eligible:data.items.filter(i=>i.suggestions.some(s=>s.status==='auto_eligible')).length,review:data.items.filter(i=>!i.suggestions.some(s=>s.status==='auto_eligible')&&i.suggestions.some(s=>s.status==='review')).length,hold_only:data.items.filter(i=>i.suggestions.length&&i.suggestions.every(s=>s.status==='hold')).length};
 await fs.writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');await fs.rename(file+'.tmp',file);
 const summary={unique_images:results.size,passed:[...results.values()].filter(r=>r.ok).length,failed:[...results.values()].filter(r=>!r.ok).length};
 console.log(JSON.stringify(summary));return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {const args=process.argv.slice(2);if(args.some(a=>!['--all','--retry-failed'].includes(a)))throw Error('Usage: node validate-artwork.mjs [--all | --retry-failed]');validate(ROOT,{all:args.includes('--all'),retryFailed:args.includes('--retry-failed')}).catch(e=>{console.error(e);process.exitCode=1;});}
