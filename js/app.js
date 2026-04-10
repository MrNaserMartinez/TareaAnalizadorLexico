// app.js — Lógica de UI para NenScript Analyzer

const TYPE_INFO = {
  'Palabra_Reservada':   { label: 'P. Reservada',      css: 'kw'      },
  'Identificador':       { label: 'Identificador',     css: 'id'      },
  'Número_Entero':       { label: 'Número Entero',     css: 'num'     },
  'Número_Decimal':      { label: 'Número Decimal',    css: 'dec'     },
  'Cadena':              { label: 'Cadena',            css: 'str'     },
  'Booleano':            { label: 'Booleano',          css: 'bool'    },
  'Operador_Aritmético': { label: 'Op. Aritmético',    css: 'op'      },
  'Operador_Lógico':     { label: 'Op. Lógico',        css: 'logic'   },
  'Relacional':          { label: 'Relacional',        css: 'rel'     },
  'Asignación':          { label: 'Asignación (:=)',   css: 'assign'  },
  'Delimitador':         { label: 'Delimitador',       css: 'delim'   },
  'Especial':            { label: 'Especial',          css: 'especial'},
  'Error':               { label: 'ERROR',             css: 'err'     },
};

let lastErrorTable    = [];
let errorTableVisible = false;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Render tokens
function renderTokens(tokens) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (tokens.length === 0) {
    container.innerHTML = '<div class="empty-msg">No se encontraron tokens.</div>';
    return;
  }

  tokens.forEach((tok, idx) => {
    const info = TYPE_INFO[tok.type] || { label: tok.type, css: 'err' };

    let displayValue;
    if (tok.type === 'Especial') {
      displayValue = '✨ Ingeniera ejemplar, guía y catedrática dedicada — ¡gracias por enseñarnos Compiladores!';
    } else {
      displayValue = escapeHtml(tok.value);
    }

    const row = document.createElement('div');
    row.className = 'token-row' + (tok.type === 'Especial' ? ' token-row-especial' : '');
    row.innerHTML = `
      <span class="token-num">${idx + 1}</span>
      <span class="token-type tt-${info.css}">${info.label}</span>
      <span class="token-value">${displayValue}</span>
      <span class="token-line">L${tok.line}</span>
    `;
    container.appendChild(row);
  });
}

// Render tabla de símbolos
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
      entry.tipo.includes('gon')      ? 'gon'      :
      entry.tipo.includes('killua')   ? 'killua'   :
      entry.tipo.includes('kurapika') ? 'kurapika' :
      entry.tipo.includes('leorio')   ? 'leorio'   : 'unk';

    const aparicionesBadges = entry.apariciones
      .map(l => `<span class="line-badge">L${l}</span>`).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><code>${escapeHtml(entry.nombre)}</code></td>
      <td><span class="type-pill type-${tipoCss}">${entry.tipo}</span></td>
      <td>L${entry.lineaDecl}</td>
      <td>${aparicionesBadges}</td>
      <td><strong>${entry.usos}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// Render tabla de errores
function renderErrorTable(errorTable) {
  const tbody = document.getElementById('errorTableBody');
  const count = document.getElementById('errorCount');
  tbody.innerHTML = '';
  count.textContent = `${errorTable.length} error${errorTable.length !== 1 ? 'es' : ''}`;

  errorTable.forEach((entry) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.idx}</td>
      <td><code>${escapeHtml(entry.value)}</code></td>
      <td><span class="type-pill type-err">${escapeHtml(entry.tipo)}</span></td>
      <td style="color:#6b7280">${escapeHtml(entry.desc)}</td>
      <td>L${entry.line}</td>
    `;
    tbody.appendChild(tr);
  });
}

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
  document.getElementById('s-total').textContent  = tokens.length;
  document.getElementById('s-kw').textContent     = stats['Palabra_Reservada']   || 0;
  document.getElementById('s-id').textContent     = stats['Identificador']       || 0;
  document.getElementById('s-num').textContent    = (stats['Número_Entero'] || 0) + (stats['Número_Decimal'] || 0);
  document.getElementById('s-err').textContent    = stats['Error']                || 0;
}

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

function clearAll() {
  document.getElementById('sourceCode').value       = '';
  document.getElementById('results').innerHTML      = '<div class="empty-msg">Sin análisis aún. Escribe código NenScript y presiona Analizar.</div>';
  document.getElementById('tokenCount').textContent = '—';
  document.getElementById('statsBar').style.display        = 'none';
  document.getElementById('tablesRow').style.display        = 'none';
  document.getElementById('errorTablePanel').style.display  = 'none';
  document.getElementById('btnErrors').style.display        = 'none';
  lastErrorTable    = [];
  errorTableVisible = false;
}

// Ejemplo de prueba con código NenScript válido + errores
function loadExample() {
  document.getElementById('sourceCode').value =
`// Programa de ejemplo en NenScript
nen HunterExam:

    // Declaracion de variables
    gon      vida      := 100 ;
    killua   velocidad := 9.85 ;
    kurapika nombre    := "Gon Freecss" ;
    leorio   activo    := verdad ;

    // Funcion que saluda
    hatsu saludar( kurapika x ):
        shu( x ) ;
        zetsu ;
    ko

    // Condicional
    ryodan vida > 0:
        shu( "Aura activa" ) ;
    illumi vida == 0:
        shu( "Sin aura" ) ;
    hisoka:
        shu( "Aura negativa" ) ;
    ko

    // Ciclo ten (while)
    ten vida > 50:
        vida := vida - 10 ;
        ren ;
    ko

    // Ciclo ken (for)
    ken gon i := 0 ; i < 5 ; i := i + 1:
        shu( i ) ;
    ko

ko

/* --- ERRORES INTENCIONALES --- */
identificadorDemasiadoLargoParaNenScript := 1 ;
msg := 'comilla simple invalida' ;
x := 3.4.5 ;
@ simbolo_raro ;
: asignacion_rota ;`;
  analyze();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sourceCode').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyze();
  });
});