import { candidate, titleFor, titleKey, mbEntity, normalize, httpsURL } from './matching.mjs';
const mb = (type,id,inc) => `https://musicbrainz.org/ws/2/${type}/${id}?fmt=json&inc=${inc}`;
const artists = item => (item['artist-credit'] || []).map(a=>a.name||a.artist?.name).filter(Boolean);
const year = date => /^\d{4}/.test(date||'')?Number(date.slice(0,4)):null;
export function localAnime(work, records) {
  if (!['score','anime'].includes(work.category)) return [];
  return records.filter(a=>a.id===work.id || [a.title,a.titleEn].filter(Boolean).some(t=>titleKey(t)===titleKey(titleFor(work))))
    .map(a=>candidate(work,{title:a.title,aliases:[a.titleEn],year:a.year,category:'anime',image:a.image,provider:'anilist',source_url:a.url,
      identity:a.id===work.id?`Stored AniList record ${a.id}`:null,release_id:a.anilistId?`anilist-${a.anilistId}`:`anilist-${a.id}`}));
}
export async function animeSearch(work,client) {
  // AniList indexes anime/manga, not general games. Do not search songs or OSTs as anime.
  if (!['score','anime'].includes(work.category) || /O\.?S\.?T\.?|サウンドトラック/i.test(titleFor(work))) return [];
  const body={query:'query($search:String!){Page(page:1,perPage:5){media(search:$search,type:ANIME){id title{native romaji english} startDate{year} siteUrl coverImage{large}}}}',variables:{search:titleFor(work)}};
  const json=await client.get('https://graphql.anilist.co',{body});
  if(!Array.isArray(json.data?.Page?.media)) throw Error('Malformed AniList search');
  return json.data.Page.media.map(a=>candidate(work,{title:a.title.native||a.title.romaji,aliases:[a.title.english,a.title.romaji],year:a.startDate.year,category:'anime',image:a.coverImage.large,source_url:a.siteUrl,provider:'anilist',identity:(work.id===`anilist-${a.id}` || work.anilistId===a.id || work.anilist_id===a.id || [work.official_url,work.source_url].some(u=>u===`https://anilist.co/anime/${a.id}`))?`AniList ID ${a.id}`:null,release_id:`anilist-${a.id}`}));
}
async function cover(work,client,entity,meta) {
  try {
    const data=await client.get(`https://coverartarchive.org/${entity.type}/${entity.id}`);
    // Never substitute back covers or discs for missing fronts.
    const front=data.images?.find(i=>i.front===true && i.approved!==false);
    if(!front) return null;
    return candidate(work,{...meta,image:front.thumbnails?.['500']||front.thumbnails?.['500x500']||front.image,provider:'cover-art-archive',source_url:`https://musicbrainz.org/${entity.type}/${entity.id}`,release_id:`mb-${entity.type}-${entity.id}`});
  } catch(e) { if(e.status===404) return null; throw e; }
}
export async function musicbrainz(work,records,client) {
  const out=[], errors=[];
  const attempt=async fn=>{try{return await fn();}catch(e){errors.push(e.message);return null;}};
  const stored=records.find(r=>r.id===work.id);
  const entities=[...new Map([work.official_url,work.source_url,...(stored?.sources||[])].map(mbEntity).filter(Boolean).map(e=>[`${e.type}/${e.id}`,e])).values()];
  for(const entity of entities.filter(e=>['release','release-group'].includes(e.type))) {
    const data=await attempt(()=>client.get(mb(entity.type,entity.id,'artist-credits'))); if(!data) continue;
    out.push(await attempt(()=>cover(work,client,entity,{title:data.title,artists:artists(data),year:year(data.date||data['first-release-date']),category:work.category,identity:`stored ${entity.type} URL ${entity.id}`})));
  }
  let recordings=entities.filter(e=>e.type==='recording').slice(0,3).map(e=>({...e,linked:true}));
  if(!recordings.length && work.category==='song' && !work.id.startsWith('legacy-')) {
    const query=`recording:"${titleFor(work).replace(/["\\]/g,' ')}"${work.artist?` AND artist:"${work.artist.split(' / ')[0].replace(/["\\]/g,' ')}"`:''}`;
    const data=await attempt(()=>client.get(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5`));
    recordings=(data?.recordings||[]).filter(r=>titleKey(r.title)===titleKey(titleFor(work))).slice(0,3).map(r=>({id:r.id,linked:false}));
  }
  for(const rec of recordings) {
    const data=await attempt(()=>client.get(mb('recording',rec.id,'releases+artist-credits'))); if(!data) continue;
    if(data.id!==rec.id) {errors.push('Recording identity mismatch');continue;}
    const releases=(data.releases||[]).filter(r=>!r.status || r.status==='Official').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice(0,5);
    for(const release of releases) out.push(await attempt(()=>cover(work,client,{type:'release',id:release.id},{title:data.title,artists:artists(data),year:year(release.date),category:'song',release_title:release.title,membership:`recording ${rec.id} → release ${release.id}`,identity:rec.linked?`stored recording ${rec.id}`:null})));
  }
  return {suggestions:out.filter(Boolean),errors};
}
export async function itunes(work,client) {
  if(!['song','album','original'].includes(work.category)) return [];
  const term=work.id.startsWith('legacy-')?titleFor(work):`${titleFor(work)} ${String(work.artist||'').split(' / ')[0]}`;
  const data=await client.get(`https://itunes.apple.com/search?${new URLSearchParams({term,country:'JP',media:'music',entity:work.id.startsWith('legacy-')||work.category==='album'?'album':'song',limit:'10',lang:'ja_jp'})}`);
  if(!Array.isArray(data.results)) throw Error('Malformed iTunes search');
  return data.results.map(r=>candidate(work,{title:r.trackName||r.collectionName,artist:r.artistName,year:year(r.releaseDate),category:work.category,image:r.artworkUrl100,source_url:r.trackViewUrl||r.collectionViewUrl,provider:'itunes',release_id:`itunes-${r.collectionId}`,release_title:r.collectionName}));
}
export const decode = value => String(value||'').replace(/&(?:amp|quot|apos|lt|gt|#39|#x([0-9a-f]+)|#(\d+));/gi,(m,h,d)=>h||d?String.fromCodePoint(Math.min(0x10ffff,parseInt(h||d,h?16:10))):({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'"}[m.toLowerCase()]||m));
export function ogp(html,base) {
  const meta={};
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]) {
    const attrs={}; for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);
    const key=(attrs.property||attrs.name||'').toLowerCase(); if(!meta[key]) meta[key]=attrs.content;
  }
  const title=meta['og:title']||decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  let image=''; try { image=httpsURL(new URL(meta['og:image:secure_url']||meta['og:image']||meta['twitter:image'],base).href); } catch {}
  const generic=/logo|favicon|no[-_]?image|default|common|banner|\/ads?\//i.test(image) || (Number(meta['og:image:width'])>0&&Number(meta['og:image:width'])<200);
  return {title,image,generic};
}
export function discography(html,base,work) {
  // Site-specific product block: never scrape benefit/advertising images.
  if(new URL(base).hostname!=='remohos.com'||!new URL(base).pathname.startsWith('/music/')) return null;
  const block=html.match(/<div class="music_title_wrap">([\s\S]*?)<h1/);const picture=html.match(/<div class="pic_box[^"]*">\s*<img[^>]*src="([^"]+)"/);
  if(!block||!picture) return null;
  const plain=s=>decode(s.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
  const title=plain(block[1]).replace(/^(?:シングル|アルバム)\s*/,''),prefix=block[1].match(/class="music_i01">([^<]+)/)?.[1]||'',short=block[1].match(/class="music_i04">([^<]+)/)?.[1]||'';
  const aliases=[short?prefix+' '+short:'',...(html.match(/<strong>[^<]+<\/strong>/g)||[]).map(t=>plain(t).replace(/^[0-9０-９]+[.．、]\s*/,''))].filter(Boolean);
  const date=html.match(/発売日<\/h5>\s*<div[^>]*>\s*(\d{4})年/);
  const artistNames=[...new Set([...html.matchAll(/歌：([^<]+)/g)].map(m=>plain(m[1])))];
  return candidate(work,{title,aliases,artists:artistNames,year:date?Number(date[1]):null,category:work.category,image:new URL(picture[1],base).href,provider:'official-discography',source_url:base,release_id:'remohos-'+new URL(base).pathname.split('/').pop().replace(/\.html$/,''),release_title:title});
}
export async function officialPages(work,client) {
  const suggestions=[],errors=[];
  for(const url of new Set([work.official_url,work.source_url].filter(httpsURL))) {
    // Third-party credit aggregators and video pages produce generic artwork; no agency crawling.
    if(/(?:musicbrainz\.org|anilist\.co|anisil\.com|uta-net\.com|youtube\.com|youtu\.be)/i.test(new URL(url).hostname)) continue;
    try { const page=await client.get(url,{json:false}),meta=ogp(page.html,page.url);
      const product=discography(page.html,page.url,work);if(product)suggestions.push(product);
      if(meta.image) suggestions.push(candidate(work,{...meta,category:work.category,provider:'page-ogp',source_url:page.url}));
    } catch(e) {errors.push(`${url}: ${e.message}`);}
  }
  return {suggestions:suggestions.filter(Boolean),errors};
}
