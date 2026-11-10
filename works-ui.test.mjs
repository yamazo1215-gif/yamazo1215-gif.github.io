import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
function setup() {
  const el = (dataset = {}) => ({ dataset, value: '', hidden: false, textContent: '', listeners: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener(event, fn) { this.listeners[event] = fn; } });
  const cards = Array.from({length:60}, (_,i) => el({category:i%2 ? 'score' : 'song',roles:i%2 ? '作曲' : '編曲',year:i<30 ? '2026':'2024',search:i===0 ? '透明スタートライン E♡Star 稲葉エミ' : i===30 ? '夏が来たから ≠ME 指原莉乃' : `作品 ${i}`}));
  const buttons = ['all','song','score','arrange','compose','guitar'].map(filter=>el({filter}));
  const count=el(), more=el(), search=el(), year=el(), empty=el();year.value='all';
  const selectors={'.result-count':count,'.show-more':more,'#works-search':search,'#works-year':year,'.works-empty':empty};
  vm.runInNewContext(source,{document:{querySelector:s=>selectors[s],querySelectorAll:s=>s==='[data-filter]'?buttons:s==='.work-card'?cards:[]}});
  return {cards,buttons,count,more,search,year,empty,visible:()=>cards.filter(c=>!c.hidden)};
}
test('archive starts with 24, reveals 24 more, and stops at total',()=>{const s=setup();assert.equal(s.visible().length,24);s.more.listeners.click();assert.equal(s.visible().length,48);s.more.listeners.click();assert.equal(s.visible().length,60);assert.equal(s.more.hidden,true);});
test('search covers all credits, supports full-width text, and has empty state',()=>{const s=setup();s.search.value='夏が来たから';s.search.listeners.input();assert.equal(s.visible().length,1);assert.match(s.visible()[0].dataset.search,/≠ME/);s.search.value='Ｅ♡Ｓｔａｒ';s.search.listeners.input();assert.equal(s.visible().length,1);s.search.value='not-present';s.search.listeners.input();assert.equal(s.visible().length,0);assert.equal(s.empty.hidden,false);s.search.value='';s.search.listeners.input();assert.equal(s.visible().length,24);});
test('year, role and search filters combine and reset pagination',()=>{const s=setup();s.more.listeners.click();s.year.value='2024';s.year.listeners.change();assert.equal(s.visible().length,24);s.buttons.find(b=>b.dataset.filter==='arrange').listeners.click();assert.equal(s.visible().length,15);s.search.value='夏が来たから';s.search.listeners.input();assert.equal(s.visible().length,1);s.buttons.find(b=>b.dataset.filter==='score').listeners.click();assert.equal(s.visible().length,0);});
