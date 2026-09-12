import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, hasArtwork, httpsURL, hash } from './artwork/matching.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function planApproval(works,catalog,candidates,decisions) {
  if(candidates.schema_version!==2||candidates.incomplete) throw Error('Regenerate candidates with Artwork Resolver v2');
  if(!Array.isArray(decisions)) throw Error('Decisions must be an array');
  const nextWorks=structuredClone(works),nextCatalog=structuredClone(catalog),seen=new Set(),applied=[];
  for(const d of decisions) {
    if(!d.work_id||seen.has(d.work_id)) throw Error(`Missing/duplicate work decision: ${d.work_id}`);seen.add(d.work_id);
    if(!['accept','reject','hold'].includes(d.decision)) throw Error(`Unknown decision: ${d.decision}`);
    const work=nextWorks.find(w=>w.id===d.work_id); if(!work) throw Error(`Unknown work: ${d.work_id}`);
    if(d.decision!=='accept') continue;
    const item=candidates.items.find(i=>i.work_id===d.work_id),s=item?.suggestions.find(s=>s.id===d.suggestion_id);
    if(!s) throw Error(`Unknown suggestion: ${d.work_id}/${d.suggestion_id}`);
    if(item.work_fingerprint!==fingerprint(work)) throw Error(`Stale candidate: ${work.id}`);
    if(hasArtwork(work,catalog)) throw Error(`Artwork already confirmed: ${work.id}; replacement requires a separate reviewed edit`);
    if(s.image_validation?.ok===false) throw Error('Candidate image is unavailable; revalidate before approval');
    if(!httpsURL(s.artwork?.src)||!httpsURL(s.source_url)) throw Error('Invalid artwork/source URL');
    if(d.mode==='auto'&&(s.confidence<95||s.status!=='auto_eligible'||s.blockers?.length||!s.image_validation?.ok||Date.now()-Date.parse(s.image_validation.checked_at)>7*86400000||!Number.isFinite(Date.parse(s.image_validation.checked_at)))) throw Error('Candidate is not auto eligible');
    const releaseId=s.release_id;
    if(!/^[a-zA-Z0-9_-]+$/.test(releaseId)) throw Error('Invalid release ID');
    const existing=nextCatalog.find(r=>r.id===releaseId);
    if(existing?.artwork?.src&&existing.artwork.src!==s.artwork.src) throw Error(`Conflicting artwork for ${releaseId}`);
    const artwork={...s.artwork,approval:{approved_at:new Date().toISOString(),mode:d.mode==='auto'?'auto':'human',candidate_id:s.id,confidence:s.confidence,evidence:s.evidence,blockers:s.blockers,work_fingerprint:item.work_fingerprint}};
    if(!existing) nextCatalog.push({id:releaseId,release_title:s.release_title||s.title,release_type:item.category,release_date:s.year?String(s.year):'',artwork});
    else if(!existing.artwork?.src) existing.artwork=artwork;
    work.release_id=releaseId;applied.push({work_id:work.id,suggestion_id:s.id,release_id:releaseId});
  }
  return {works:nextWorks,catalog:nextCatalog,applied};
}
export async function approve(root,selection,{apply=false}={}) {
  const read=async name=>JSON.parse(await fs.readFile(path.resolve(root,name),'utf8'));
  const [works,catalog,candidates,decisions]=await Promise.all(['yamazo_works_master.json','releases.json','artwork_candidates.json',selection].map(read));
  const plan=planApproval(works,catalog,candidates,decisions);
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',changes:plan.applied},null,2));
  if(!apply||!plan.applied.length) return plan;
  // Back up the pair before writing. Catalog first: a stray unused release is safer than a dangling work link.
  const backup=path.join(root,'.artwork-backups',`${Date.now()}-${hash(decisions).slice(0,8)}`);await fs.mkdir(backup,{recursive:true});
  for(const name of ['yamazo_works_master.json','releases.json']) await fs.copyFile(path.join(root,name),path.join(backup,name));
  for(const [name,value] of [['releases.json',plan.catalog],['yamazo_works_master.json',plan.works]]) {const file=path.join(root,name);await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await fs.rename(file+'.tmp',file);}
  await fs.writeFile(path.join(backup,'decisions.json'),JSON.stringify(decisions,null,2)+'\n');return plan;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);if(!args[0]||args.slice(1).some(a=>!['--apply','--dry-run'].includes(a))) throw Error('Usage: node approve-artwork.mjs decisions.json [--apply] (default: dry-run)');
  approve(ROOT,args[0],{apply:args.includes('--apply')&&!args.includes('--dry-run')}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
