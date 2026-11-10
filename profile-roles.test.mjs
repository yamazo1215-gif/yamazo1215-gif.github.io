import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('multi-instrumentalist is added consistently without dropping existing roles',()=>{
 const html=fs.readFileSync('template.html','utf8');
 const role='Composer / Arranger / Guitarist / Multi-instrumentalist';
 assert.ok(html.includes(`<title>yamazo（山田知広）— ${role}</title>`));
 assert.ok(html.includes(`<p class="hero-role">${role}</p>`));
 assert.ok(html.includes(`<p class="about-role">${role}</p>`));
 assert.ok(html.includes(role.toUpperCase()));
 assert.match(html,/<meta name="description" content="作曲家・編曲家・ギタリスト・マルチインストゥルメンタリスト yamazo/);
 assert.match(html,/<meta name="keywords"[^>]*Multi-instrumentalist,マルチインストゥルメンタリスト/);
});
