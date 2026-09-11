import fs from 'node:fs/promises';

const works = JSON.parse(await fs.readFile('yamazo_works_master.json', 'utf8')).sort(
  (a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.release_date ?? '').localeCompare(a.release_date ?? '') || (a.work_title ?? a.track_title ?? '').localeCompare(b.work_title ?? b.track_title ?? '', 'ja'),
);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safe = (value) => {
  if (!value) return '';
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'mailto:' ? esc(value) : ''; } catch { return ''; }
};
const categoryLabel = { score: 'Score / Soundtrack', song: 'Song', original: 'Original', performance: 'Performance' };
const titleFor = (work) => work.category === 'song' ? work.track_title : work.work_title;

const card = (work, index) => {
  const title = titleFor(work);
  const links = [['Official', work.official_url], ['Apple Music', work.apple_music], ['Spotify', work.spotify], ['YouTube', work.youtube]].filter(([, url]) => url);
  return `<article class="work-card${index >= 12 ? ' initial-hidden' : ''}" data-category="${esc(work.category)}" data-roles="${esc((work.roles || []).join(' '))}">
    <div class="work-card-top"><span>${esc(categoryLabel[work.category] || work.category)}</span>${work.year ? `<time datetime="${esc(work.year)}">${esc(work.year)}</time>` : ''}</div>
    ${work.category === 'song' && work.work_title ? `<p class="work-parent">${esc(work.work_title)}</p>` : ''}
    ${title ? `<h3>${esc(title)}</h3>` : ''}
    ${work.artist ? `<p class="artist">${esc(work.artist)}</p>` : ''}
    ${work.roles?.length ? `<p class="roles">${esc(work.roles.join(' / '))}</p>` : ''}
    ${work.credit_note ? `<p class="credit-note">${esc(work.credit_note)}</p>` : ''}
    ${links.length ? `<nav class="work-links" aria-label="${esc(title || 'Work')} の関連リンク">${links.map(([label, url]) => `<a href="${safe(url)}" target="_blank" rel="noreferrer">${label}<span aria-hidden="true"> ↗</span></a>`).join('')}</nav>` : ''}
  </article>`;
};

const featured = works.filter((work) => work.featured);
const featuredHtml = featured.length ? `<div class="featured-grid">${featured.map((work, index) => {
  const title = titleFor(work);
  return `<article class="featured-card"><div class="featured-visual">${work.image ? `<img src="${safe(work.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${String(index + 1).padStart(2, '0')}</span>`}</div><div class="featured-copy"><p>${esc(categoryLabel[work.category] || work.category)}${work.year ? ` · ${esc(work.year)}` : ''}</p>${title ? `<h3>${esc(title)}</h3>` : ''}${work.artist ? `<p class="artist">${esc(work.artist)}</p>` : ''}${work.roles?.length ? `<p class="roles">${esc(work.roles.join(' / '))}</p>` : ''}</div></article>`;
}).join('')}</div>` : '<p class="empty-state">Featured WorksはWorks Masterで指定されます。</p>';

const worksHtml = `<div class="works-toolbar" aria-label="Worksを絞り込む">
  <button type="button" class="active" aria-pressed="true" data-filter="all">All</button>
  <button type="button" aria-pressed="false" data-filter="score">Score</button>
  <button type="button" aria-pressed="false" data-filter="song">Songs</button>
  <button type="button" aria-pressed="false" data-filter="compose">Compose</button>
  <button type="button" aria-pressed="false" data-filter="arrange">Arrange</button>
  <button type="button" aria-pressed="false" data-filter="guitar">Guitar</button>
</div><p class="result-count" aria-live="polite">${works.length} credits</p><div class="works-grid">${works.map(card).join('')}</div>${works.length > 12 ? `<button class="show-more" type="button">もっと見る（残り${works.length - 12}件）</button>` : ''}`;

let html = await fs.readFile('template.html', 'utf8');
html = html.replace('{{FEATURED}}', featuredHtml).replace('{{WORKS}}', worksHtml).replace('{{YEAR}}', String(new Date().getFullYear()));
await fs.mkdir('dist', { recursive: true });
await fs.writeFile('dist/index.html', html);
await Promise.all(['styles.css', 'app.js', 'favicon.svg', 'yamazo.jpg', 'yamazo_works_master.json'].map((file) => fs.copyFile(file, `dist/${file}`)));
await fs.writeFile('dist/.nojekyll', '');
console.log(`Built ${works.length} temporary credits from yamazo_works_master.json.`);
