import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('representative video stays compact with a responsive 16:9 player',()=>{
 const css=fs.readFileSync('styles.css','utf8');
 assert.match(css,/\.hero-video \{ width: min\(100%, 360px\)/);
 assert.match(css,/\.hero-video \{ width: min\(100%, 300px\)/);
 assert.match(css,/\.hero-video iframe \{ width: 100%; height: auto; aspect-ratio: 16 \/ 9/);
 assert.match(css,/\.hero \{ min-height: 440px; gap: 3rem; padding-block: 3rem/);
 assert.match(css,/\.hero-video > a \{[^}]*min-height: 44px/);
});
test('embedded video identity, fullscreen and direct YouTube link remain intact',()=>{
 const html=fs.readFileSync('template.html','utf8');
 assert.match(html,/iframe src="https:\/\/www.youtube-nocookie.com\/embed\/CibszwinJwQ"[^>]*allowfullscreen/);
 assert.match(html,/href="https:\/\/www.youtube.com\/watch\?v=CibszwinJwQ"/);
});
