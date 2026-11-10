import fs from 'node:fs/promises';
import path from 'node:path';

const works = JSON.parse(await fs.readFile('yamazo_works_master.json', 'utf8')).sort(
  (a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.release_date ?? '').localeCompare(a.release_date ?? '') || (a.work_title ?? a.track_title ?? '').localeCompare(b.work_title ?? b.track_title ?? '', 'ja'),
);
const releases = JSON.parse(await fs.readFile('releases.json', 'utf8').catch(()=>'[]'));
const releasesMap = new Map(releases.map((release) => [release.id, release]));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safe = (value) => {
  if (!value) return '';
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'mailto:' ? esc(value) : ''; } catch { return ''; }
};
const safeImage = (value) => {
  if (!value) return '';
  if (value.startsWith('assets/') || value.startsWith('./assets/') || value.startsWith('/assets/')) return esc(value);
  try { const url = new URL(value); return url.protocol === 'https:' ? esc(value) : ''; } catch { return ''; }
};
const categoryLabel = { score: 'Score / Soundtrack', song: 'Song', original: 'Original', performance: 'Performance' };
const titleFor = (work) => work.category === 'song' ? work.track_title : work.work_title;
const artworkFor = (work) => {
  if (work.image) return { src: safeImage(work.image), source: 'work' };
  const release = work.release_id ? releasesMap.get(work.release_id) : null;
  if (!release?.artwork?.src) return null;
  const src = safeImage(release.artwork.src);
  return src ? { src, source: release.artwork.provider || 'release' } : null;
};
const workImage = (work, className = '', loading = 'lazy') => {
  const image = artworkFor(work);
  if (!image?.src) return '';
  const title = titleFor(work);
  const label = `${title}${work.artist ? ` ${work.artist}` : ''} 作品画像`;
  const normalizedLoading = loading === 'eager' ? 'eager' : 'lazy';
  return `<img class="${esc(className)}" src="${image.src}" alt="${esc(label)}" loading="${normalizedLoading}" referrerpolicy="no-referrer" decoding="async">`;
};

const card = (work, index) => {
  const title = titleFor(work);
  const links = [['Official', work.official_url], ['Apple Music', work.apple_music], ['Spotify', work.spotify], ['YouTube', work.youtube]].filter(([, url]) => safe(url));
  const image = workImage(work, 'work-card-image');
  const date = work.release_date || String(work.year || '');
  return `<article class="work-card${image ? ' has-image' : ''}" data-category="${esc(work.category)}" data-roles="${esc((work.roles || []).join(' '))}" data-year="${esc(work.year)}" data-search="${esc([title, work.work_title, work.artist, work.credit_note, ...(work.roles || [])].filter(Boolean).join(' '))}">
    <div class="work-card-visual">${image || `<span aria-hidden="true">${work.category === 'score' ? 'SC' : work.category === 'song' ? 'SG' : 'YM'}</span>`}</div>
    <div class="work-card-main">
      <div class="work-card-top"><span>${esc(categoryLabel[work.category] || work.category)}</span>${date ? `<time datetime="${esc(date)}">${esc(date.replaceAll('-', '.'))}</time>` : ''}</div>
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      ${work.artist ? `<p class="artist">${esc(work.artist)}</p>` : ''}
      <div class="work-card-bottom">${work.roles?.length ? `<p class="roles">${esc(work.roles.join(' / '))}</p>` : ''}
      ${links.length ? `<a class="work-primary-link" href="${safe(links[0][1])}" target="_blank" rel="noreferrer" aria-label="${esc(title)} ${esc(links[0][0])}（新しいタブ）">${esc(links[0][0])} ↗</a>` : ''}</div>
      ${(work.work_title && work.category === 'song') || work.credit_note || links.length > 1 ? `<details class="work-details"><summary>作品詳細 <span aria-hidden="true">＋</span></summary><div>${work.category === 'song' && work.work_title ? `<p class="work-parent">${esc(work.work_title)}</p>` : ''}${work.credit_note ? `<p class="credit-note">${esc(work.credit_note)}</p>` : ''}${links.length > 1 ? `<nav class="work-links" aria-label="${esc(title || 'Work')} の関連リンク">${links.slice(1).map(([label, url]) => `<a href="${safe(url)}" target="_blank" rel="noreferrer">${label} ↗</a>`).join('')}</nav>` : ''}</div></details>` : ''}
    </div>
  </article>`;
};

const featured = works.filter((work) => work.featured);
const featuredHtml = featured.length ? `<div class="featured-grid">${featured.map((work, index) => {
  const title = titleFor(work);
  const image = workImage(work, 'featured-image');
  return `<article class="featured-card">
      <div class="featured-visual">${image ? workImage(work, 'featured-image', 'eager') : `<span>${String(index + 1).padStart(2, '0')}</span>`}</div>
    <div class="featured-copy">
      <p>${esc(categoryLabel[work.category] || work.category)}${work.year ? ` · ${esc(work.year)}` : ''}</p>
      ${title ? `<h3>${esc(title)}</h3>` : ''}${work.artist ? `<p class="artist">${esc(work.artist)}</p>` : ''}${work.roles?.length ? `<p class="roles">${esc(work.roles.join(' / '))}</p>` : ''}
    </div>
  </article>`;
}).join('')}</div>` : '<p class="empty-state">Featured WorksはWorks Masterで指定されます。</p>';

const years = [...new Set(works.map(work => work.year).filter(Boolean))].sort((a,b)=>b-a);
const worksHtml = `<div class="works-controls"><div class="works-control-top"><label class="works-search-label"><span>SEARCH ARCHIVE</span><input type="search" id="works-search" placeholder="作品名・アーティスト・クレジットを検索" autocomplete="off"></label><label class="works-year-label"><span>YEAR</span><select id="works-year"><option value="all">すべての年</option>${years.map(year=>`<option value="${esc(year)}">${esc(year)}</option>`).join('')}</select></label></div>
<div class="works-control-bottom"><div class="works-toolbar" aria-label="Worksを絞り込む">
  <button type="button" class="active" aria-pressed="true" data-filter="all">All</button>
  <button type="button" aria-pressed="false" data-filter="score">Score</button>
  <button type="button" aria-pressed="false" data-filter="song">Songs</button>
  <button type="button" aria-pressed="false" data-filter="compose">Compose</button>
  <button type="button" aria-pressed="false" data-filter="arrange">Arrange</button>
  <button type="button" aria-pressed="false" data-filter="guitar">Guitar</button>
</div><p class="result-count" aria-live="polite">${works.length} credits</p></div></div><div class="works-grid">${works.map(card).join('')}</div><p class="works-empty" hidden>該当する作品はありません。検索語や絞り込みを変えてください。</p><button class="show-more" type="button" hidden>もっと見る</button>`;

let html = await fs.readFile('template.html', 'utf8');
html = html.replace('{{FEATURED}}', featuredHtml).replace('{{WORKS}}', worksHtml).replace('{{YEAR}}', String(new Date().getFullYear()));
const missing = works.filter((work) => !artworkFor(work));
console.log(`Missing artwork: ${missing.length} / ${works.length}`);
for (const work of missing) {
  const title = titleFor(work);
  console.log(`- ${work.id} / ${title || '未設定'} / ${work.artist || 'artistなし'} / ${work.year || 'yearなし'}`);
}
await fs.mkdir('dist', { recursive: true });
await fs.writeFile('dist/index.html', html);
await Promise.all(['styles.css', 'app.js', 'favicon.svg', 'yamazo.jpg', 'yamazo_works_master.json', 'releases.json'].map((file) => fs.copyFile(file, `dist/${file}`)));
await fs.mkdir('dist/assets', { recursive: true });
await fs.mkdir('dist/assets/covers', { recursive: true });
for (const file of await fs.readdir('assets/covers', { withFileTypes: true }).catch(() => [])) {
  if (!file.isFile()) continue;
  const source = path.join('assets/covers', file.name);
  const target = path.join('dist', source);
  await fs.copyFile(source, target).catch(() => null);
}
await fs.writeFile('dist/.nojekyll', '');
console.log(`Built ${works.length} temporary credits from yamazo_works_master.json.`);
