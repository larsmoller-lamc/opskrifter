// ============================================================
// Opskrifter — Firestore-backed
// ============================================================

// ---------- Firebase init ----------
firebase.initializeApp(window.firebaseConfig);
const db = firebase.firestore();
const recipesCol = db.collection('recipes');

// ---------- State ----------
let recipes = [];
let activeFilter = 'alle';
let searchQuery = '';
let currentDetailId = null;
let editingId = null; // hvis sat: vi er i edit-mode i modal
let spinFilter = 'alle';
let currentSpinRecipe = null;

// ---------- Init ----------
async function init() {
  bindFilters();
  bindSearch();
  bindOverlay();
  bindAddModal();
  bindSpinModal();

  try {
    // Realtime subscription: opskrifter synkroniseres på tværs af enheder
    recipesCol.onSnapshot(
      (snapshot) => {
        recipes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        recipes.sort((a, b) => (a.navn || '').localeCompare(b.navn || '', 'da'));
        render();
        // Hvis detail-view er åben, opdatér det (fx efter edit)
        if (currentDetailId) {
          const r = recipes.find(x => x.id === currentDetailId);
          if (r) {
            document.getElementById('recipe-detail').innerHTML = renderDetail(r);
          }
        }
        handleInitialHash();
      },
      (err) => {
        showLoadError(err.message);
      }
    );
  } catch (err) {
    showLoadError(err.message);
  }
}

function showLoadError(msg) {
  document.getElementById('recipe-list').innerHTML =
    '<div class="error">Kunne ikke indlæse opskrifter fra Firestore.<br>' + escapeHtml(msg) + '</div>';
  document.getElementById('count').textContent = '';
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
    if (activeFilter === 'favorit') {
      if (!r.favorit) return false;
    } else if (activeFilter !== 'alle') {
      if (!Array.isArray(r.tags) || !r.tags.includes(activeFilter)) return false;
    }
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
  document.getElementById('edit-btn').addEventListener('click', () => {
    if (!currentDetailId) return;
    const r = recipes.find(x => x.id === currentDetailId);
    if (!r) return;
    openAddModal(r);
  });
  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!currentDetailId) return;
    const r = recipes.find(x => x.id === currentDetailId);
    if (!r) return;
    if (!confirm(`Slet "${r.navn}"?\n\nDette kan ikke fortrydes.`)) return;
    try {
      await recipesCol.doc(currentDetailId).delete();
      closeRecipe();
    } catch (err) {
      alert('Kunne ikke slette: ' + err.message);
    }
  });

  window.addEventListener('popstate', () => {
    if (!location.hash) closeRecipe(false);
    else handleInitialHash();
  });
}

function handleInitialHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash && !currentDetailId) openRecipe(hash, false);
}

function openRecipe(id, pushState = true) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  currentDetailId = id;
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
  currentDetailId = null;
  if (popHistory && location.hash) history.pushState({}, '', location.pathname);
}

function renderDetail(r) {
  const ingredienser = renderIngredients(r.ingredienser || []);

  const steps = (r.fremgangsmåde || []).map(s => {
    const text = String(s || '');
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

// ---------- Add/Edit modal ----------
function bindAddModal() {
  document.getElementById('add-open-btn').addEventListener('click', () => openAddModal(null));
  document.getElementById('add-close-btn').addEventListener('click', closeAddModal);
  document.getElementById('add-cancel-btn').addEventListener('click', closeAddModal);
  document.getElementById('add-save-btn').addEventListener('click', saveFromModal);
}

function openAddModal(existingRecipe) {
  editingId = existingRecipe ? existingRecipe.id : null;
  const title = document.getElementById('add-modal-title');
  const input = document.getElementById('json-input');
  const msg = document.getElementById('add-msg');
  const saveBtn = document.getElementById('add-save-btn');

  if (existingRecipe) {
    title.textContent = 'Rediger opskrift';
    saveBtn.textContent = 'Opdatér';
    // Pretty-print eksisterende opskrift som JSON
    const clean = { ...existingRecipe };
    input.value = JSON.stringify(clean, null, 2);
  } else {
    title.textContent = 'Tilføj opskrift';
    saveBtn.textContent = 'Gem';
    input.value = '';
  }
  msg.textContent = '';
  msg.className = 'modal-msg';
  document.getElementById('add-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => input.focus(), 50);
}

function closeAddModal() {
  document.getElementById('add-modal').hidden = true;
  document.body.style.overflow = currentDetailId ? 'hidden' : '';
  editingId = null;
}

async function saveFromModal() {
  const input = document.getElementById('json-input');
  const msg = document.getElementById('add-msg');
  const saveBtn = document.getElementById('add-save-btn');

  const raw = input.value.trim();
  if (!raw) {
    setMsg('Indsæt en JSON-blok først.', 'err');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    setMsg('Ugyldig JSON: ' + err.message, 'err');
    return;
  }

  const validation = validateRecipe(parsed);
  if (validation.error) {
    setMsg(validation.error, 'err');
    return;
  }

  // Normalisér: fjern id fra data-objektet — Firestore-doc-ID er separat
  const { id, ...data } = parsed;
  const docId = id;

  // Sæt sensible defaults
  if (typeof data.favorit !== 'boolean') data.favorit = false;
  if (!('noter' in data)) data.noter = null;

  saveBtn.disabled = true;
  setMsg('Gemmer…', 'ok');

  try {
    if (editingId) {
      // Edit-mode: hvis id ændres, skal vi flytte doc'et
      if (docId !== editingId) {
        // Skriv nyt doc, slet gammelt
        await recipesCol.doc(docId).set(data);
        await recipesCol.doc(editingId).delete();
        // Opdater detail-hash hvis åben
        if (currentDetailId === editingId) {
          currentDetailId = docId;
          history.replaceState({ id: docId }, '', '#/' + docId);
        }
      } else {
        await recipesCol.doc(docId).set(data);
      }
      setMsg('Opdateret ✓', 'ok');
    } else {
      // Add-mode: tjek at id ikke findes i forvejen
      const existing = await recipesCol.doc(docId).get();
      if (existing.exists) {
        setMsg(`En opskrift med id "${docId}" findes allerede. Skift id, eller brug redigér.`, 'err');
        saveBtn.disabled = false;
        return;
      }
      await recipesCol.doc(docId).set(data);
      setMsg('Tilføjet ✓', 'ok');
    }
    setTimeout(closeAddModal, 500);
  } catch (err) {
    setMsg('Kunne ikke gemme: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
  }
}

function setMsg(text, kind) {
  const msg = document.getElementById('add-msg');
  msg.textContent = text;
  msg.className = 'modal-msg' + (kind ? ' ' + kind : '');
}

function validateRecipe(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { error: 'JSON skal være et objekt.' };
  }
  const required = ['id', 'navn'];
  for (const k of required) {
    if (!obj[k] || typeof obj[k] !== 'string') {
      return { error: `Feltet "${k}" mangler eller er ikke en tekst.` };
    }
  }
  if (!/^[a-z0-9-]+$/.test(obj.id)) {
    return { error: 'Feltet "id" må kun indeholde små bogstaver, tal og bindestreger (fx "chili-con-carne"). Æ/Ø/Å ikke tilladt.' };
  }
  if (obj.ingredienser && !Array.isArray(obj.ingredienser)) {
    return { error: '"ingredienser" skal være en liste.' };
  }
  if (obj.fremgangsmåde && !Array.isArray(obj.fremgangsmåde)) {
    return { error: '"fremgangsmåde" skal være en liste.' };
  }
  if (obj.tags && !Array.isArray(obj.tags)) {
    return { error: '"tags" skal være en liste.' };
  }
  return { error: null };
}

// ---------- Spin modal ----------
function bindSpinModal() {
  document.getElementById('spin-open-btn').addEventListener('click', openSpinModal);
  document.getElementById('spin-close-btn').addEventListener('click', closeSpinModal);
  document.getElementById('spin-btn').addEventListener('click', doSpin);
  document.getElementById('spin-open-recipe-btn').addEventListener('click', () => {
    console.log('[spin] Åbn opskrift trykket. currentSpinRecipe:', currentSpinRecipe);
    if (!currentSpinRecipe) {
      console.warn('[spin] currentSpinRecipe er null — afbryder');
      return;
    }
    const recipeId = currentSpinRecipe.id;
    console.log('[spin] Åbner opskrift med id:', recipeId);
    // Åbn opskrift FØRST, luk modalen bagefter — så body.style.overflow ikke ryddes midlertidigt
    openRecipe(recipeId);
    closeSpinModal();
    console.log('[spin] Efter open+close. Overlay hidden?', document.getElementById('overlay').hidden);
  });

  document.querySelectorAll('#spin-tag-picker .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#spin-tag-picker .chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      spinFilter = chip.dataset.spin;
    });
  });
}

function openSpinModal() {
  document.getElementById('spin-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  resetSpinResult();
}

function closeSpinModal() {
  document.getElementById('spin-modal').hidden = true;
  document.body.style.overflow = currentDetailId ? 'hidden' : '';
  currentSpinRecipe = null;
}

function resetSpinResult() {
  const result = document.getElementById('spin-result');
  result.innerHTML = '<div class="spin-placeholder">Tryk på knappen for at spinne…</div>';
  document.getElementById('spin-open-recipe-btn').hidden = true;
  document.getElementById('spin-btn').textContent = 'Spin';
  currentSpinRecipe = null;
}

function doSpin() {
  const pool = recipes.filter(r => {
    if (spinFilter === 'alle') return true;
    if (spinFilter === 'favorit') return !!r.favorit;
    return Array.isArray(r.tags) && r.tags.includes(spinFilter);
  });

  const result = document.getElementById('spin-result');

  if (pool.length === 0) {
    result.innerHTML = '<div class="spin-empty">Ingen opskrifter i denne kategori.</div>';
    document.getElementById('spin-open-recipe-btn').hidden = true;
    document.getElementById('spin-btn').textContent = 'Spin';
    currentSpinRecipe = null;
    return;
  }

  // Undgå at trække samme opskrift to gange i træk hvis der er flere at vælge mellem
  let candidate;
  if (pool.length === 1) {
    candidate = pool[0];
  } else {
    do {
      candidate = pool[Math.floor(Math.random() * pool.length)];
    } while (currentSpinRecipe && candidate.id === currentSpinRecipe.id);
  }

  currentSpinRecipe = candidate;

  const img = candidate.billede
    ? `<img src="${escapeAttr(candidate.billede)}" alt="" class="spin-recipe-img" onerror="this.remove()">`
    : '';

  result.innerHTML = `
    <div class="spin-recipe">
      ${img}
      <div class="spin-recipe-name">${escapeHtml(candidate.navn)}</div>
      <div class="spin-recipe-meta">
        ${candidate.portioner ? candidate.portioner + ' personer · ' : ''}${escapeHtml(candidate.kilde || '')}
      </div>
    </div>
  `;

  document.getElementById('spin-open-recipe-btn').hidden = false;
  document.getElementById('spin-btn').textContent = 'Spin igen';
}

// ---------- Helpers ----------
function renderIngredients(list) {
  const groups = [];
  let currentGroup = { heading: null, items: [] };
  groups.push(currentGroup);

  list.forEach(ing => {
    const navn = String(ing.navn || '');
    const match = navn.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (match) {
      const cleanName = match[1].trim();
      const sectionName = match[2].trim();
      if (currentGroup.heading !== sectionName) {
        currentGroup = { heading: sectionName, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push({ ...ing, navn: cleanName });
    } else {
      if (currentGroup.heading !== null) {
        currentGroup = { heading: null, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(ing);
    }
  });

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
