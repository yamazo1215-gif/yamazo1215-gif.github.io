import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CANDIDATES_FILE = path.join(ROOT, 'artwork_candidates.json');
const CATALOG_FILE = path.join(ROOT, 'releases.json');
const WORKS_FILE = path.join(ROOT, 'yamazo_works_master.json');

const safe = (name) => String(name ?? '').trim();

async function readJSON(file, fallback = null) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

async function run() {
  const [, , selectionPath] = process.argv;
  if (!selectionPath) {
    throw new Error('Usage: node approve-artwork.mjs artwork_decisions.json');
  }

  const decisions = await readJSON(path.join(ROOT, selectionPath));
  const candidates = await readJSON(CANDIDATES_FILE, { items: [] });
  const catalog = await readJSON(CATALOG_FILE, []);
  const works = await readJSON(WORKS_FILE);

  if (!Array.isArray(decisions)) {
    throw new Error('artwork_decisions.json should be an array of {work_id,decision,release_id}.');
  }

  const decisionMap = new Map(
    decisions
      .filter((item) => item?.work_id)
      .map((item) => [safe(item.work_id), item]),
  );

  const candidateMap = new Map((candidates?.items || []).map((item) => [safe(item.work_id), item]));
  const catalogMap = new Map(catalog.map((r) => [safe(r.id), r]));

  let updated = 0;
  const nextCatalog = [...catalog];

  const nextWorks = works.map((work) => {
    const decision = decisionMap.get(safe(work.id));
    if (!decision || decision.decision !== 'accept') return work;

    const item = candidateMap.get(safe(work.id));
    const suggestion = (item?.suggestions || []).find((s) => safe(s.id) === safe(decision.suggestion_id));
    if (!suggestion) {
      console.warn(`No matching suggestion: ${safe(work.id)} (${safe(decision.suggestion_id)})`);
      return work;
    }

    const releaseId = safe(suggestion.release_id || `release-${work.id}`);
    const artwork = {
      src: safe(suggestion.artwork?.src),
      alt: safe(suggestion.artwork?.alt || `${safe(work.track_title || work.work_title)} ジャケット`),
      provider: safe(suggestion.artwork?.provider),
      source_url: safe(suggestion.artwork?.source_url),
      checked_at: safe(suggestion.artwork?.checked_at || new Date().toISOString().slice(0, 10)),
    };

    if (!catalogMap.has(releaseId)) {
      nextCatalog.push({
        id: releaseId,
        release_title: safe(item.title),
        release_type: safe(item.category),
        release_date: safe(item.year ? String(item.year) : ''),
        artwork,
      });
      catalogMap.set(releaseId, nextCatalog.at(-1));
    }

    updated += 1;
    return { ...work, release_id: releaseId };
  });

  await fs.writeFile(WORKS_FILE, `${JSON.stringify(nextWorks, null, 2)}\n`);
  await fs.writeFile(CATALOG_FILE, `${JSON.stringify(nextCatalog, null, 2)}\n`);
  console.log(`Applied artwork approval to ${updated} works`);
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
