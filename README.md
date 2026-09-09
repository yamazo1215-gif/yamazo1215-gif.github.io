# yamazo official website

Single-page, static HTML/CSS. One featured YouTube video, four latest works, 46 initial Works. Displayed anime role: 劇伴音楽. No client JavaScript or npm dependencies.

## Build

Node 22+: `node --test sync-anilist.test.mjs`, then `node build.mjs`. Output: `dist/`.
Run `node sync-anilist.mjs` to fetch new Music credits from AniList staff 149067.

## Data

- `legacy.json`: all 27 records recovered from https://www.yamazo.jp/works on 2026-09-09. Two anime records are merged into the animation section; 25 legacy records display separately. Unknown release years are not invented.
- `anilist.json`: 16 anime seeds, with sources per record. AniList API was temporarily unavailable (HTTP 403) at setup; complete API import is pending service recovery. Room Mate and ETERNAL LOVE have direct AniList musicBy credits. Other initial credits use https://www.anisil.com/people/17149-yamazo and AniList metadata. No agency site is used as a source.
- `overrides.json`: permanent display corrections and excluded IDs. Update this file for corrections; it is not overwritten by runtime snapshots.
- `sync-status.json`: latest successful import and changes. Current initial value records the setup outage.
- Anime images remain with their owners. The Haikara image comes from https://boueibu.com/hc/news/article007.html (©馬谷くらり／黒玉寮). Other images use AniList URLs. External image availability is controlled by providers.

## Automation

The Pages workflow runs Mondays at 06:17 JST and on manual request. Only exact Music credits are imported. It validates the fixed staff identity, follows pagination, retries temporary errors, detects changes, merges duplicates and keeps historical credits that disappear from the source. Failed imports do not replace the live site.

The build job has contents:read and actions:read. It preserves updates as the artifact `yamazo-works-snapshot` for 90 days, rather than committing to the repository. Only the deployment job gets pages:write and id-token:write. No private tokens are stored in this project.

GitHub disables schedules in public repositories after 60 days without repository activity. Re-enable in Actions when needed; truly indefinite unattended scheduling requires an additional scheduler. If snapshots expire following a prolonged outage, source seeds remain but later missing credits may require restoration from a downloaded snapshot.

## Publish

Repository: `yamazo1215-gif/yamazo1215-gif.github.io`.
Settings → Pages → Source: GitHub Actions.
Initial push publishes saved Works even while AniList is unavailable. Subsequent scheduled/manual runs attempt a fresh import.
See PUBLISH-JA.md for independent-domain setup. Production DNS cutover is not yet complete.

Additional alias seeds: One Room seasons 2/3, RobiHachi, Shounen Maid and Million Doll, credited as 山田知広 / Tomohiro Yamada, verified against anime official/production/distribution pages. Existing One Room and Room Mate are not duplicated.
