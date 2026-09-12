import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from './artwork/http.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function imageExtension(buffer,mime) {
  if(!mime.toLowerCase().startsWith('image/')) throw Error('Response is not an image');
  // Some official CDNs mislabel JPEG as image/gif. Use the actual bytes for the extension.
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255) return '.jpg';
  if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP') return '.webp';
  throw Error('Unsupported or invalid image bytes');
}
export async function fetchArtwork(root=ROOT,{apply=false,ids=[]}={}) {
  const file=path.join(root,'releases.json'),raw=await fs.readFile(file,'utf8'),releases=JSON.parse(raw),next=structuredClone(releases);
  for(const id of ids) if(!releases.some(r=>r.id===id)) throw Error(`Unknown release: ${id}`);
  let changed=0;
  for(const r of next) {
    const src=r.artwork?.src;if(!src?.startsWith('https:')||(ids.length&&!ids.includes(r.id))) continue;
    if(!/^[a-zA-Z0-9_-]+$/.test(r.id)) throw Error('Unsafe release ID');
    // iTunes artwork remains a review candidate; no local redistribution by this command.
    if(r.artwork.provider==='itunes') {console.log(`Skip iTunes local copy: ${r.id}`);continue;}
    try {
      const response=await request(src,{},8*1024*1024),ext=imageExtension(response.body,response.mime),local=`assets/covers/${r.id}${ext}`;
      if(apply) {await fs.mkdir(path.join(root,'assets/covers'),{recursive:true});await fs.writeFile(path.join(root,local),response.body,{flag:'wx'});r.artwork={...r.artwork,original_src:src,src:local};changed++;}
      console.log(`${apply?'Saved':'Validated'} ${r.id} (${response.body.length} bytes)`);
    }catch(e){console.warn(`Skip ${r.id}: ${e.message}`);}
  }
  if(apply&&changed) {await fs.mkdir(path.join(root,'.artwork-backups'),{recursive:true});await fs.writeFile(path.join(root,'.artwork-backups',`releases-${Date.now()}.json`),raw);await fs.writeFile(file+'.tmp',JSON.stringify(next,null,2)+'\n');await fs.rename(file+'.tmp',file);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={ids:[]};for(let i=0;i<args.length;i++){if(args[i]==='--apply')options.apply=true;else if(args[i]==='--release'&&args[i+1])options.ids.push(args[++i]);else throw Error(`Unknown argument: ${args[i]}`);}
  fetchArtwork(ROOT,options).catch(e=>{console.error(e.message);process.exitCode=1;});
}
