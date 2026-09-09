import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [anime,legacy,overrides,music,verified]=await Promise.all(['anilist.json','legacy.json','overrides.json','musicbrainz.json','verified-songs.json'].map(read));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=s=>s&&new URL(s).protocol==='https:'?esc(s):'';
const works=[...anime,...legacy,...music,...verified].filter(w=>!w.mergedInto&&!overrides.excludedIds.includes(w.id)).map(w=>({...w,...overrides.records[w.id]})).sort((a,b)=>(b.year||0)-(a.year||0)||(b.startDate||'').localeCompare(a.startDate||''));
const latest=works.filter(w=>w.category==='anime'&&w.image).slice(0,4);
const latestHtml=`<section class="latest-section" aria-labelledby="latest-title"><div class="section-title"><h2 id="latest-title">Latest works</h2><span>ANIMATION / 劇伴音楽</span></div><div class="latest-grid">${latest.map((w,i)=>`<a class="latest-card" href="${safe(w.url)}"><div class="cover-frame"><img src="${safe(w.image)}" alt="${esc(w.title)}" width="460" height="650" loading="lazy" referrerpolicy="no-referrer"></div><div class="card-meta"><span>0${i+1} / ${esc(w.year)}</span><span>劇伴音楽 ↗</span></div><h3>${esc(w.title)}</h3>${w.titleEn&&w.titleEn!==w.title?`<p>${esc(w.titleEn)}</p>`:''}</a>`).join('')}</div></section>`;
function renderList(rows,anime){
 const render=items=>items.map((w,i)=>`<article class="work-row${i===0||items[i-1].year!==w.year?' year-start':''}"><span class="year">${i===0||items[i-1].year!==w.year?esc(w.year||'—'):''}</span><div><h3>${w.url&&w.source!=='legacy'?`<a href="${safe(w.url)}">${esc(w.title)}</a>`:esc(w.title)}</h3><p>${esc(anime?w.titleEn:w.detail)}</p></div><span class="role">${anime?'劇伴音楽':esc(w.role)}</span></article>`).join('');
 return render(rows.slice(0,5))+(rows.length>5?`<details class="more-works"><summary><span class="when-closed">もっと見る（残り${rows.length-5}件）</span><span class="when-open">閉じる</span><span aria-hidden="true">＋</span></summary>${render(rows.slice(5))}</details>`:'');
}
const animeHtml=renderList(works.filter(w=>w.category==='anime'),true);
const songsHtml=renderList(works.filter(w=>w.category!=='anime'),false);
const worksHtml=`<section class="works-section" id="works"><div class="section-title"><h2>Works</h2><span>${works.length} CREDITS</span></div><h3 class="list-heading">Animation <span>劇伴音楽</span></h3><div class="work-list">${animeHtml}</div><h3 class="list-heading songs-heading">Songs &amp; other works <span>楽曲提供・参加作品</span></h3><div class="work-list">${songsHtml}</div></section>`;
let html=await fs.readFile('template.html','utf8');
if(!html.includes('{{LATEST}}')||!html.includes('{{WORKS}}'))throw Error('Missing template markers');
html=html.replace('{{LATEST}}',latestHtml).replace('{{WORKS}}',worksHtml).replace(/© \d{4} yamazo/,`© ${new Date().getFullYear()} yamazo`);
await fs.mkdir('dist',{recursive:true});
await fs.writeFile('dist/index.html',html);
await Promise.all(['styles.css','favicon.svg'].map(f=>fs.copyFile(f,`dist/${f}`)));
await fs.writeFile('dist/.nojekyll','');
console.log(`Built ${works.length} credits, ${latest.length} covers, one video. No client JavaScript.`);
