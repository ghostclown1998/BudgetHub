const state = {
  items: [] // { id, name, url, qty, priceVista, priceParcelado, title, hostname }
};

// Cache local (evitar backend repetido)
const CACHE_KEY = 'priceCacheV1';
const ITEMS_KEY = 'budgetItemsV1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(map) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch {} }
function getCachedPrice(url) {
  const map = readCache();
  const entry = map[url];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}
function setCachedPrice(url, data) {
  const map = readCache();
  map[url] = { data, ts: Date.now() };
  writeCache(map);
}

function sanitizePrice(v) {
  if (v == null || !Number.isFinite(v)) return null;
  let n = Number(v);
  // IMPORTANTE: Valores >= 500 são SEMPRE em reais (ex: 3558 = R$ 3.558,00)
  // Nunca converte valores >= 500 - são sempre preços em reais
  // Só converte valores muito pequenos (50-499) que podem estar em centavos
  // Ex: 355 centavos = R$ 3,55, mas isso é raro
  // Regra conservadora: só converte se for inteiro pequeno (< 500)
  if (Number.isInteger(n) && n >= 50 && n < 500 && n % 100 !== 0) {
    // Só produtos muito baratos podem ter valores como 355 centavos
    n = n / 100;
  }
  // Valores >= 500 nunca são convertidos - sempre são reais
  return n;
}

function formatBRL(v) {
  const clean = sanitizePrice(v);
  if (clean == null) return 'R$ 0,00';
  return clean.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function recalc() {
  const sumVista = state.items.reduce((acc, it) => acc + (it.priceVista || 0) * it.qty, 0);
  const sumParcelado = state.items.reduce((acc, it) => acc + (it.priceParcelado || 0) * it.qty, 0);
  document.getElementById('sumVista').textContent = formatBRL(sumVista);
  document.getElementById('sumParcelado').textContent = formatBRL(sumParcelado);
  document.getElementById('countItems').textContent = String(state.items.length);
  // Persistir itens
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(state.items)); } catch {}

  // Totais por categoria
  const box = document.getElementById('byCategory');
  if (box) {
    const map = {};
    for (const it of state.items) {
      const cat = it.category || 'Sem categoria';
      map[cat] = map[cat] || { v: 0, p: 0 };
      map[cat].v += (it.priceVista || 0) * it.qty;
      map[cat].p += (it.priceParcelado || 0) * it.qty;
    }
    const parts = Object.entries(map).map(([k, t]) => `${k}: ${formatBRL(t.v)} / ${formatBRL(t.p)}`);
    box.textContent = parts.length ? parts.join(' • ') : '—';
  }
}

function render() {
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';
  if (state.items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="px-2 py-6 empty-row" colspan="8">Nenhum item adicionado. Cole uma URL acima e clique em Adicionar.</td>`;
    tbody.appendChild(tr);
  }
  for (const it of state.items) {
    const tr = document.createElement('tr');
    tr.className = 'border-t';
    tr.innerHTML = `
      <td class="px-2 py-2 align-top">${(it.category || '-')}
      </td>
      <td class="px-2 py-2 align-top">
        <div class="font-medium flex items-center gap-2">
          ${it.hostname ? `<img src="https://icons.duckduckgo.com/ip3/${it.hostname}.ico" class="w-4 h-4 rounded" alt="ico"/>` : ''}
          <span>${(it.name || it.title || 'Produto').replace(/</g,'&lt;')}</span>
        </div>
        <div class="text-xs text-slate-500">${it.hostname || ''}</div>
      </td>
      <td class="px-2 py-2 align-top"><a class="linkEllipsis" href="${it.url}" target="_blank" rel="noopener noreferrer" title="${it.url}">${it.url}</a></td>
      <td class="px-2 py-2 align-top">
        <input type="number" min="1" value="${it.qty}" data-id="${it.id}" class="qty input !w-20" />
      </td>
      <td class="px-2 py-2 align-top">${formatBRL(it.priceVista)}</td>
      <td class="px-2 py-2 align-top">${formatBRL((it.priceParcelado || 0) * it.qty)}</td>
      <td class="px-2 py-2 align-top text-right flex gap-2">
        <button data-id="${it.id}" class="dup px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 text-slate-200">Duplicar</button>
        <button data-id="${it.id}" class="edit px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 text-slate-200">Editar</button>
        <button data-id="${it.id}" class="remove px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 text-slate-200">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  recalc();

  tbody.querySelectorAll('.qty').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = state.items.find(i => i.id === id);
      const val = parseInt(e.target.value, 10);
      item.qty = Number.isFinite(val) && val > 0 ? val : 1;
      render();
    });
  });
  tbody.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      state.items = state.items.filter(i => i.id !== id);
      render();
    });
  });
  tbody.querySelectorAll('.dup').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const it = state.items.find(i => i.id === id);
      if (!it) return;
      const copy = { ...it, id: Math.random().toString(36).slice(2,9) };
      state.items.push(copy);
      render();
    });
  });
  tbody.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const it = state.items.find(i => i.id === id);
      if (!it) return;
      const name = prompt('Nome do item:', it.name || it.title || '');
      if (name !== null) it.name = name;
      const cat = prompt('Categoria:', it.category || '');
      if (cat !== null) it.category = cat;
      const pv = prompt('Preço à vista (PIX):', it.priceVista != null ? String(it.priceVista) : '');
      if (pv !== null && pv !== '') it.priceVista = Number(pv.replace(',', '.'));
      const pp = prompt('Preço parcelado (Cartão):', it.priceParcelado != null ? String(it.priceParcelado) : '');
      if (pp !== null && pp !== '') it.priceParcelado = Number(pp.replace(',', '.'));
      render();
    });
  });
}

async function fetchPrice(url, ignoreCache = false) {
  const u = new URL(url);
  if (!ignoreCache) {
    const cached = getCachedPrice(url);
    if (cached) {
      return {
        title: cached.title || null,
        priceVista: sanitizePrice(cached.priceVista),
        priceParcelado: sanitizePrice(cached.priceParcelado),
        hostname: cached.source && cached.source.hostname ? cached.source.hostname : u.hostname
      };
    }
  }
  const endpoint = `/api/price?url=${encodeURIComponent(url)}`;
  const resp = await fetch(endpoint);
  if (!resp.ok) throw new Error('Falha ao buscar preço');
  const json = await resp.json();
  setCachedPrice(url, json);
  return {
    title: json.title || null,
    priceVista: sanitizePrice(json.priceVista),
    priceParcelado: sanitizePrice(json.priceParcelado),
    hostname: json.source && json.source.hostname ? json.source.hostname : u.hostname
  };
}

function onAdd() {
  const name = document.getElementById('name').value.trim();
  const url = document.getElementById('url').value.trim();
  const category = (document.getElementById('category')?.value || '').trim();
  const qty = parseInt(document.getElementById('qty').value, 10) || 1;
  if (!url) {
    alert('Informe a URL do produto');
    return;
  }
  const id = Math.random().toString(36).slice(2, 9);
  const tempItem = { id, name, url, category: category || null, qty, priceVista: null, priceParcelado: null, title: null };
  state.items.push(tempItem);
  render();

  // Limpar campos após adicionar
  const nameInputEl = document.getElementById('name');
  const urlInputEl = document.getElementById('url');
  const qtyInputEl = document.getElementById('qty');
  if (nameInputEl) nameInputEl.value = '';
  if (urlInputEl) urlInputEl.value = '';
  if (qtyInputEl) qtyInputEl.value = '1';
  const catInputEl = document.getElementById('category');
  if (catInputEl) catInputEl.value = '';
  fetchPrice(url)
    .then(data => {
      Object.assign(tempItem, data);
      // Se o usuário não informou nome, usar o título apenas no item (não preenche input, pois foi limpo)
      if (!name && data.title) {
        tempItem.name = data.title;
      }
      render();
    })
    .catch(() => {
      // Mantém item, mas usuário pode editar quantidade/valores manualmente no futuro (feature futura)
      render();
    });
}

function onExport() {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'orcamento.json';
  a.click();
}

function onImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const txt = reader.result;
      let list;
      if (file.type === 'text/csv' || (typeof txt === 'string' && txt.trim().split('\n')[0].includes(','))) {
        // CSV: nome,url,qty,categoria
        list = [];
        const lines = String(txt).split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const [name,url,qty,category] = line.split(',');
          if (!url) continue;
          list.push({ name: name || null, url, qty: Number(qty||1), category: category||null });
        }
      } else {
        list = JSON.parse(txt);
      }
      if (!Array.isArray(list)) throw new Error('Formato inválido');
      state.items = list.map(x => ({
        id: x.id || Math.random().toString(36).slice(2, 9),
        name: x.name || null,
        url: x.url,
        qty: x.qty || 1,
        category: x.category || null,
        priceVista: sanitizePrice(x.priceVista),
        priceParcelado: sanitizePrice(x.priceParcelado),
        title: x.title || null,
        hostname: x.hostname || null
      }));
      render();
      // Se houver itens com preço nulo, tentar reconsultar automaticamente
      state.items.forEach(async (it) => {
        if (it.priceVista == null || it.priceParcelado == null) {
          try {
            const data = await fetchPrice(it.url);
            Object.assign(it, data);
            render();
          } catch {}
        }
      });
    } catch {
      alert('Falha ao importar JSON');
    }
  };
  reader.readAsText(file);
}

async function onRefresh() {
  if (state.items.length === 0) {
    alert('Não há itens para atualizar');
    return;
  }
  const btn = document.getElementById('refreshBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Atualizando...';
  }
  try {
    // Atualiza todos os itens em paralelo, ignorando cache
    await Promise.all(state.items.map(async (it) => {
      if (!it.url) return;
      try {
        const data = await fetchPrice(it.url, true); // ignoreCache = true
        if (!it.name && data.title) it.name = data.title;
        it.priceVista = sanitizePrice(data.priceVista);
        it.priceParcelado = sanitizePrice(data.priceParcelado);
        if (data.title) it.title = data.title;
      } catch (err) {
        console.warn(`Falha ao atualizar ${it.url}:`, err);
      }
    }));
    render();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Atualizar preços';
    }
  }
}

document.getElementById('addBtn').addEventListener('click', onAdd);
document.getElementById('exportBtn').addEventListener('click', onExport);
document.getElementById('refreshBtn').addEventListener('click', onRefresh);
document.getElementById('importInput').addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) onImport(e.target.files[0]);
});

// Compartilhar link (URL hash)
document.getElementById('shareBtn').addEventListener('click', async () => {
  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(state.items))));
    const url = `${location.origin}${location.pathname}#d=${payload}`;
    await navigator.clipboard.writeText(url);
    alert('Link copiado!');
  } catch {
    alert('Falha ao copiar link');
  }
});

// (Imprimir/PDF removido a pedido do usuário)

// Preview de favicon ao digitar URL
const urlInput = document.getElementById('url');
const urlFav = document.getElementById('urlFavicon');
function updateFaviconPreview() {
  try {
    const u = new URL(urlInput.value);
    const host = u.hostname;
    urlFav.src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    urlFav.style.opacity = '1';
  } catch {
    urlFav.removeAttribute('src');
    urlFav.style.opacity = '0.3';
  }
}
urlInput.addEventListener('input', updateFaviconPreview);
updateFaviconPreview();

// Atalho: Enter no campo URL adiciona
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onAdd();
});

// Restaurar itens do cache local na inicialização
try {
  const saved = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
  if (Array.isArray(saved)) state.items = saved;
} catch {}

// Carregar de URL compartilhada
if (location.hash.startsWith('#d=')) {
  try {
    const json = decodeURIComponent(escape(atob(location.hash.slice(3))));
    const fromLink = JSON.parse(json);
    if (Array.isArray(fromLink)) state.items = fromLink.map(x => ({...x, id: x.id || Math.random().toString(36).slice(2,9)}));
  } catch {}
}

render();

// Tabs Itens/Resumo
const tabItemsBtn = document.getElementById('tabItemsBtn');
const tabSummaryBtn = document.getElementById('tabSummaryBtn');
const panelItems = document.getElementById('panel-items');
const panelSummary = document.getElementById('panel-summary');
if (tabItemsBtn && tabSummaryBtn) {
  function activate(tab) {
    if (tab === 'items') {
      tabItemsBtn.classList.add('tabActive');
      tabSummaryBtn.classList.remove('tabActive');
      panelItems.style.display = '';
      panelSummary.style.display = 'none';
    } else {
      tabSummaryBtn.classList.add('tabActive');
      tabItemsBtn.classList.remove('tabActive');
      panelItems.style.display = 'none';
      panelSummary.style.display = '';
    }
  }
  tabItemsBtn.addEventListener('click', () => activate('items'));
  tabSummaryBtn.addEventListener('click', () => activate('summary'));
}


