// Edition dates describe the released audio edition, never the anime air date.
export const soundtrackFormats = work => [...new Set((work.release_editions || []).map(edition => edition.format).filter(Boolean))];
export function renderSoundtrackEditions(work, esc, safe) {
  if (work.category !== 'soundtrack' || !work.release_editions?.length) return '';
  return `<ul class="release-editions">${work.release_editions.map(edition => {
    const date = edition.release_date;
    const heading = [edition.title, edition.format].filter(Boolean).join(' · ');
    return `<li><strong>${esc(heading)}</strong>${date ? ` <time datetime="${esc(date)}">${esc(date.replaceAll('-', '.'))}</time>` : ''}${edition.catalog_number ? `<span class="edition-catalog">${esc(edition.catalog_number)}</span>` : ''}${edition.note ? `<p>${esc(edition.note)}</p>` : ''}${safe(edition.url) ? `<a href="${safe(edition.url)}" target="_blank" rel="noreferrer">${esc(edition.link_label || '発売・配信情報')} ↗</a>` : ''}</li>`;
  }).join('')}</ul>`;
}
