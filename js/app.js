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
let treeViewMode      = 'graphical';

// Estado de zoom y pan del SVG
let zoomState = { vx: 0, vy: 0, vw: 0, vh: 0, baseW: 0, baseH: 0 };

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
// ÁRBOL DE DERIVACIÓN — Vista gráfica (SVG interactivo) y vista de texto
// ════════════════════════════════════════════════════════════════════════

function isTerminal(node) {
  return !node.children || node.children.length === 0;
}

// Cuenta los descendientes ocultos cuando un nodo está colapsado
function countDescendants(node) {
  if (!node.children) return 0;
  let n = node.children.length;
  for (const c of node.children) n += countDescendants(c);
  return n;
}

function graphicalLabel(node) {
  let label = String(node.label || '').replace(/\s*\[L\d+:C\d+\]\s*$/, '').trim();

  if (isTerminal(node)) {
    const m1 = label.match(/^'([^']+)'$/);
    if (m1) return m1[1];
    const m2 = label.match(/^[A-Za-z_]+\s*\(([^)]+)\)$/);
    if (m2) return m2[1];
    return label;
  }
  const m = label.match(/^([a-zA-Z_]+)\s*\(([^)]+)\)$/);
  if (m) return `<${m[1]}> ${m[2]}`;
  return `<${label}>`;
}

// Considera el estado _collapsed: si el nodo está colapsado, sus hijos no se cuentan
function isEffectivelyTerminal(node) {
  return isTerminal(node) || node._collapsed;
}

function computeSubtreeWidth(node) {
  if (isEffectivelyTerminal(node)) { node._w = 1; return 1; }
  let total = 0;
  for (const c of node.children) total += computeSubtreeWidth(c);
  node._w = Math.max(total, 1);
  return node._w;
}

function computeLayout(node, x = 0, depth = 0) {
  if (isEffectivelyTerminal(node)) {
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
  if (isEffectivelyTerminal(node)) return node._d;
  return Math.max(...node.children.map(c => maxDepth(c)));
}

function flattenVisibleNodes(node, list = []) {
  list.push(node);
  if (node._collapsed) return list;
  if (node.children) for (const c of node.children) flattenVisibleNodes(c, list);
  return list;
}

// Genera el SVG del árbol con interactividad completa
function buildTreeSVG(tree) {
  if (!tree) return null;

  computeSubtreeWidth(tree);
  computeLayout(tree);

  const slotW = 130;
  const levelH = 78;
  const padding = 30;
  const nodeW = 110;
  const nodeH = 32;

  const totalLeaves = tree._w;
  const depth = maxDepth(tree);
  const width  = totalLeaves * slotW + padding * 2;
  const height = (depth + 1) * levelH + padding * 2;

  // Guardar dimensiones base para el reset de zoom
  zoomState.baseW = width;
  zoomState.baseH = height;
  zoomState.vx = 0;
  zoomState.vy = 0;
  zoomState.vw = width;
  zoomState.vh = height;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'parse-tree-svg');
  svg.style.width  = '100%';
  svg.style.height = '600px';

  const px = (x) => padding + x * slotW;
  const py = (d) => padding + d * levelH + nodeH / 2;

  // Capa de líneas (edges)
  const edgesGroup = document.createElementNS(svgNS, 'g');
  edgesGroup.setAttribute('class', 'tree-edges');
  svg.appendChild(edgesGroup);

  // Capa de nodos
  const nodesGroup = document.createElementNS(svgNS, 'g');
  nodesGroup.setAttribute('class', 'tree-nodes');
  svg.appendChild(nodesGroup);

  const visibleNodes = flattenVisibleNodes(tree);

  // Dibujar líneas
  for (const n of visibleNodes) {
    if (n._collapsed) continue;
    if (!n.children) continue;
    const x1 = px(n._x);
    const y1 = py(n._d) + nodeH / 2;
    for (const c of n.children) {
      const x2 = px(c._x);
      const y2 = py(c._d) - nodeH / 2;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'tree-edge');
      edgesGroup.appendChild(line);
    }
  }

  // Dibujar nodos
  for (const n of visibleNodes) {
    const cx = px(n._x);
    const cy = py(n._d);
    const terminal       = isTerminal(n);
    const collapsed      = !!n._collapsed;
    const clickable      = !terminal;

    let cls = 'tree-rect ';
    if (terminal)       cls += 'tree-rect-terminal';
    else if (collapsed) cls += 'tree-rect-collapsed';
    else                cls += 'tree-rect-nonterminal';

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('transform', `translate(${cx - nodeW/2}, ${cy - nodeH/2})`);
    g.setAttribute('class', 'tree-node-group' + (clickable ? ' tree-node-clickable' : ''));

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width',  nodeW);
    rect.setAttribute('height', nodeH);
    rect.setAttribute('rx', 6);
    rect.setAttribute('ry', 6);
    rect.setAttribute('class', cls);
    g.appendChild(rect);

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', nodeW / 2);
    text.setAttribute('y', nodeH / 2);
    text.setAttribute('class', terminal ? 'tree-text tree-text-terminal' : 'tree-text tree-text-nonterminal');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');

    let lbl = graphicalLabel(n);
    if (collapsed) {
      const hidden = countDescendants(n);
      lbl += ` ▸${hidden}`;
    }
    if (lbl.length > 16) lbl = lbl.slice(0, 14) + '…';
    text.textContent = lbl;

    const title = document.createElementNS(svgNS, 'title');
    let tt = n.label;
    if (n.token) tt += ` — L${n.token.line}:C${n.token.column}`;
    if (clickable) tt += collapsed ? ' (click para expandir)' : ' (click para colapsar)';
    title.textContent = tt;
    g.appendChild(title);

    g.appendChild(text);

    // Click handler para colapsar/expandir
    if (clickable) {
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        n._collapsed = !n._collapsed;
        renderParseTreeContent();
      });
    }

    nodesGroup.appendChild(g);
  }

  return svg;
}

// ── Zoom / Pan / Reset ────────────────────────────────────────────────
function applyViewBox() {
  const svg = document.querySelector('.parse-tree-svg');
  if (!svg) return;
  svg.setAttribute('viewBox',
    `${zoomState.vx} ${zoomState.vy} ${zoomState.vw} ${zoomState.vh}`);

  // Mostrar el porcentaje actual de zoom
  const pct = Math.round((zoomState.baseW / zoomState.vw) * 100);
  const indicator = document.getElementById('zoomIndicator');
  if (indicator) indicator.textContent = `${pct}%`;
}

function zoomBy(factor, anchorX, anchorY) {
  // anchorX/Y en coordenadas relativas (0..1) del SVG
  const newW = zoomState.vw * factor;
  const newH = zoomState.vh * factor;

  // Mantener el punto bajo el cursor estable
  if (anchorX !== undefined && anchorY !== undefined) {
    zoomState.vx += (zoomState.vw - newW) * anchorX;
    zoomState.vy += (zoomState.vh - newH) * anchorY;
  } else {
    zoomState.vx += (zoomState.vw - newW) / 2;
    zoomState.vy += (zoomState.vh - newH) / 2;
  }
  zoomState.vw = newW;
  zoomState.vh = newH;
  applyViewBox();
}

function zoomIn()  { zoomBy(0.8); }
function zoomOut() { zoomBy(1.25); }
function zoomReset() {
  zoomState.vx = 0;
  zoomState.vy = 0;
  zoomState.vw = zoomState.baseW;
  zoomState.vh = zoomState.baseH;
  applyViewBox();
}

function expandAll() {
  function uncollapse(n) {
    n._collapsed = false;
    if (n.children) for (const c of n.children) uncollapse(c);
  }
  if (lastParseTree) uncollapse(lastParseTree);
  renderParseTreeContent();
}

function attachSvgInteractivity(svg) {
  if (!svg) return;

  // Wheel zoom
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const ax = (e.clientX - rect.left) / rect.width;
    const ay = (e.clientY - rect.top)  / rect.height;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    zoomBy(factor, ax, ay);
  }, { passive: false });

  // Drag pan
  let panning = false;
  let panStart = null;
  svg.addEventListener('mousedown', (e) => {
    // Solo paneamos si NO estamos sobre un nodo clickeable (para no robar clicks)
    if (e.target.closest('.tree-node-clickable')) return;
    panning = true;
    panStart = { cx: e.clientX, cy: e.clientY, vx: zoomState.vx, vy: zoomState.vy };
    svg.classList.add('parse-tree-svg-panning');
  });
  window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    const rect = svg.getBoundingClientRect();
    const ratioX = zoomState.vw / rect.width;
    const ratioY = zoomState.vh / rect.height;
    zoomState.vx = panStart.vx - (e.clientX - panStart.cx) * ratioX;
    zoomState.vy = panStart.vy - (e.clientY - panStart.cy) * ratioY;
    applyViewBox();
  });
  window.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    svg.classList.remove('parse-tree-svg-panning');
  });
}

// Vista TEXTO (jerarquía indentada)
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

// Renderiza el árbol según el modo activo
function renderParseTreeContent() {
  const container = document.getElementById('parseTreeContainer');
  const toolbar2  = document.getElementById('treeToolbar2');
  if (!container) return;
  container.innerHTML = '';

  if (!lastParseTree) {
    container.innerHTML = '<div class="empty-msg">No hay árbol para mostrar.</div>';
    if (toolbar2) toolbar2.style.display = 'none';
    return;
  }

  if (treeViewMode === 'graphical') {
    container.classList.add('tree-graphical');
    container.classList.remove('tree-textual');
    if (toolbar2) toolbar2.style.display = 'flex';

    const svg = buildTreeSVG(lastParseTree);
    if (svg) {
      container.appendChild(svg);
      attachSvgInteractivity(svg);
      applyViewBox();
    }
  } else {
    container.classList.add('tree-textual');
    container.classList.remove('tree-graphical');
    if (toolbar2) toolbar2.style.display = 'none';
    container.appendChild(buildTextTree(lastParseTree));
  }

  document.getElementById('btnTreeGraphical').classList.toggle('btn-toggle-active', treeViewMode === 'graphical');
  document.getElementById('btnTreeTextual').classList.toggle('btn-toggle-active', treeViewMode === 'text');
}

function setTreeView(mode) {
  treeViewMode = mode;
  renderParseTreeContent();
}

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

function setupTreeAvailability(tree, hasErrors) {
  const panel  = document.getElementById('parseTreePanel');
  const body   = document.getElementById('parseTreeBody');
  const status = document.getElementById('parseTreeStatus');
  const btn    = document.getElementById('btnViewTree');

  lastParseTree = tree;

  if (!tree) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  body.style.display  = 'none';
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
    if (lastSyntaxErrors.length) renderSyntaxErrors(lastSyntaxErrors);
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

  const { tokens, symbolTable, errorTable } = analyzeLexer(code);
  lastErrorTable = errorTable;

  renderTokens(tokens);
  renderStats(tokens);
  renderSymbolTable(symbolTable);
  document.getElementById('tokenCount').textContent = `${tokens.length} tokens`;

  let syntaxErrors = [];
  let parseTree    = null;
  if (typeof analyzeParser === 'function') {
    const result = analyzeParser(tokens);
    parseTree    = result.parseTree;
    syntaxErrors = result.syntaxErrors;
  }
  lastSyntaxErrors = syntaxErrors;

  setupTreeAvailability(parseTree, syntaxErrors.length > 0);

  if (syntaxErrors.length > 0) renderSyntaxErrors(syntaxErrors);

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

// ════════════════════════════════════════════════════════════
//  PANTALLA DE BIENVENIDA + SELECTOR DE TEMA (Gon / Killua)
// ════════════════════════════════════════════════════════════

// Bienvenida → selector de tema
function enterCompiler() {
  const welcome = document.getElementById('welcomeOverlay');
  const picker  = document.getElementById('themePicker');

  // FIX BUG 1: Mostramos el selector de tema ANTES de iniciar el fade del
  // welcome, así queda debajo del overlay que se desvanece y el compilador
  // nunca queda expuesto durante la transición.
  picker.style.display = 'flex';
  picker.classList.remove('overlay-hide');

  welcome.classList.add('overlay-hide');
  setTimeout(() => {
    welcome.style.display = 'none';
  }, 380);
}

// Aplicar tema y cerrar el selector
function chooseTheme(theme) {
  applyTheme(theme);

  // FIX BUG 2: applyTheme() solo llama a startMusicForTheme() cuando
  // musicEnabled ya es true, pero en la primera selección musicEnabled=false,
  // por lo que la música nunca arrancaba. Lo llamamos directamente aquí porque
  // elegir el tema ES la interacción de usuario que desbloquea el autoplay.
  startMusicForTheme(theme);

  const picker = document.getElementById('themePicker');
  picker.classList.add('overlay-hide');
  setTimeout(() => {
    picker.style.display = 'none';
  }, 380);
}

// Toggle Gon ↔ Killua (botón en cabecera)
function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'gon';
  applyTheme(current === 'gon' ? 'killua' : 'gon');
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  // Persistir preferencia (sobrevive recargas, no afecta el flujo de bienvenida)
  try { localStorage.setItem('nenscript-theme', theme); } catch (e) { /* ignore */ }
  // Re-renderizar el árbol gráfico para que los colores SVG se actualicen
  if (lastParseTree && document.getElementById('parseTreeBody').style.display === 'block') {
    renderParseTreeContent();
  }
  // Cambiar la canción al tema activo (si la música ya está habilitada)
  if (musicEnabled) startMusicForTheme(theme);
  updateMusicPlayerUI();
}

// ════════════════════════════════════════════════════════════
//  REPRODUCTOR DE MÚSICA POR TEMA (Gon / Killua)
// ════════════════════════════════════════════════════════════

let currentAudio = null;
let audioVolume  = 0.5;     // 0..1
let isMuted      = false;
let musicEnabled = false;   // se activa al elegir tema (interacción del usuario)

function _audioFor(theme) {
  return document.getElementById(theme === 'killua' ? 'audioKillua' : 'audioGon');
}

function _fade(audio, fromV, toV, ms = 600, onDone) {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = fromV + (toV - fromV) * t;
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  audio.volume = fromV;
  requestAnimationFrame(step);
}

function startMusicForTheme(theme) {
  const next = _audioFor(theme);
  if (!next) return;

  // Si ya estaba sonando este mismo audio, no reiniciar
  if (currentAudio === next && !next.paused) { updateMusicPlayerUI(); return; }

  // Fade out del audio anterior
  if (currentAudio && currentAudio !== next) {
    const old = currentAudio;
    _fade(old, old.volume, 0, 500, () => { old.pause(); old.currentTime = 0; });
  }

  currentAudio = next;
  next.muted   = isMuted;
  next.volume  = 0;
  const playPromise = next.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch((err) => {
      // Autoplay bloqueado o archivo no disponible — el usuario puede usar play manual
      console.warn('[NenScript] No se pudo reproducir música automáticamente:', err);
    });
  }
  _fade(next, 0, isMuted ? 0 : audioVolume, 700);

  musicEnabled = true;
  showMusicPlayer();
  updateMusicPlayerUI();
}

function toggleMusic() {
  if (!currentAudio) return;
  const btn = document.getElementById('btnMusicToggle');
  if (currentAudio.paused) {
    currentAudio.play().catch(() => {});
    btn.textContent = '⏸';
  } else {
    currentAudio.pause();
    btn.textContent = '▶';
  }
  updateMusicPlayerUI();
}

function volUp() {
  audioVolume = Math.min(1, +(audioVolume + 0.10).toFixed(2));
  if (isMuted) muteMusic(); // si estaba muteado y suben, des-mutea
  if (currentAudio && !isMuted) currentAudio.volume = audioVolume;
  saveAudioPrefs();
  updateMusicPlayerUI();
}

function volDown() {
  audioVolume = Math.max(0, +(audioVolume - 0.10).toFixed(2));
  if (currentAudio && !isMuted) currentAudio.volume = audioVolume;
  saveAudioPrefs();
  updateMusicPlayerUI();
}

function muteMusic() {
  isMuted = !isMuted;
  if (currentAudio) currentAudio.volume = isMuted ? 0 : audioVolume;
  document.getElementById('btnMute').textContent = isMuted ? '🔇' : '🔊';
  document.getElementById('musicPlayer').classList.toggle('is-muted', isMuted);
  saveAudioPrefs();
  updateMusicPlayerUI();
}

function showMusicPlayer() {
  document.getElementById('musicPlayer').style.display = 'flex';
}

function updateMusicPlayerUI() {
  const player = document.getElementById('musicPlayer');
  const art    = document.getElementById('musicArt');
  const title  = document.getElementById('musicTitle');
  const ind    = document.getElementById('volIndicator');
  const btnT   = document.getElementById('btnMusicToggle');
  if (!player) return;

  const theme = document.body.getAttribute('data-theme') || 'gon';
  art.textContent   = theme === 'killua' ? 'K' : 'G';
  title.textContent = theme === 'killua' ? 'Tema Killua' : 'Tema Gon';
  ind.textContent   = isMuted ? 'mute' : (Math.round(audioVolume * 100) + '%');

  const playing = currentAudio && !currentAudio.paused && !isMuted;
  art.classList.toggle('is-playing', !!playing);
  if (btnT) btnT.textContent = (currentAudio && !currentAudio.paused) ? '⏸' : '▶';
}

function saveAudioPrefs() {
  try {
    localStorage.setItem('nenscript-volume', String(audioVolume));
    localStorage.setItem('nenscript-muted', isMuted ? '1' : '0');
  } catch (e) { /* ignore */ }
}

function restoreAudioPrefs() {
  try {
    const v = parseFloat(localStorage.getItem('nenscript-volume'));
    if (!isNaN(v) && v >= 0 && v <= 1) audioVolume = v;
    isMuted = localStorage.getItem('nenscript-muted') === '1';
  } catch (e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sourceCode').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyze();
  });
  // Restaurar tema persistido
  try {
    const saved = localStorage.getItem('nenscript-theme');
    if (saved === 'gon' || saved === 'killua') {
      document.body.setAttribute('data-theme', saved);
    }
  } catch (e) { /* ignore */ }
  // Restaurar volumen y estado mute persistidos
  restoreAudioPrefs();
});