import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const RELEASES_FILE = path.join(ROOT, 'releases.json');

async function run() {
  const releases = JSON.parse(await fs.readFile(RELEASES_FILE, 'utf8'));
  if (!Array.isArray(releases)) throw new Error('releases.json is invalid');

  await fs.mkdir(path.join(ROOT, 'assets/covers'), { recursive: true });
  const next = [];

  for (const release of releases) {
    const src = String(release?.artwork?.src || '');
    const relId = String(release?.id || '');
    if (!src || !relId || !src.startsWith('http')) {
      next.push(release);
      continue;
    }

    const res = await fetch(src, { method: 'HEAD' });
    if (!res.ok) {
      console.warn(`Skip ${relId}: unavailable image (${res.status})`);
      next.push(release);
      continue;
    }

    const mime = String(res.headers.get('content-type') || '');
    if (!mime.startsWith('image/')) {
      console.warn(`Skip ${relId}: non-image response ${mime}`);
      next.push(release);
      continue;
    }

    const imageRes = await fetch(src);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const max = Number(process.env.MAX_BYTES || 0);
    if (max > 0 && buffer.length > max) {
      console.warn(`Skip ${relId}: too large ${buffer.length}`);
      next.push(release);
      continue;
    }

    const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const local = `assets/covers/${relId}${ext}`;
    await fs.writeFile(path.join(ROOT, local), buffer);

    next.push({
      ...release,
      artwork: {
        ...release.artwork,
        src: local,
      },
    });
    console.log(`Fetched ${relId} -> ${local}`);
  }

  await fs.writeFile(RELEASES_FILE, `${JSON.stringify(next, null, 2)}\n`);
}

run().catch((e) => {
  console.error(e?.message || e);
  process.exitCode = 1;
});
