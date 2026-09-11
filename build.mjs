import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [anime,legacy,overrides,music,verified,soundtracks]=await Promise.all(['anilist.json','legacy.json','overrides.json','musicbrainz.json','verified-songs.json','soundtracks.json'].map(read));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=s=>s&&new URL(s).protocol==='https:'?esc(s):'';
// MusicBrainz lists many anime character/theme songs as song credits. Keep those
// attached to the animation work rather than mixing them into general client work.
const animeSongTitles=new Set([
 'Full moon…!','はなうた*ステップ','Dancing to Night ～君への最短ワープ航路～','未来への咆哮',
 'てっぺん目指し隊','テンダー・ファインダー','青空パレード','Happy Snow',"It's OK!!",'Start',
 'Viba鍋!よっつ星','きっと ずっと もっと','ヒカリ断ツ雨','届かない恋','翼はないけど',
 'もうそう♡えくすぷれす','FIGHTING SPIRIT','Leaf ticket','勇気の神様','DOUBLE PUNCH LOVE',
 'GROW STRONGER','Memory Heart Message','PROMISED FIELD','夜明け星','Neo Image','イノセント',
 'スタッカート・デイズ','空色モノローグ','思い出シュノーケル','終わらない詩','僕らの翼',
 'Magenta Another Sky','君が夢を連れてきた','戦けよ、冥闇の王は降りた','†命短し恋せよ乙女†',
 'keep on runnin\'','Masquerade!','READY','SECRET×2','アキハバラ☆だんす☆なう!!','あたしのキ・モ・チ',
 'いいえ、トムは妹に対して性的な興奮を覚えています','オレンジ','カメレオンドーター','ただいま。',
 'ほらいずむ','マエガミ☆','好きなんだもん！','笑顔のデッサン','白いココロ','贖罪のセレナーデ',
 'Shine!','妹プリ～ズ!'
]);
const works=[...anime,...legacy,...music,...verified,...soundtracks].filter(w=>!w.mergedInto&&!overrides.excludedIds.includes(w.id)&&!(w.source==='musicbrainz'&&!w.detail)&&!String(w.title).includes('オリジナルカラオケ')).map(w=>{const row={...w,...overrides.records[w.id]};return animeSongTitles.has(row.title)?{...row,category:'anime-song'}:row;}).sort((a,b)=>(b.year||0)-(a.year||0)||(b.startDate||'').localeCompare(a.startDate||''));
const latest=works.filter(w=>w.category==='anime'&&w.image).slice(0,4);
const latestHtml=`<section class="latest-section" aria-labelledby="latest-title"><div class="section-title"><h2 id="latest-title">Latest works</h2><span>ANIMATION / 劇伴音楽</span></div><div class="latest-grid">${latest.map((w,i)=>`<a class="latest-card" href="${safe(w.url)}"><div class="cover-frame"><img src="${safe(w.image)}" alt="${esc(w.title)}" width="460" height="650" loading="lazy" referrerpolicy="no-referrer"></div><div class="card-meta"><span>0${i+1} / ${esc(w.year)}</span><span>劇伴音楽 ↗</span></div><h3>${esc(w.title)}</h3>${w.titleEn&&w.titleEn!==w.title?`<p>${esc(w.titleEn)}</p>`:''}</a>`).join('')}</div></section>`;
function renderList(rows,kind){
 const render=items=>items.map((w,i)=>`<article class="work-row${i===0||items[i-1].year!==w.year?' year-start':''}"><span class="year">${i===0||items[i-1].year!==w.year?esc(w.year||'—'):''}</span><div><h3>${w.url&&w.source!=='legacy'?`<a href="${safe(w.url)}">${esc(w.title)}</a>`:esc(w.title)}</h3><p>${esc(kind==='anime'?w.titleEn:w.detail)}</p></div><span class="role">${kind==='anime'?'劇伴音楽':kind==='anime-song'?'主題歌・挿入歌':esc(w.role)}</span></article>`).join('');
 return render(rows.slice(0,5))+(rows.length>5?`<details class="more-works"><summary><span class="when-closed">もっと見る（残り${rows.length-5}件）</span><span class="when-open">閉じる</span><span aria-hidden="true">＋</span></summary>${render(rows.slice(5))}</details>`:'');
}
const animeHtml=renderList(works.filter(w=>w.category==='anime'),'anime');
const soundtrackHtml=renderList(works.filter(w=>w.category==='soundtrack'),'soundtrack');
const animeSongsHtml=renderList(works.filter(w=>w.category==='anime-song'),'anime-song');
const songsHtml=renderList(works.filter(w=>w.category==='song'),false);
const worksHtml=`<section class="works-section" id="works"><div class="section-title"><h2>Works</h2><span>${works.length} CREDITS</span></div><h3 class="list-heading">Animation <span>劇伴音楽</span></h3><div class="work-list">${animeHtml}</div><h3 class="list-heading songs-heading">Soundtracks <span>サウンドトラック・アルバム</span></h3><div class="work-list">${soundtrackHtml}</div><h3 class="list-heading songs-heading">Animation songs <span>主題歌・挿入歌・キャラクターソング</span></h3><div class="work-list">${animeSongsHtml}</div><h3 class="list-heading songs-heading">Songs &amp; other works <span>楽曲提供・参加作品</span></h3><div class="work-list">${songsHtml}</div></section>`;
let html=await fs.readFile('template.html','utf8');
if(!html.includes('{{LATEST}}')||!html.includes('{{WORKS}}'))throw Error('Missing template markers');
html=html.replace('{{LATEST}}',latestHtml).replace('{{WORKS}}',worksHtml).replace(/© \d{4} yamazo/,`© ${new Date().getFullYear()} yamazo`);
await fs.mkdir('dist',{recursive:true});
await fs.writeFile('dist/index.html',html);
await Promise.all(['styles.css','favicon.svg','yamazo.jpg'].map(f=>fs.copyFile(f,`dist/${f}`)));
await fs.writeFile('dist/.nojekyll','');
console.log(`Built ${works.length} credits, ${latest.length} covers, one video. No client JavaScript.`);
