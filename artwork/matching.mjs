import { createHash } from 'node:crypto';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
// Strip presentation prefixes only. Season numbers, repeated LOVE, OST and versions remain significant.
export const artistKey = value => normalize(String(value??'').normalize('NFKC').replace(/\bCV\s*[:：]?/gi,''));
export const titleKey = value => normalize(String(value ?? '').replace(/^(?:TVアニメ|テレビアニメ|劇場版|TV series|Movie)\s*/i, ''));
export const titleFor = work => work.track_title || work.work_title || '';
export const fingerprint = work => hash(work);
export const hasArtwork = (work, releases) => Boolean(work.image?.trim() || releases.find(r => r.id === work.release_id)?.artwork?.src?.trim());
export function httpsURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function mbEntity(value) {
  try { const u = new URL(value); if (u.hostname !== 'musicbrainz.org') return null;
    const m = u.pathname.match(/^\/(release-group|release|recording|work)\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/?$/i);
    return m ? { type: m[1], id: m[2] } : null;
  } catch { return null; }
}
export function evaluate(work, meta) {
  const evidence = [], blockers = [];
  let confidence = 0;
  const add = (code, points, detail) => { evidence.push({ code, points, detail }); confidence += points; };
  const title = titleFor(work), titles = [meta.title, ...(meta.aliases || [])].filter(Boolean);
  const exact = titles.some(t => normalize(t) === normalize(title));
  const normalized = titles.some(t => titleKey(t) === titleKey(title));
  if (exact) add('title_exact', 45, `${title} = ${titles.find(t=>normalize(t)===normalize(title))}`);
  else if (normalized) add('title_presentation_normalized', 40, `${title} = ${titles.find(t=>titleKey(t)===titleKey(title))}`);
  else { blockers.push('title_mismatch'); add('title_mismatch', 0, `${title} ≠ ${meta.title}`); }
  const expected = String(work.artist || '').split(/\s*\/\s*/).filter(Boolean);
  const actual = (meta.artists || [meta.artist]).filter(Boolean);
  const artistExact = expected.length && actual.length && artistKey(expected.join('')) === artistKey(actual.join(''));
  const artistOverlap = expected.some(a => actual.some(b => artistKey(a) === artistKey(b)));
  if (artistExact) add('artist_exact', 25, actual.join(' / '));
  else if (artistOverlap) { add('artist_component_exact', 15, actual.join(' / ')); blockers.push('partial_artist'); }
  else if (work.category === 'song') blockers.push('artist_unconfirmed');
  if (work.year && meta.year) {
    if (Number(work.year) === Number(meta.year)) add('year_exact', 10, String(meta.year));
    else { add('year_mismatch', -20, `${work.year} ≠ ${meta.year}`); blockers.push('year_mismatch'); }
  } else blockers.push('year_unconfirmed');
  if (meta.category === work.category || (work.category === 'score' && meta.category === 'anime')) add('category_compatible', meta.category==='anime'?20:5, meta.category);
  else blockers.push('category_unconfirmed');
  if (meta.identity) add('explicit_identity', 40, meta.identity);
  if (meta.membership) add('recording_release_membership', 10, meta.membership);
  if (meta.provider === 'official-ogp' || meta.provider === 'page-ogp' || meta.provider === 'official-discography') {
    add('stored_source_page', 20, meta.source_url);
    blockers.push(meta.provider==='official-discography'?'discography_requires_review':'ogp_requires_review');
    if (!exact && titleKey(meta.title).includes(titleKey(title)) && titleKey(title).length >= 5) add('page_title_contains', 25, meta.title);
    if (meta.generic) blockers.push('generic_image');
  }
  if (work.id.startsWith('legacy-')) blockers.push('legacy_metadata');
  if (meta.provider === 'itunes') blockers.push('itunes_usage_review');
  if (!meta.identity && work.category === 'score') blockers.push('title_only_identity');
  if (meta.identity && (exact || normalized) && work.category !== 'song') {
    const i = blockers.indexOf('artist_unconfirmed'); if (i >= 0) blockers.splice(i, 1);
  }
  confidence = Math.max(0, Math.min(100, confidence));
  if (blockers.includes('title_mismatch') && !evidence.some(e => e.code === 'page_title_contains')) confidence = Math.min(confidence, 69);
  if (blockers.includes('generic_image') || blockers.includes('legacy_metadata') || blockers.includes('year_mismatch')) confidence = Math.min(confidence, 69);
  if (blockers.length) confidence = Math.min(confidence, 94);
  return { confidence, score: confidence, evidence, blockers, match_reason: evidence.map(e => e.code).join(', '), status: confidence >= 95 ? 'auto_eligible' : confidence >= 70 ? 'review' : 'hold' };
}
export function candidate(work, meta) {
  const src = httpsURL(meta.image);
  if (!src) return null;
  return { id: `${meta.provider}-${hash([meta.release_id, meta.source_url, src]).slice(0, 20)}`, work_id: work.id,
    title: meta.title || '', title_aliases: meta.aliases || [], artist: meta.artist || (meta.artists || []).join(' / '), year: meta.year || null,
    release_id: meta.release_id || `artwork-${work.id}-${hash(src).slice(0, 12)}`, release_title: meta.release_title || meta.title,
    provider: meta.provider, source_url: meta.source_url, ...evaluate(work, meta),
    artwork: { src, alt: `${titleFor(work)} 作品画像`, provider: meta.provider, source_url: meta.source_url, checked_at: new Date().toISOString().slice(0, 10) } };
}
export function finalize(suggestions) {
  const unique = [...new Map(suggestions.filter(Boolean).sort((a,b) => a.confidence-b.confidence).map(s => [s.artwork.src, s])).values()].sort((a,b) => b.confidence-a.confidence);
  const strong = unique.filter(s => s.confidence >= 90);
  if (new Set(strong.map(s => s.release_id)).size > 1) for (const s of strong) {
    s.blockers.push('competing_releases'); s.confidence = s.score = Math.min(s.confidence, 94); s.status = 'review';
  }
  return unique;
}

export function relevant(work,s) {
 if(!['itunes','anilist'].includes(s.provider)||!s.blockers.includes('title_mismatch')) return true;
 const a=titleKey(titleFor(work)),b=titleKey(s.title),album=titleKey(s.release_title);
 return Math.min(a.length,b.length)>=5&&(a.includes(b)||b.includes(a)) || a.length>=5&&album.includes(a);
}
