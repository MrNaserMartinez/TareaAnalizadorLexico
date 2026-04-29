// app.js — Lógica de UI para NenScript (Léxico + Sintáctico)

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
let lastSyntaxErrors  = [];
let lastParseTree     = null;
let errorTableVisible = false;
let treeViewMode      = 'graphical'; // 'graphical' | 'text'

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Render Tokens ─────────────────────────────────────────────────────
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
      <span class="token-line">L${tok.line}:C${tok.column}</span>
    `;
    container.appendChild(row);
  });
}

// ── Render Tabla de Símbolos ──────────────────────────────────────────
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

    const valorMostrado = entry.valor === '—'
      ? '<span style="color:#9ca3af">—</span>'
      : `<code>${escapeHtml(entry.valor)}</code>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><code>${escapeHtml(entry.nombre)}</code></td>
      <td><span class="type-pill type-${tipoCss}">${entry.tipo}</span></td>
      <td>${valorMostrado}</td>
      <td>L${entry.lineaDecl}</td>
      <td>C${entry.columnaDecl}</td>
      <td>${aparicionesBadges}</td>
      <td><strong>${entry.usos}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render Tabla de Errores Léxicos ───────────────────────────────────
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
      <td>C${entry.column}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Render Tabla de Errores Sintácticos ───────────────────────────────
function renderSyntaxErrors(errors) {
  const panel = document.getElementById('syntaxErrorPanel');
  const tbody = document.getElementById('syntaxErrorBody');
  const count = document.getElementById('syntaxErrorCount');
  tbody.innerHTML = '';

  if (!errors || errors.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  count.textContent = `${errors.length} error${errors.length !== 1 ? 'es' : ''}`;

  errors.forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.idx}</td>
      <td><code>${escapeHtml(e.value)}</code></td>
      <td style="color:#374151">${escapeHtml(e.desc)}</td>
      <td>L${e.line}</td>
      <td>C${e.column}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ════════════════════════════════════════════════════════════════════════
// ÁRBOL DE DERIVACIÓN — Vista gráfica (SVG) y vista de texto
// ════════════════════════════════════════════════════════════════════════

// Decide si un nodo es terminal (sin hijos)
function isTerminal(node) {
  return !node.children || node.children.length === 0;
}

// Convierte el label crudo del parser a la forma que se muestra en el árbol gráfico
// Ejemplos:
//   "programa"                  → "<programa>"
//   "lista_inst"                → "<lista_inst>"
//   "expr_aritmetica (+)"       → "<expr_aritmetica> +"
//   "'nen' [L1:C1]"             → "nen"
//   "tipo (gon) [L2:C5]"        → "gon"
//   "ENTERO (100) [L2:C27]"     → "100"
//   "IDENT (vida) [L2:C9]"      → "vida"
function graphicalLabel(node) {
  let label = String(node.label || '').replace(/\s*\[L\d+:C\d+\]\s*$/, '').trim();

  if (isTerminal(node)) {
    // Terminales: "'X'" -> X, o "TYPE (value)" -> value
    const m1 = label.match(/^'([^']+)'$/);
    if (m1) return m1[1];
    const m2 = label.match(/^[A-Za-z_]+\s*\(([^)]+)\)$/);
    if (m2) return m2[1];
    return label;
  }
  // No terminales con info adicional, p. ej. "expr_aritmetica (+)"
  const m = label.match(/^([a-zA-Z_]+)\s*\(([^)]+)\)$/);
  if (m) return `<${m[1]}> ${m[2]}`;
  return `<${label}>`;
}

// Layout del árbol: cada hoja ocupa un slot de ancho 1; los internos se centran sobre sus hijos.
function computeSubtreeWidth(node) {
  if (isTerminal(node)) { node._w = 1; return 1; }
  let total = 0;
  for (const c of node.children) total += computeSubtreeWidth(c);
  node._w = Math.max(total, 1);
  return node._w;
}

function computeLayout(node, x = 0, depth = 0) {
  if (isTerminal(node)) {
    node._x = x + 0.5;
    node._d = depth;
    return;
  }
  let cx = x;
  for (const c of node.children) {
    computeLayout(c, cx, depth + 1);
    cx += c._w;
  }
  const xs = node.children.map(c => c._x);
  node._x = (Math.min(...xs) + Math.max(...xs)) / 2;
  node._d = depth;
}

function maxDepth(node) {
  if (isTerminal(node)) return node._d;
  return Math.max(...node.children.map(c => maxDepth(c)));
}

// Recorre todos los nodos para enumerarlos
function flattenNodes(node, list = []) {
  list.push(node);
  if (node.children) for (const c of node.children) flattenNodes(c, list);
  return list;
}

// Genera el SVG del árbol
function buildTreeSVG(tree) {
  if (!tree) return null;

  // Layout
  computeSubtreeWidth(tree);
  computeLayout(tree);

  // Dimensiones por slot
  const slotW = 130;          // ancho de un slot horizontal
  const levelH = 78;          // altura entre niveles
  const padding = 24;         // padding general
  const nodeW = 110;          // ancho del rectángulo del nodo
  const nodeH = 32;           // altura del rectángulo del nodo

  const totalLeaves = tree._w;
  const depth = maxDepth(tree);
  const width  = totalLeaves * slotW + padding * 2;
  const height = (depth + 1) * levelH + padding * 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width',  width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'parse-tree-svg');

  const px = (x) => padding + x * slotW;
  const py = (d) => padding + d * levelH + nodeH / 2;

  // 1. Dibujar líneas (edges) primero para que queden detrás
  const allNodes = flattenNodes(tree);
  for (const n of allNodes) {
    if (!n.children) continue;
    const x1 = px(n._x);
    const y1 = py(n._d) + nodeH / 2;
    for (const c of n.children) {
      const x2 = px(c._x);
      const y2 = py(c._d) - nodeH / 2;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'tree-edge');
      svg.appendChild(line);
    }
  }

  // 2. Dibujar nodos encima
  for (const n of allNodes) {
    const cx = px(n._x);
    const cy = py(n._d);
    const terminal = isTerminal(n);
    const rectClass = terminal ? 'tree-rect tree-rect-terminal' : 'tree-rect tree-rect-nonterminal';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${cx - nodeW/2}, ${cy - nodeH/2})`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width',  nodeW);
    rect.setAttribute('height', nodeH);
    rect.setAttribute('rx', 6);
    rect.setAttribute('ry', 6);
    rect.setAttribute('class', rectClass);
    g.appendChild(rect);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', nodeW / 2);
    text.setAttribute('y', nodeH / 2);
    text.setAttribute('class', terminal ? 'tree-text tree-text-terminal' : 'tree-text tree-text-nonterminal');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');

    let lbl = graphicalLabel(n);
    // Truncar etiquetas muy largas para que entren en la caja
    if (lbl.length > 16) lbl = lbl.slice(0, 14) + '…';
    text.textContent = lbl;

    // Tooltip con info completa
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = n.label + (n.token ? ` — L${n.token.line}:C${n.token.column}` : '');
    g.appendChild(title);

    g.appendChild(text);
    svg.appendChild(g);
  }

  return svg;
}

// Renderizado de árbol en modo TEXTO (HTML jerárquico)
function buildTextTree(tree) {
  const root = document.createElement('div');
  root.className = 'tree-text-view';
  root.appendChild(buildTextNode(tree));
  return root;
}

function buildTextNode(node) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const labelEl = document.createElement('span');
  labelEl.className = 'tree-label' + (isTerminal(node) ? ' tree-terminal' : ' tree-nonterminal');
  labelEl.textContent = node.label;

  if (node.token) {
    const loc = document.createElement('span');
    loc.className = 'tree-loc';
    loc.textContent = ` L${node.token.line}:C${node.token.column}`;
    labelEl.appendChild(loc);
  }
  wrapper.appendChild(labelEl);

  if (node.children && node.children.length) {
    const ul = document.createElement('ul');
    ul.className = 'tree-children';
    node.children.forEach(child => {
      const li = document.createElement('li');
      li.appendChild(buildTextNode(child));
      ul.appendChild(li);
    });
    wrapper.appendChild(ul);
  }
  return wrapper;
}

// Renderiza el árbol en el contenedor según el modo activo
function renderParseTreeContent() {
  const container = document.getElementById('parseTreeContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!lastParseTree) {
    container.innerHTML = '<div class="empty-msg">No hay árbol para mostrar.</div>';
    return;
  }

  if (treeViewMode === 'graphical') {
    container.classList.add('tree-graphical');
    container.classList.remove('tree-textual');
    const svg = buildTreeSVG(lastParseTree);
    if (svg) container.appendChild(svg);
  } else {
    container.classList.add('tree-textual');
    container.classList.remove('tree-graphical');
    container.appendChild(buildTextTree(lastParseTree));
  }

  // Actualiza estado de los botones
  document.getElementById('btnTreeGraphical').classList.toggle('btn-toggle-active', treeViewMode === 'graphical');
  document.getElementById('btnTreeTextual').classList.toggle('btn-toggle-active', treeViewMode === 'text');
}

function setTreeView(mode) {
  treeViewMode = mode;
  renderParseTreeContent();
}

// Toggle de visibilidad del panel completo
function toggleTreePanel() {
  const panel = document.getElementById('parseTreePanel');
  const body  = document.getElementById('parseTreeBody');
  const btn   = document.getElementById('btnViewTree');
  if (!lastParseTree) return;

  const isHidden = body.style.display === 'none' || body.style.display === '';
  if (isHidden) {
    body.style.display = 'block';
    btn.innerHTML = '▴ Ocultar Árbol';
    renderParseTreeContent();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    body.style.display = 'none';
    btn.innerHTML = '▾ Ver Árbol de Derivación';
  }
}

// Mostrar el panel del árbol (cabecera + botón) cuando hay árbol disponible
function setupTreeAvailability(tree, hasErrors) {
  const panel = document.getElementById('parseTreePanel');
  const body  = document.getElementById('parseTreeBody');
  const status = document.getElementById('parseTreeStatus');
  const btn   = document.getElementById('btnViewTree');

  lastParseTree = tree;

  if (!tree) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  body.style.display  = 'none'; // arranca colapsado
  btn.innerHTML       = '▾ Ver Árbol de Derivación';
  btn.disabled        = false;

  status.textContent = hasErrors ? 'Árbol parcial (con errores sintácticos)' : 'Árbol válido';
  status.className   = 'count-label ' + (hasErrors ? 'count-warn' : 'count-ok');
}

// ── Botones / control general ─────────────────────────────────────────
function updateErrorButton(errorTable, syntaxErrors) {
  const btn   = document.getElementById('btnErrors');
  const badge = document.getElementById('btnErrorBadge');
  const total = (errorTable ? errorTable.length : 0) + (syntaxErrors ? syntaxErrors.length : 0);
  if (total > 0) {
    btn.style.display = 'inline-block';
    badge.textContent = total;
  } else {
    btn.style.display = 'none';
    document.getElementById('errorTablePanel').style.display  = 'none';
    document.getElementById('syntaxErrorPanel').style.display = 'none';
  }
}

function toggleErrorTable() {
  errorTableVisible = !errorTableVisible;
  const lexPanel = document.getElementById('errorTablePanel');
  const synPanel = document.getElementById('syntaxErrorPanel');
  const btn      = document.getElementById('btnErrors');

  if (errorTableVisible) {
    if (lastErrorTable.length) {
      renderErrorTable(lastErrorTable);
      lexPanel.style.display = 'flex';
      lexPanel.style.flexDirection = 'column';
    }
    if (lastSyntaxErrors.length) {
      renderSyntaxErrors(lastSyntaxErrors);
    }
    document.getElementById('tablesRow').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const total = (lastErrorTable.length || 0) + (lastSyntaxErrors.length || 0);
    btn.innerHTML = `✕ Ocultar Errores <span id="btnErrorBadge" class="badge">${total}</span>`;
  } else {
    lexPanel.style.display = 'none';
    synPanel.style.display = 'none';
    const total = (lastErrorTable.length || 0) + (lastSyntaxErrors.length || 0);
    btn.innerHTML = `⚠ Ver Errores <span id="btnErrorBadge" class="badge">${total}</span>`;
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
  document.getElementById('errorTablePanel').style.display  = 'none';
  document.getElementById('syntaxErrorPanel').style.display = 'none';

  // 1. Análisis Léxico
  const { tokens, symbolTable, errorTable } = analyzeLexer(code);
  lastErrorTable = errorTable;

  renderTokens(tokens);
  renderStats(tokens);
  renderSymbolTable(symbolTable);
  document.getElementById('tokenCount').textContent = `${tokens.length} tokens`;

  // 2. Análisis Sintáctico
  let syntaxErrors = [];
  let parseTree    = null;
  if (typeof analyzeParser === 'function') {
    const result = analyzeParser(tokens);
    parseTree    = result.parseTree;
    syntaxErrors = result.syntaxErrors;
  }
  lastSyntaxErrors = syntaxErrors;

  setupTreeAvailability(parseTree, syntaxErrors.length > 0);

  if (syntaxErrors.length > 0) {
    renderSyntaxErrors(syntaxErrors);
  }

  updateErrorButton(errorTable, syntaxErrors);
}

function clearAll() {
  document.getElementById('sourceCode').value       = '';
  document.getElementById('results').innerHTML      = '<div class="empty-msg">Sin análisis aún. Escribe código NenScript y presiona Analizar.</div>';
  document.getElementById('tokenCount').textContent = '—';
  document.getElementById('statsBar').style.display          = 'none';
  document.getElementById('tablesRow').style.display          = 'none';
  document.getElementById('errorTablePanel').style.display    = 'none';
  document.getElementById('syntaxErrorPanel').style.display   = 'none';
  document.getElementById('parseTreePanel').style.display     = 'none';
  document.getElementById('btnErrors').style.display          = 'none';
  lastErrorTable    = [];
  lastSyntaxErrors  = [];
  lastParseTree     = null;
  errorTableVisible = false;
}

// Ejemplo de prueba con código NenScript válido
function loadExample() {
  document.getElementById('sourceCode').value =
`// Programa de ejemplo en NenScript
nen HunterExam:

    // Declaracion de variables
    gon      vida      := 100 ;
    killua   velocidad := 9.85 ;
    kurapika nombre    := "Gon Freecss" ;
    leorio   activo    := verdad ;

    // Constante con yorknew
    yorknew killua PI := 3.14 ;

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

ko`;
  analyze();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sourceCode').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyze();
  });
});