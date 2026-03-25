// app.js - Lógica de renderizado y UI
const TYPE_INFO = {
  'Palabra_Reservada':   { label: 'P. Reservada',      css: 'kw'     },
  'Identificador':       { label: 'Identificador',     css: 'id'     },
  'Número_Entero':       { label: 'Número Entero',     css: 'num'    },
  'Cadena':              { label: 'Cadena',            css: 'str'    },
  'Operador_Aritmético': { label: 'Op. Aritmético',    css: 'op'     },
  'Relacional':          { label: 'Relacional',        css: 'rel'    },
  'Asignación':          { label: 'Asignación',        css: 'assign' },
  'Expresion_Regular':   { label: 'Expresión Regular', css: 'regex'  },
  'Especial':            { label: '⭐ Especial',        css: 'especial'},
  'Error':               { label: 'ERROR',             css: 'err'    },
};

let lastErrorTable    = [];
let errorTableVisible = false;

// 
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Render Tokens
function renderTokens(tokens) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (tokens.length === 0) {
    container.innerHTML = '<div class="empty-msg">No se encontraron tokens.</div>';
    return;
  }

  tokens.forEach((tok, idx) => {
    const info = TYPE_INFO[tok.type] || { label: tok.type, css: 'err' };
    const displayValue = tok.type === 'Especial'
      ? 'Una gran persona y catedrática que admiro mucho 💙'
      : escapeHtml(tok.value);
    const row  = document.createElement('div');
    row.className = 'token-row';
    row.innerHTML = `
      <span class="token-num">${idx + 1}</span>
      <span class="token-type tt-${info.css}">${info.label}</span>
      <span class="token-value">${displayValue}</span>
      <span class="token-line">L${tok.line}</span>
    `;
    container.appendChild(row);
  });
}

// Render Tabla de Símbolos
function renderSymbolTable(symbolTable) {
  const tbody = document.getElementById('symbolTableBody');
  const count = document.getElementById('symbolCount');
  const row   = document.getElementById('tablesRow');
  tbody.innerHTML = '';

  if (symbolTable.length === 0) { row.style.display = 'none'; return; }

  row.style.display = 'grid';
  count.textContent = `${symbolTable.length} símbolo${symbolTable.length !== 1 ? 's' : ''}`;

  symbolTable.forEach((entry, idx) => {
    const tipoCss =
      entry.tipo === 'int'         ? 'int'    :
      entry.tipo === 'string'      ? 'string' : 'unk';

    const aparicionesBadges = entry.apariciones
      .map(l => `<span class="line-badge">L${l}</span>`).join('');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${idx + 1}</td>
      <td><code>${escapeHtml(entry.nombre)}</code></td>
      <td><span class="type-pill type-${tipoCss}">${entry.tipo}</span></td>
      <td>L${entry.lineaDecl}</td>
      <td>${aparicionesBadges}</td>
      <td><strong>${entry.usos}</strong></td>
    `;
    tbody.appendChild(row);
  });
}

// Render tabla de errores
function renderErrorTable(errorTable) {
  const tbody = document.getElementById('errorTableBody');
  const count = document.getElementById('errorCount');
  tbody.innerHTML = '';
  count.textContent = `${errorTable.length} error${errorTable.length !== 1 ? 'es' : ''}`;

  errorTable.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.idx}</td>
      <td><code>${escapeHtml(entry.value)}</code></td>
      <td><span class="type-pill type-err">${escapeHtml(entry.tipo)}</span></td>
      <td style="color:#6b7280">${escapeHtml(entry.desc)}</td>
      <td>L${entry.line}</td>
    `;
    tbody.appendChild(row);
  });
}

// Boton de errores
function updateErrorButton(errorTable) {
  const btn   = document.getElementById('btnErrors');
  const badge = document.getElementById('btnErrorBadge');
  if (errorTable.length > 0) {
    btn.style.display = 'inline-block';
    badge.textContent = errorTable.length;
  } else {
    btn.style.display = 'none';
    document.getElementById('errorTablePanel').style.display = 'none';
  }
}

function toggleErrorTable() {
  errorTableVisible = !errorTableVisible;
  const panel = document.getElementById('errorTablePanel');
  const btn   = document.getElementById('btnErrors');
  if (errorTableVisible) {
    renderErrorTable(lastErrorTable);
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    document.getElementById('tablesRow').scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.innerHTML = `✕ Ocultar Errores <span id="btnErrorBadge" class="badge">${lastErrorTable.length}</span>`;
  } else {
    panel.style.display = 'none';
    btn.innerHTML = `⚠ Ver Errores <span id="btnErrorBadge" class="badge">${lastErrorTable.length}</span>`;
  }
}

function renderStats(tokens) {
  const stats = {};
  for (const t of tokens) stats[t.type] = (stats[t.type] || 0) + 1;

  const bar = document.getElementById('statsBar');
  bar.style.display = 'flex';
  document.getElementById('s-total').textContent = tokens.length;
  document.getElementById('s-kw').textContent    = stats['Palabra_Reservada']   || 0;
  document.getElementById('s-id').textContent    = stats['Identificador']       || 0;
  document.getElementById('s-num').textContent   = stats['Número_Entero']       || 0;
  document.getElementById('s-err').textContent   = stats['Error']               || 0;
}

// Analizar
function analyze() {
  const code = document.getElementById('sourceCode').value;
  if (!code.trim()) { clearAll(); return; }

  errorTableVisible = false;
  document.getElementById('errorTablePanel').style.display = 'none';

  const { tokens, symbolTable, errorTable } = analyzeLexer(code);
  lastErrorTable = errorTable;

  renderTokens(tokens);
  renderStats(tokens);
  renderSymbolTable(symbolTable);
  updateErrorButton(errorTable);

  document.getElementById('tokenCount').textContent = `${tokens.length} tokens`;
}

// Reset
function clearAll() {
  document.getElementById('sourceCode').value      = '';
  document.getElementById('results').innerHTML     = '<div class="empty-msg">Sin análisis aún. Escribe código y presiona Analizar.</div>';
  document.getElementById('tokenCount').textContent = '—';
  document.getElementById('statsBar').style.display        = 'none';
  document.getElementById('tablesRow').style.display        = 'none';
  document.getElementById('errorTablePanel').style.display  = 'none';
  document.getElementById('btnErrors').style.display        = 'none';
  lastErrorTable    = [];
  errorTableVisible = false;
}

//EL EJEMPLO DE PRUEBA PARA PROBAR CADA APARTADO
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

// Expresiones regulares
patron1 := /[a-z]+/gi;
emailReg := /[a-zA-Z0-9]+@[a-zA-Z]+\.[a-zA-Z]{2,}/;

// Palabras reservadas con asdfg
ifasdfg x := 55;
printasdfg "asdfg valor";

// Errores
identificadorMuyLargo := 50;
valor := 150;
msg := "hola mundo";
if (a <> b) { x := x - 1; }
: mal_asignacion;
@ simbolo_raro;`;
  analyze();
}

// ── Ctrl+Enter ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sourceCode').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyze();
  });
});