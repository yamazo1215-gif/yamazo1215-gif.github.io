import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from './artwork/http.mjs';
import { localAnime, animeSearch, musicbrainz, itunes, officialPages, amazonAssist } from './artwork/providers.mjs';
import { hasArtwork, fingerprint, titleFor, finalize, relevant } from './artwork/matching.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export async function resolve(
  root = ROOT,
  {
    offline = false,
    cacheOnly = false,
    refresh = false,
    workIds = [],
    limit = Infinity,
    client = new Client(path.join(root, '.artwork-cache'), { offline: offline || cacheOnly, refresh }),
  } = {},
) {
  const read = async name => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
  const [works, releases, anime, music] = await Promise.all(
    ['yamazo_works_master.json', 'releases.json', 'anilist.json', 'musicbrainz.json'].map(read),
  );

  for (const id of workIds) {
    if (!works.some(w => w.id === id)) throw Error(`Unknown work: ${id}`);
  }

  const previous = await read('artwork_candidates.json').catch(e => {
    if (e.code === 'ENOENT') return { items: [] };
    throw e;
  });
  const progress = await read('artwork_candidates.progress.json').catch(e => {
    if (e.code === 'ENOENT') return { items: [] };
    throw e;
  });

  const items = new Map(
    [...(previous.items || []), ...(progress.items || [])]
      .filter(
        i =>
          works.some(w => w.id === i.work_id && !hasArtwork(w, releases) && fingerprint(w) === i.work_fingerprint),
      )
      .map(i => [i.work_id, i]),
  );

  let processed = 0;
  const skipped = works.filter(w => hasArtwork(w, releases) && !workIds.includes(w.id)).length;
  const pending = works.filter(
    w =>
      (!workIds.length || workIds.includes(w.id)) &&
      (!hasArtwork(w, releases) || workIds.includes(w.id)),
  ).slice(0, limit);

  const progressFile = path.join(root, 'artwork_candidates.progress.json');
  let save = Promise.resolve();

  async function processWork(work) {
    const suggestions = localAnime(work, anime);
    const errors = [];
    const amazonCandidates = [];

    const run = async (label, fn) => {
      try {
        const raw = await fn();
        const row = Array.isArray(raw)
          ? { suggestions: raw, errors: [], amazon_candidates: [], hints: [] }
          : {
              suggestions: Array.isArray(raw?.suggestions) ? raw.suggestions : [],
              errors: Array.isArray(raw?.errors) ? raw.errors : [],
              amazon_candidates: Array.isArray(raw?.amazon_candidates)
                ? raw.amazon_candidates
                : [],
              hints: Array.isArray(raw?.hints) ? raw.hints : [],
            };

        if (row.suggestions.length) suggestions.push(...row.suggestions.filter(Boolean));
        if (row.amazon_candidates.length) amazonCandidates.push(...row.amazon_candidates);
        if (row.errors.length) {
          errors.push(...row.errors.map((error) => ({ provider: label, error })));
        }

        return row;
      } catch (e) {
        errors.push({ provider: label, error: e.message });
        return { suggestions: [], errors: [e.message], amazon_candidates: [], hints: [] };
      }
    };

    if (!offline) {
      if (!suggestions.filter(Boolean).length) await run('anilist', () => animeSearch(work, client));
      const amazon = await run('amazon', () => amazonAssist(work, client));
      await run('musicbrainz', () => musicbrainz(work, music, client, amazon.hints));
      if (!suggestions.some(s => s?.confidence >= 95)) await run('itunes', () => itunes(work, client));
      await run('page-ogp', () => officialPages(work, client));
    }

    const old = items.get(work.id);
    const priorAmazon = old?.amazon_candidates || [];
    const mergedAmazon = [...new Map(
      [...priorAmazon, ...amazonCandidates].map((item) => [
        item.asin || item.source_url || item.title,
        item,
      ]),
    ).values()];

    const merged = finalize([
      ...suggestions,
      ...(errors.length || offline
        ? (old?.suggestions || []).map((s) => ({
            ...s,
            confidence: Math.min(s.confidence, 94),
            score: Math.min(s.confidence, 94),
            status: s.confidence >= 70 ? 'review' : 'hold',
            blockers: [...new Set([...s.blockers, 'retained_previous_candidate'])],
          }))
        : []),
    ].filter(s => s && relevant(work, s)));

    items.set(work.id, {
      work_id: work.id,
      work_fingerprint: fingerprint(work),
      category: work.category,
      title: titleFor(work),
      artist: work.artist,
      year: work.year,
      source_url: work.official_url || work.source_url,
      checked_at: new Date().toISOString(),
      errors,
      suggestions: merged,
      amazon_candidates: mergedAmazon,
    });

    processed += 1;
    console.log(`[${processed}] ${work.id}: ${merged.length} candidates, ${errors.length} errors`);

    const snapshot = JSON.stringify(
      { schema_version: 2, incomplete: true, items: [...items.values()] },
      null,
      2,
    ) + '\n';
    save = save.then(async () => {
      await fs.writeFile(progressFile + '.tmp', snapshot);
      await fs.rename(progressFile + '.tmp', progressFile);
    });
    await save;
  }

  async function worker() {
    while (pending.length) {
      await processWork(pending.shift());
    }
  }

  await Promise.all([worker(), worker(), worker()]);

  // A shared OGP across unrelated pages is not independent evidence of work identity.
  const ogps = new Map();
  for (const row of items.values()) {
    for (const s of row.suggestions) {
      if (s.provider === 'page-ogp') {
        const pages = ogps.get(s.artwork.src) || new Set();
        pages.add(s.source_url);
        ogps.set(s.artwork.src, pages);
      }
    }
  }
  for (const row of items.values()) {
    for (const s of row.suggestions) {
      if (s.provider === 'page-ogp' && ogps.get(s.artwork.src)?.size > 1) {
        s.blockers = [...new Set([...s.blockers, 'shared_ogp'])];
        s.confidence = s.score = Math.min(s.confidence, 69);
        s.status = 'hold';
      }
    }
  }

  const all = [...items.values()];
  const summary = {
    total_works: works.length,
    already_illustrated: works.filter(w => hasArtwork(w, releases)).length,
    processed,
    skipped,
    with_candidates: all.filter(i => i.suggestions.length).length,
    auto_eligible: all.filter(i => i.suggestions.some(s => s.status === 'auto_eligible')).length,
    review: all.filter(i =>
      !i.suggestions.some(s => s.status === 'auto_eligible') && i.suggestions.some(s => s.status === 'review'),
    ).length,
    hold_only: all.filter(i => i.suggestions.length && i.suggestions.every(s => s.status === 'hold')).length,
    with_amazon_candidates: all.filter(i => i.amazon_candidates?.length).length,
    without_candidates: all.filter(i => !i.suggestions.length).length,
    errors: all.reduce((n, i) => n + i.errors.length, 0),
  };

  const output = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    count: all.filter(i => i.suggestions.length).length,
    summary,
    items: all,
  };

  const file = path.join(root, 'artwork_candidates.json');
  await fs.writeFile(file + '.tmp', JSON.stringify(output, null, 2) + '\n');
  await fs.rename(file + '.tmp', file);
  await fs.rm(progressFile, { force: true });
  console.log(JSON.stringify(summary, null, 2));
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = { workIds: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cached') options.cacheOnly = true;
    else if (args[i] === '--offline') options.offline = true;
    else if (args[i] === '--refresh') options.refresh = true;
    else if (args[i] === '--work' && args[i + 1]) options.workIds.push(args[++i]);
    else if (args[i] === '--limit' && /^\d+$/.test(args[i + 1])) options.limit = Number(args[++i]);
    else throw Error(`Unknown/incomplete argument: ${args[i]}`);
  }
  resolve(ROOT, options).catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
}
