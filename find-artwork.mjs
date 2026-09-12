import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const WORKS_FILE = path.join(ROOT, 'yamazo_works_master.json');
const RELEASES_FILE = path.join(ROOT, 'releases.json');
const ANILIST_FILE = path.join(ROOT, 'anilist.json');
const CANDIDATES_FILE = path.join(ROOT, 'artwork_candidates.json');

const loadJSON = async (file, fallback = null) => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
};

const releaseGroupId = (url = '') => {
  const matched = String(url || '').match(/musicbrainz\.org\/(?:release-group|release)\/([0-9a-fA-F-]{36})/);
  return matched?.[1] || '';
};

const safe = (v) => String(v ?? '').trim();

async function fetchCoverArtArchive(releaseGroupId) {
  const endpoint = `https://coverartarchive.org/release-group/${releaseGroupId}`;
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } }).catch(() => null);
  if (!response || !response.ok) return null;
  const json = await response.json().catch(() => null);
  if (!json || !Array.isArray(json.images)) return null;
  const front = json.images.find((i) => i.front === true) || json.images[0];
  if (!front) return null;
  const src = front.thumbnails?.['500x500'] || front.image;
  if (!src) return null;
  return {
    src,
    width: 500,
    height: 500,
    provider: 'cover-art-archive',
    source_url: endpoint,
    checked_at: new Date().toISOString().slice(0, 10),
  };
}

function scoreMatch(a) {
  let score = 0;
  if (a.source === 'anilist-id') score += 80;
  if (a.source === 'musicbrainz-release-group') score += 70;
  if (a.verified) score += 10;
  return score;
}

async function buildCandidates() {
  const works = await loadJSON(WORKS_FILE);
  const releases = await loadJSON(RELEASES_FILE, []);
  const anilist = await loadJSON(ANILIST_FILE, []);
  const releaseMap = new Map(releases.filter((r) => r?.id).map((r) => [r.id, r]));
  const anilistMap = new Map(anilist.filter((r) => r?.id).map((r) => [r.id, r]));

  const rows = [];

  for (const work of works) {
    const hasLocalImage = Boolean(safe(work.image));
    const hasReleaseImage = Boolean(work.release_id && releaseMap.has(work.release_id) && safe(releaseMap.get(work.release_id)?.artwork?.src));
    if (hasLocalImage || hasReleaseImage) continue;

    const suggestions = [];
    const title = safe(work.track_title || work.work_title);
    const artist = safe(work.artist);
    if (!title) continue;

    const anilistMatch = anilistMap.get(safe(work.id));
    if (anilistMatch?.image && safe(anilistMatch.image)) {
      suggestions.push({
        id: `anilist-${safe(work.id)}`,
        release_id: `release-${safe(anilistMatch.anilistId || '')}`,
        artwork: {
          src: anilistMatch.image,
          alt: `${title} ジャケット`,
          provider: 'anilist',
          source_url: safe(anilistMatch.url),
          checked_at: new Date().toISOString().slice(0, 10),
        },
        source: 'anilist-id',
        reason: 'AniList id一致',
        verified: false,
      });
    }

    const mbReleaseGroup = releaseGroupId(safe(work.official_url)) || releaseGroupId(safe(work.source_url));
    if (mbReleaseGroup) {
      const art = await fetchCoverArtArchive(mbReleaseGroup);
      if (art) {
        suggestions.push({
          id: `mb-${mbReleaseGroup}`,
          artwork: {
            src: art.src,
            alt: `${title} ジャケット`,
            provider: art.provider,
            source_url: art.source_url,
            checked_at: art.checked_at,
          },
          source: 'musicbrainz-release-group',
          reason: 'MusicBrainz Cover Art Archive',
          verified: false,
        });
      }
    }

    const unique = [];
    const seen = new Set();
    for (const candidate of suggestions) {
      if (seen.has(candidate.artwork.src)) continue;
      seen.add(candidate.artwork.src);
      unique.push({
        ...candidate,
        score: scoreMatch(candidate),
        title,
        artist,
        year: work.year,
      });
    }

    if (!unique.length) continue;
    unique.sort((a, b) => b.score - a.score);

    rows.push({
      work_id: work.id,
      category: work.category,
      title,
      artist,
      year: work.year || null,
      release_id: work.release_id || null,
      source_url: safe(work.official_url || work.source_url),
      suggestions: unique,
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    count: rows.length,
    items: rows,
  };
  await fs.writeFile(CANDIDATES_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Generated ${rows.length} artwork candidate items`);
}

buildCandidates().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
