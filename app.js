const buttons = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.work-card')];
const count = document.querySelector('.result-count');
const more = document.querySelector('.show-more');
let active = 'all';
let expanded = false;
const roleMatch = {
  compose: /(^|\b)compose|作曲|作編曲/i,
  arrange: /(^|\b)arrange|編曲|作編曲/i,
  guitar: /guitar|ギター/i,
};
function matches(card) {
  if (active === 'all') return true;
  if (active === 'score' || active === 'song') return card.dataset.category === active;
  return roleMatch[active]?.test(card.dataset.roles || '');
}
function render() {
  const matched = cards.filter(matches);
  cards.forEach((card) => { card.hidden = !matches(card) || (!expanded && matched.indexOf(card) >= 12); });
  count.textContent = `${matched.length} credits`;
  if (more) {
    more.hidden = matched.length <= 12;
    more.textContent = expanded ? '表示を戻す' : `もっと見る（残り${Math.max(0, matched.length - 12)}件）`;
  }
}
buttons.forEach((button) => button.addEventListener('click', () => {
  active = button.dataset.filter;
  expanded = false;
  buttons.forEach((item) => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  render();
}));
more?.addEventListener('click', () => { expanded = !expanded; render(); });
render();
