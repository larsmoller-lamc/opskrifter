// ---------- State ----------
let recipes = [];
let activeFilter = 'alle';
let searchQuery = '';

// ---------- Init ----------
async function init() {
  try {
    const res = await fetch('recipes.json?_=' + Date.now());
    if (!res.ok) throw new Error('Kunne ikke hente recipes.json (' + res.status + ')');
    recipes = await res.json();
    recipes.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
    render();
    bindFilters();
    bindSearch();
    bindOverlay();
    handleInitialHash();
  } catch (err) {
    document.getElementById('recipe-list').innerHTML =
      '<div class="error">Kunne ikke indlæse opskrifter.<br>' + err.message + '</div>';
    document.getElementById('count').textContent = '';
  }
}

// ---------- Rendering ----------
function render() {
  const list = document.getElementById('recipe-list');
  const empty = document.getElementById('empty');
  const filtered = filterRecipes();

  document.getElementById('count').textContent =
    recipes.length + (recipes.length === 1 ? ' opskrift' : ' opskrifter');

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = filtered.map(r => `
    <button class="recipe-card" data-id="${escapeAttr(r.id)}">
      <div class="recipe-thumb">
        ${r.billede
          ? `<img src="${escapeAttr(r.billede)}" alt="" onerror="this.remove()">`
          : initials(r.navn)}
      </div>
      <div class="recipe-info">
        <div class="recipe-name">${escapeHtml(r.navn)}</div>
        <div class="recipe-meta">
          ${r.portioner ? r.portioner + ' personer · ' : ''}${escapeHtml(r.kilde || 'Ukendt kilde')}
        </div>
      </div>
      <span class="heart ${r.favorit ? 'heart-on' : 'heart-off'}">${r.favorit ? '♥' : '♡'}</span>
    </button>
  `).join('');

  list.querySelectorAll('.recipe-card').forEach(btn => {
    btn.addEventListener('click', () => openRecipe(btn.dataset.id));
  });
}

function filterRecipes() {
  return recipes.filter(r => {
    // Tag filter
    if (activeFilter === 'favorit') {
      if (!r.favorit) return false;
    } else if (activeFilter !== 'alle') {
      if (!Array.isArray(r.tags) || !r.tags.includes(activeFilter)) return false;
    }
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = [
        r.navn,
        r.kilde,
        ...(Array.isArray(r.ingredienser) ? r.ingredienser.map(i => i.navn) : []),
        ...(Array.isArray(r.tags) ? r.tags : [])
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- Filter chips ----------
function bindFilters() {
  document.querySelectorAll('#filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filters .chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      activeFilter = chip.dataset.filter;
      render();
    });
  });
}

// ---------- Search ----------
function bindSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    searchQuery = input.value.trim();
    render();
  });
}

// ---------- Detail overlay ----------
function bindOverlay() {
  document.getElementById('back-btn').addEventListener('click', closeRecipe);
  window.addEventListener('popstate', () => {
    if (!location.hash) closeRecipe(false);
    else handleInitialHash();
  });
}

function handleInitialHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash) openRecipe(hash, false);
}

function openRecipe(id, pushState = true) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const detail = document.getElementById('recipe-detail');
  detail.innerHTML = renderDetail(r);
  document.getElementById('overlay').hidden = false;
  document.getElementById('overlay').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  if (pushState) history.pushState({ id }, '', '#/' + id);
}

function closeRecipe(popHistory = true) {
  document.getElementById('overlay').hidden = true;
  document.body.style.overflow = '';
  if (popHistory && location.hash) history.pushState({}, '', location.pathname);
}

function renderDetail(r) {
  const ingredienser = renderIngredients(r.ingredienser || []);

  const steps = (r.fremgangsmåde || []).map(s => {
    const text = String(s || '');
    // Detekter overskrift: **tekst**
    const headingMatch = text.match(/^\*\*(.+?)\*\*\s*$/);
    if (headingMatch) {
      return `<li class="step-heading">${escapeHtml(headingMatch[1])}</li>`;
    }
    return `<li>${escapeHtml(text)}</li>`;
  }).join('');

  const tags = (r.tags || []).map(t =>
    `<span class="badge">${escapeHtml(capitalize(t))}</span>`
  ).join('');

  const favBadge = r.favorit ? '<span class="badge badge-fav">♥ Favorit</span>' : '';

  const kildeLink = r.kilde_url
    ? `<a href="${escapeAttr(r.kilde_url)}" target="_blank" rel="noopener">${escapeHtml(r.kilde || 'Kilde')}</a>`
    : escapeHtml(r.kilde || '');

  const image = r.billede
    ? `<img src="${escapeAttr(r.billede)}" alt="" class="detail-image" onerror="this.remove()">`
    : '';

  const notes = r.noter
    ? `<div class="detail-section"><h2>Noter</h2><div class="notes">${escapeHtml(r.noter)}</div></div>`
    : '';

  return `
    <div class="detail-header">
      <h1 class="detail-name">${escapeHtml(r.navn)}</h1>
      <div class="detail-source">${kildeLink}</div>
      <div class="detail-badges">${favBadge}${tags}</div>
    </div>
    ${image}
    <div class="detail-section">
      <h2>Ingredienser<span class="portioner">${r.portioner ? 'til ' + r.portioner + ' personer' : ''}</span></h2>
      <ul class="ingredients">${ingredienser}</ul>
    </div>
    <div class="detail-section">
      <h2>Fremgangsmåde</h2>
      <ol class="steps">${steps}</ol>
    </div>
    ${notes}
  `;
}

// ---------- Helpers ----------
function renderIngredients(list) {
  // Grupper efter sektion (parentes bagerst i navnet).
  // Ingredienser uden parentes tilhører hoveddelen (sektion 1) og vises uden overskrift.
  // Efterfølgende ingredienser med parentes grupperes under en overskrift.
  const groups = [];
  let currentGroup = { heading: null, items: [] };
  groups.push(currentGroup);

  list.forEach(ing => {
    const navn = String(ing.navn || '');
    // Detekter afsluttende parentes: "æggeblommer (Vaniljecreme)"
    const match = navn.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (match) {
      const cleanName = match[1].trim();
      const sectionName = match[2].trim();
      // Er dette en NY sektion (forskellig fra sidste)?
      if (currentGroup.heading !== sectionName) {
        currentGroup = { heading: sectionName, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push({ ...ing, navn: cleanName });
    } else {
      // Ingen parentes → hoveddel. Hvis vi er i en sektion allerede, start en ny "hoveddel"-gruppe.
      if (currentGroup.heading !== null) {
        currentGroup = { heading: null, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(ing);
    }
  });

  // Render grupperne
  return groups
    .filter(g => g.items.length > 0)
    .map(g => {
      const headingHtml = g.heading
        ? `<li class="ing-heading">${escapeHtml(g.heading)}</li>`
        : '';
      const itemsHtml = g.items.map(i => {
        const amount = formatAmount(i);
        return `<li>
          <span class="ing-amount ${amount ? '' : 'ing-amount-empty'}">${amount || '—'}</span>
          <span class="ing-name">${escapeHtml(i.navn || '')}</span>
        </li>`;
      }).join('');
      return headingHtml + itemsHtml;
    })
    .join('');
}

function formatAmount(ing) {
  const m = ing.mængde;
  const e = ing.enhed;
  if (m == null && !e) return '';
  const num = m == null ? '' : formatNumber(m);
  if (!e) return num;
  if (!num) return e;
  return num + ' ' + e;
}

function formatNumber(n) {
  if (typeof n !== 'number') return String(n);
  // Vis pænt: 1, 1.5, 0.25 - undgå trailing zeros
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

// ---------- Boot ----------
init();
