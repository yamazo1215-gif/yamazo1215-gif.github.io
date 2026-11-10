const buttons = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.work-card')];
const count = document.querySelector('.result-count');
const more = document.querySelector('.show-more');
const search = document.querySelector('#works-search');
const year = document.querySelector('#works-year');
const empty = document.querySelector('.works-empty');
const pageSize = 24;
let active = 'all';
let visibleLimit = pageSize;
const normalize = value => value.normalize('NFKC').toLocaleLowerCase().trim();
const roleMatch = { compose: /(^|\b)compose|作曲|作編曲/i, arrange: /(^|\b)arrange|編曲|作編曲/i, guitar: /guitar|ギター/i };
function matches(card) {
  const categoryMatches = active === 'all' || (['score', 'soundtrack', 'song'].includes(active) ? card.dataset.category === active : roleMatch[active]?.test(card.dataset.roles || ''));
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  return categoryMatches && (year.value === 'all' || card.dataset.year === year.value) && terms.every(term => normalize(card.dataset.search || '').includes(term));
}
function render() {
  const matched = cards.filter(matches);
  const visible = new Set(matched.slice(0, visibleLimit));
  cards.forEach(card => { card.hidden = !visible.has(card); });
  count.textContent = `${matched.length} / ${cards.length} credits`;
  empty.hidden = matched.length > 0;
  const remaining = matched.length - visible.size;
  more.hidden = remaining <= 0;
  more.textContent = `さらに${Math.min(pageSize, remaining)}件表示（残り${remaining}件）`;
}
function reset() { visibleLimit = pageSize; render(); }
buttons.forEach(button => button.addEventListener('click', () => {
  active = button.dataset.filter;
  buttons.forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  reset();
}));
search.addEventListener('input', reset);
year.addEventListener('change', reset);
more.addEventListener('click', () => { visibleLimit += pageSize; render(); });
render();

// A failed external image must not leave a broken icon or an empty column.
document.querySelectorAll('.work-card-image, .featured-image').forEach((img) => {
  const hideUnavailable = () => {
    img.parentElement.hidden = true;
    const card = img.closest('article');
    card.classList.remove('has-image');
    card.classList.add('image-unavailable');
  };
  img.addEventListener('error', hideUnavailable, { once: true });
  if (img.complete && img.naturalWidth === 0) hideUnavailable();
});
