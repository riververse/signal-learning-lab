(function (root) {
 'use strict';
 function normalize(value) { return String(value || '').trim().toLocaleLowerCase(); }
 function matches(item, category, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return (category === 'all' || item.category === category) && words.every(word => normalize(item.text).includes(word));
 }
 if (typeof module === 'object' && module.exports) module.exports = {matches, normalize};
 if (!root.document) return;
 const document = root.document;
 const toolbar = document.getElementById('exploration-toolbar');
 const search = document.getElementById('exploration-search');
 const count = document.getElementById('exploration-count');
 const empty = document.getElementById('exploration-empty');
 const cards = Array.from(document.querySelectorAll('.project-card'));
 const buttons = Array.from(document.querySelectorAll('[data-category-filter]'));
 const categories = buttons.map(button => button.dataset.categoryFilter);
 if (!toolbar || !search || !count || !empty) return;
 let category = 'all';
 function render(updateUrl) {
  let visible = 0;
  cards.forEach(card => {
   const match = matches({category:card.dataset.category,text:card.textContent},category,search.value);
   card.hidden = !match;
   if (match) visible += 1;
  });
  buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.categoryFilter === category)));
  count.textContent = '显示 ' + visible + ' / ' + cards.length + ' 个学习方向';
  empty.hidden = visible !== 0;
  if (updateUrl) {
   const url = new URL(root.location.href);
   if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category',category);
   if (search.value.trim()) url.searchParams.set('q',search.value.trim()); else url.searchParams.delete('q');
   // A filter edit is one view state, not a new navigation entry per keystroke.
   root.history.replaceState(null,'',url.pathname + url.search + url.hash);
  }
 }
 function fromUrl() {
  const params = new URLSearchParams(root.location.search);
  category = categories.includes(params.get('category')) ? params.get('category') : 'all';
  search.value = (params.get('q') || '').slice(0,120);
  render(false);
 }
 buttons.forEach(button => button.addEventListener('click',() => {category=button.dataset.categoryFilter;render(true);}));
 search.addEventListener('input',() => render(true));
 document.getElementById('exploration-reset').addEventListener('click',() => {category='all';search.value='';render(true);search.focus();});
 root.addEventListener('popstate',fromUrl);
 toolbar.hidden = false;
 fromUrl();
})(typeof window !== 'undefined' ? window : globalThis);
