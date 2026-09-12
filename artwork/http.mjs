import fs from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { hash, httpsURL } from './matching.mjs';
export function publicIP(address) {
  if (isIP(address) === 4) { const [a,b] = address.split('.').map(Number); return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)); }
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address);
}
export async function publicURL(value) {
  const safe = httpsURL(value); if (!safe) throw Error('Only HTTPS URLs without credentials are allowed');
  const u = new URL(safe); if (u.port && u.port !== '443') throw Error('Unsupported port');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{address:host}] : await lookup(host, {all:true});
  if (!addresses.length || addresses.some(a => !publicIP(a.address))) throw Error('Non-public destination refused');
  return safe;
}
export async function request(url, options = {}, limit = 4 * 1024 * 1024) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    await publicURL(url);
    const response = await fetch(url, { ...options, redirect:'manual', signal:AbortSignal.timeout(20000) });
    if ([301,302,303,307,308].includes(response.status)) { const location = response.headers.get('location'); await response.body?.cancel(); if (!location) throw Error('Redirect without location'); url = new URL(location,url).href; continue; }
    if (!response.ok) { await response.body?.cancel(); const e = Error(`HTTP ${response.status}: ${url}`); e.status = response.status; e.retryAfter = response.headers.get('retry-after'); throw e; }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw Error('Response too large'); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw Error('Response too large'); chunks.push(chunk); }
    return { body:Buffer.concat(chunks), url, mime:response.headers.get('content-type') || '' };
  }
  throw Error('Too many redirects');
}
export class Client {
  constructor(dir, {offline=false, refresh=false} = {}) { this.dir=dir; this.offline=offline; this.refresh=refresh; this.last=new Map(); this.errors=[]; }
  async get(url, {json=true, body} = {}) {
    const key = hash([url,body]), file = `${this.dir}/${key}.json`;
    try { const cached=JSON.parse(await fs.readFile(file,'utf8')); if (!this.refresh && Date.now()-cached.at < (cached.missing ? 86400000 : 7*86400000)) { if(cached.missing) {const e=Error(`HTTP 404 (cached): ${url}`);e.status=404;throw e;} return cached.value; } } catch(e) { if(e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
    if (this.offline) throw Error(`Offline cache miss: ${url}`);
    const host = new URL(url).hostname, interval=host==='itunes.apple.com'?3200:host==='graphql.anilist.co'?2200:1100;
    for(let attempt=0;attempt<3;attempt++) {
      const scheduled=Math.max(Date.now(),(this.last.get(host)||0)+interval);this.last.set(host,scheduled);await new Promise(r=>setTimeout(r,scheduled-Date.now()));
      try {
        const result = await request(url,{headers:{'User-Agent':'yamazo-artwork/2.0 (https://yamazo.jp)',Accept:json?'application/json':'text/html',...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
        const value=json?JSON.parse(result.body.toString('utf8')):{html:result.body.toString('utf8'),url:result.url};
        if(json && value.errors) throw Error(JSON.stringify(value.errors));
        await fs.mkdir(this.dir,{recursive:true}); await fs.writeFile(file,JSON.stringify({at:Date.now(),value})); return value;
      } catch(e) { if(e.status===404) {await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(file,JSON.stringify({at:Date.now(),missing:true}));} if(![429,500,502,503,504].includes(e.status)||attempt===(host==='coverartarchive.org'?0:2)) throw e; await new Promise(r=>setTimeout(r,Math.min(30000,Math.max(2000*2**attempt,Number(e.retryAfter||0)*1000)))); }
    }
  }
}
