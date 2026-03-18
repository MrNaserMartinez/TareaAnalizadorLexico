// ============================================================
//  UI — app.js  (v3: + tabla de símbolos)
// ============================================================

const TYPE_INFO = {
  'Palabra_Reservada':   { label: 'P. Reservada',  css: 'p_reservada' },
  'Identificador':       { label: 'Identificador', css: 'identificador' },
  'Número_Entero':       { label: 'Número Entero', css: 'numero' },
  'Cadena':              { label: 'Cadena',         css: 'cadena' },
  'Operador_Aritmético': { label: 'Op. Aritmético', css: 'operador' },
  'Relacional':          { label: 'Relacional',     css: 'relacional' },
  'Asignación':          { label: 'Asignación',     css: 'asignacion' },
  'Error':               { label: 'ERROR',           css: 'error' },
};

const SUMMARY_META = {
  'Palabra_Reservada':   { label: 'Palabras Reservadas', color: 'var(--token-kw)'     },
  'Identificador':       { label: 'Identificadores',     color: 'var(--token-id)'     },
  'Número_Entero':       { label: 'Números Enteros',     color: 'var(--token-num)'    },
  'Cadena':              { label: 'Cadenas',             color: 'var(--token-str)'    },
  'Operador_Aritmético': { label: 'Op. Aritméticos',     color: 'var(--token-op)'     },
  'Relacional':          { label: 'Relacionales',        color: 'var(--token-rel)'    },
  'Asignación':          { label: 'Asignaciones',        color: 'var(--token-assign)' },
  'Error':               { label: 'Errores',             color: 'var(--token-err)'    },
};

const CHIP_COLORS = {
  'Palabra_Reservada':   'var(--token-kw)',
  'Identificador':       'var(--token-id)',
  'Número_Entero':       'var(--token-num)',
  'Cadena':              'var(--token-str)',
  'Operador_Aritmético': 'var(--token-op)',
  'Relacional':          'var(--token-rel)',
  'Asignación':          'var(--token-assign)',
  'Error':               'var(--token-err)',
};

// Colores por tipo inferido en la tabla de símbolos
const TIPO_COLOR = {
  'int':         'var(--token-num)',
  'string':      'var(--token-str)',
  'desconocido': 'var(--muted)',
};

let activeFilter = 'all';
let allTokenRows  = [];

// ── Helpers ───────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emptyState(msg = 'Esperando análisis...', sub = 'Escribe código y presiona Analizar') {
  return `<div class="empty-state">
    <div class="empty-icon">⬡</div>
    <span>${msg}</span>
    <span style="font-size:0.72rem">${sub}</span>
  </div>`;
}

function animateValue(el, end) {
  el.textContent = end;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// ── Scan line ─────────────────────────────────────────────────

function playScanEffect() {
  const wrap = document.getElementById('editorWrapper');
  const old  = wrap.querySelector('.scan-line');
  if (old) old.remove();
  const line = document.createElement('div');
  line.className = 'scan-line';
  wrap.appendChild(line);
  setTimeout(() => line.remove(), 700);
}

// ── Progress bar ──────────────────────────────────────────────

function runProgress(cb) {
  const wrap = document.getElementById('progressWrap');
  const bar  = document.getElementById('progressBar');
  wrap.classList.add('active');
  bar.style.width = '0%';
  let p = 0;
  const iv = setInterval(() => {
    p += Math.random() * 18 + 8;
    if (p >= 90) { clearInterval(iv); p = 90; }
    bar.style.width = p + '%';
  }, 40);
  setTimeout(() => {
    clearInterval(iv);
    bar.style.width = '100%';
    setTimeout(() => { wrap.classList.remove('active'); bar.style.width = '0%'; cb(); }, 200);
  }, 520);
}

// ── Filters ───────────────────────────────────────────────────

function buildFilters(stats) {
  const wrap = document.getElementById('filtersWrap');
  wrap.innerHTML = `<span class="filters-label">Filtrar:</span>`;

  const allChip = document.createElement('button');
  allChip.className = 'filter-chip active';
  allChip.dataset.type = 'all';
  allChip.innerHTML = `Todos <span class="chip-count">${Object.values(stats).reduce((a,b)=>a+b,0)}</span>`;
  allChip.addEventListener('click', () => setFilter('all'));
  wrap.appendChild(allChip);

  for (const [type, meta] of Object.entries(SUMMARY_META)) {
    const count = stats[type] || 0;
    if (count === 0) continue;
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.dataset.type = type;
    chip.innerHTML = `${TYPE_INFO[type].label} <span class="chip-count">${count}</span>`;
    chip.style.color = CHIP_COLORS[type];
    chip.style.borderColor = CHIP_COLORS[type] + '55';
    chip.addEventListener('click', () => setFilter(type));
    wrap.appendChild(chip);
  }
  wrap.classList.add('visible');
}

function setFilter(type) {
  activeFilter = type;
  document.querySelectorAll('.filter-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.type === type));
  allTokenRows.forEach(({ el, tokenType }) =>
    el.classList.toggle('hidden-filter', type !== 'all' && tokenType !== type));
  const vis = type === 'all'
    ? allTokenRows.length
    : allTokenRows.filter(r => r.tokenType === type).length;
  document.getElementById('tokenCount').textContent =
    type === 'all' ? `${allTokenRows.length} tokens` : `${vis} de ${allTokenRows.length}`;
}

// ── Render tokens ─────────────────────────────────────────────

function renderTokensAnimated(tokens) {
  const container = document.getElementById('results');
  container.innerHTML = '';
  allTokenRows = [];
  tokens.forEach((tok, idx) => {
    const info = TYPE_INFO[tok.type] || { label: tok.type, css: 'error' };
    const row  = document.createElement('div');
    row.className = 'token-row';
    row.innerHTML = `
      <span class="token-num-badge">${idx + 1}</span>
      <span class="token-type-badge tt-${info.css}">${info.label}</span>
      <span class="token-value">${escapeHtml(tok.value)}</span>
      <span class="token-line">L${tok.line}</span>
    `;
    container.appendChild(row);
    allTokenRows.push({ el: row, tokenType: tok.type });
    const delay = Math.min(idx * 28, 800);
    setTimeout(() => row.classList.add('visible'), delay);
  });
}

// ── Render tabla de símbolos ──────────────────────────────────

function renderSymbolTable(symbolTable) {
  const panel = document.getElementById('symbolTablePanel');
  const tbody = document.getElementById('symbolTableBody');
  const count = document.getElementById('symbolCount');

  tbody.innerHTML = '';

  if (symbolTable.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  count.textContent = `${symbolTable.length} símbolo${symbolTable.length !== 1 ? 's' : ''}`;

  symbolTable.forEach((entry, idx) => {
    const row = document.createElement('tr');
    row.className = 'sym-row';

    const tipoColor = TIPO_COLOR[entry.tipo] || 'var(--muted)';
    const aparicionesBadges = entry.apariciones
      .map(l => `<span class="line-badge">L${l}</span>`)
      .join('');

    row.innerHTML = `
      <td class="sym-idx">${idx + 1}</td>
      <td class="sym-nombre"><span class="sym-name-pill">${escapeHtml(entry.nombre)}</span></td>
      <td class="sym-tipo"><span class="sym-tipo-badge" style="color:${tipoColor};border-color:${tipoColor}44;background:${tipoColor}11">${entry.tipo}</span></td>
      <td class="sym-decl">L${entry.lineaDecl}</td>
      <td class="sym-apariciones">${aparicionesBadges}</td>
      <td class="sym-usos"><span class="usos-count">${entry.usos}</span></td>
    `;
    tbody.appendChild(row);

    // Animación staggered
    setTimeout(() => row.classList.add('visible'), idx * 40);
  });
}

// ── Render results ────────────────────────────────────────────

function renderResults(tokens, symbolTable) {
  if (tokens.length === 0) {
    document.getElementById('results').innerHTML = emptyState('No se encontraron tokens');
    document.getElementById('tokenCount').textContent = '—';
    document.getElementById('statsBar').style.display = 'none';
    document.getElementById('summaryPanel').style.display = 'none';
    document.getElementById('symbolTablePanel').style.display = 'none';
    document.getElementById('filtersWrap').classList.remove('visible');
    return;
  }

  const stats = {};
  for (const t of tokens) stats[t.type] = (stats[t.type] || 0) + 1;

  renderTokensAnimated(tokens);
  buildFilters(stats);

  document.getElementById('tokenCount').textContent = `${tokens.length} tokens`;

  const statsBar = document.getElementById('statsBar');
  statsBar.style.display = 'flex';
  animateValue(document.getElementById('s-total'), tokens.length);
  animateValue(document.getElementById('s-kw'),    stats['Palabra_Reservada']   || 0);
  animateValue(document.getElementById('s-id'),    stats['Identificador']       || 0);
  animateValue(document.getElementById('s-num'),   stats['Número_Entero']       || 0);
  animateValue(document.getElementById('s-err'),   stats['Error']               || 0);

  renderSummary(stats);
  renderSymbolTable(symbolTable);
}

// ── Render summary ────────────────────────────────────────────

function renderSummary(stats) {
  const panel = document.getElementById('summaryPanel');
  const grid  = document.getElementById('summaryGrid');
  grid.innerHTML = '';
  panel.style.display = 'block';

  for (const [type, meta] of Object.entries(SUMMARY_META)) {
    const count   = stats[type] || 0;
    const item    = document.createElement('div');
    item.className = 'summary-item';
    const countEl = document.createElement('div');
    countEl.className = 'summary-count';
    countEl.style.color = meta.color;
    countEl.textContent = count;
    item.innerHTML = `<div class="summary-label">${meta.label}</div>`;
    item.appendChild(countEl);
    grid.appendChild(item);
    const idx = Object.keys(SUMMARY_META).indexOf(type);
    setTimeout(() => {
      if (count > 0) { countEl.classList.add('pop'); setTimeout(() => countEl.classList.remove('pop'), 400); }
    }, 600 + idx * 60);
  }
}

// ── Acciones ──────────────────────────────────────────────────

function analyze() {
  const code = document.getElementById('sourceCode').value;
  if (!code.trim()) { clearAll(); return; }

  const btn = document.getElementById('btnAnalyze');
  btn.disabled = true;
  btn.textContent = '⏳ Analizando...';
  btn.classList.add('analyzing');
  playScanEffect();
  activeFilter = 'all';

  runProgress(() => {
    const { tokens, symbolTable } = analyzeLexer(code);   // v3: desestructura ambos
    renderResults(tokens, symbolTable);
    btn.disabled = false;
    btn.textContent = '▶ Analizar';
    btn.classList.remove('analyzing');
  });
}

function clearAll() {
  document.getElementById('sourceCode').value = '';
  document.getElementById('results').innerHTML = emptyState();
  document.getElementById('tokenCount').textContent = '—';
  document.getElementById('statsBar').style.display = 'none';
  document.getElementById('summaryPanel').style.display = 'none';
  document.getElementById('symbolTablePanel').style.display = 'none';
  document.getElementById('filtersWrap').classList.remove('visible');
  allTokenRows = [];
  activeFilter = 'all';
}

function loadExample() {
  document.getElementById('sourceCode').value =
`// Ejemplo con todos los casos del analizador
int contador := 0;
if (contador <= 100) {
  print "asdfg resultado";
  contador := contador + 1;
}

for (i := 0; i < 10; i := i + 1) {
  resultado := i * 2;
}

// Palabras reservadas + asdfg
ifasdfg x := 55;
printasdfg "asdfg valor";

// Identificadores válidos e inválidos
pepe := 25;
x1   := 99;
identificadorMuyLargo := 50;

// Número fuera de rango
valor := 150;

// Cadena inválida
msg := "hola mundo";

// Operadores relacionales
if (a <> b) { x := x - 1; }
rango    := 1..10;
resultado := (a >= b);`;
  analyze();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sourceCode').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyze();
  });
});