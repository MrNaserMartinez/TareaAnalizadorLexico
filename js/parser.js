// parser.js — Analizador Sintáctico de NenScript (descenso recursivo)
// Consume los tokens producidos por el lexer y construye un árbol de derivación.
// Reporta errores sintácticos con línea y columna, y aplica recuperación
// en modo pánico hasta el siguiente ';' o 'ko' para seguir parseando.

function analyzeParser(tokens) {
  // Filtrar tokens que el parser no debe ver: Error y Especial (easter egg)
  const stream = tokens.filter(t => t.type !== 'Error' && t.type !== 'Especial');
  const errors = [];
  let pos = 0;

  // ── Helpers de cursor ──────────────────────────────────────────────────
  const peek    = (off = 0) => stream[pos + off];
  const isEnd   = () => pos >= stream.length;
  const advance = () => stream[pos++];

  function check(type, value) {
    const tok = peek();
    if (!tok) return false;
    if (tok.type !== type) return false;
    if (value !== undefined && tok.value !== value) return false;
    return true;
  }

  function match(type, value) {
    if (check(type, value)) return advance();
    return null;
  }

  function expect(type, value, mensaje) {
    const tok = peek();
    if (check(type, value)) return advance();
    const desc = value
      ? `Se esperaba ${value !== undefined ? `'${value}'` : type}`
      : `Se esperaba un token de tipo ${type}`;
    error(mensaje || desc, tok);
    return null;
  }

  function error(mensaje, tok) {
    const t = tok || peek() || stream[stream.length - 1] || { line: 1, column: 1, value: 'EOF' };
    errors.push({
      idx:    errors.length + 1,
      tipo:   'Error sintáctico',
      desc:   mensaje,
      value:  t.value !== undefined ? String(t.value) : 'EOF',
      line:   t.line   || 1,
      column: t.column || 1,
    });
  }

  // Recuperación en modo pánico: avanza hasta ';' o 'ko' o un keyword de bloque
  function syncToStatementBoundary() {
    while (!isEnd()) {
      const tok = peek();
      if (tok.type === 'Delimitador' && tok.value === ';') { advance(); return; }
      if (tok.type === 'Palabra_Reservada' && (
            tok.value === 'ko'     || tok.value === 'nen'    ||
            tok.value === 'ryodan' || tok.value === 'ten'    ||
            tok.value === 'ken'    || tok.value === 'hatsu'  ||
            tok.value === 'illumi' || tok.value === 'hisoka'
          )) return;
      advance();
    }
  }

  // ── Constructores de nodos ─────────────────────────────────────────────
  const node = (label, children = [], extra = {}) => ({ label, children, ...extra });
  const leaf = (label, tok) => ({
    label,
    children: [],
    token: tok ? { value: tok.value, line: tok.line, column: tok.column, type: tok.type } : undefined,
  });

  // ── Reglas gramaticales ────────────────────────────────────────────────

  // programa ::= "nen" IDENT ":" lista_inst "ko"
  function parsePrograma() {
    const root = node('programa');
    const nenTok = expect('Palabra_Reservada', 'nen', "Todo programa debe iniciar con 'nen'");
    if (nenTok) root.children.push(leaf("'nen'", nenTok));

    const id = expect('Identificador', undefined, "Se esperaba el nombre del programa después de 'nen'");
    if (id) root.children.push(leaf(`IDENT (${id.value})`, id));

    const colon = expect('Delimitador', ':', "Se esperaba ':' después del nombre del programa");
    if (colon) root.children.push(leaf("':'", colon));

    const lista = parseListaInst(['Palabra_Reservada::ko']);
    root.children.push(lista);

    const koTok = expect('Palabra_Reservada', 'ko', "Se esperaba 'ko' para cerrar el programa");
    if (koTok) root.children.push(leaf("'ko'", koTok));

    if (!isEnd()) {
      error('Tokens inesperados después del cierre del programa', peek());
    }
    return root;
  }

  // lista_inst ::= { instruccion }
  function parseListaInst(stopAt = []) {
    const lista = node('lista_inst');
    while (!isEnd()) {
      const tok = peek();
      // Stop conditions (terminadores de bloque)
      if (tok.type === 'Palabra_Reservada' &&
          (tok.value === 'ko' || tok.value === 'illumi' || tok.value === 'hisoka')) break;

      const inst = parseInstruccion();
      if (inst) lista.children.push(inst);
    }
    return lista;
  }

  // instruccion ::= ...
  function parseInstruccion() {
    const tok = peek();
    if (!tok) return null;

    try {
      if (tok.type === 'Palabra_Reservada') {
        switch (tok.value) {
          case 'gon':
          case 'killua':
          case 'kurapika':
          case 'leorio':
            return parseDeclaracionInst();
          case 'yorknew':
            return parseDeclaracionConstInst();
          case 'shu':
            return parsePrintInst();
          case 'in':
            return parseInputInst();
          case 'zetsu':
            return parseReturnInst();
          case 'gura':
            return parseSimpleKeywordInst('gura', 'break_inst');
          case 'ren':
            return parseSimpleKeywordInst('ren', 'continue_inst');
          case 'ryodan':
            return parseCondicional();
          case 'ten':
            return parseCicloWhile();
          case 'ken':
            return parseCicloFor();
          case 'hatsu':
            return parseDeclaracionFuncion();
          default:
            error(`Palabra reservada '${tok.value}' inesperada al inicio de instrucción`, tok);
            advance();
            syncToStatementBoundary();
            return null;
        }
      }

      if (tok.type === 'Identificador') {
        // Puede ser asignación (IDENT :=) o llamada a función (IDENT ()
        const next = peek(1);
        if (next && next.type === 'Asignación')          return parseAsignacionInst();
        if (next && next.type === 'Delimitador' && next.value === '(') return parseLlamadaInst();
        error("Se esperaba ':=' o '(' después del identificador", next || tok);
        syncToStatementBoundary();
        return null;
      }

      error(`Token inesperado '${tok.value}' al inicio de instrucción`, tok);
      advance();
      syncToStatementBoundary();
      return null;

    } catch (e) {
      // No debería ocurrir; modo pánico
      syncToStatementBoundary();
      return null;
    }
  }

  // declaracion ::= tipo IDENT [":=" expresion]    + ";"
  function parseDeclaracionInst() {
    const decl = node('declaracion');
    const tipoTok = advance(); // gon|killua|kurapika|leorio
    decl.children.push(leaf(`tipo (${tipoTok.value})`, tipoTok));

    const id = expect('Identificador', undefined, "Se esperaba un identificador después del tipo");
    if (id) decl.children.push(leaf(`IDENT (${id.value})`, id));

    if (check('Asignación')) {
      const asig = advance();
      decl.children.push(leaf("':='", asig));
      const expr = parseExpresion();
      if (expr) decl.children.push(expr);
    }
    expect('Delimitador', ';', "Falta ';' al final de la declaración");
    return decl;
  }

  // declaracion_const ::= "yorknew" tipo IDENT ":=" expresion + ";"
  function parseDeclaracionConstInst() {
    const decl = node('declaracion_const');
    const yorkTok = advance(); // yorknew
    decl.children.push(leaf("'yorknew'", yorkTok));

    const tipoTok = peek();
    if (!tipoTok || tipoTok.type !== 'Palabra_Reservada' ||
        !['gon','killua','kurapika','leorio'].includes(tipoTok.value)) {
      error("Después de 'yorknew' se esperaba un tipo (gon, killua, kurapika, leorio)", tipoTok);
    } else {
      advance();
      decl.children.push(leaf(`tipo (${tipoTok.value})`, tipoTok));
    }

    const id = expect('Identificador', undefined, "Se esperaba un identificador para la constante");
    if (id) decl.children.push(leaf(`IDENT (${id.value})`, id));

    expect('Asignación', undefined, "Una constante con yorknew requiere ':=' y un valor");
    const expr = parseExpresion();
    if (expr) decl.children.push(expr);
    expect('Delimitador', ';', "Falta ';' al final de la declaración constante");
    return decl;
  }

  // asignacion ::= IDENT ":=" expresion + ";"
  function parseAsignacionInst() {
    const asig = node('asignacion');
    const id = advance();
    asig.children.push(leaf(`IDENT (${id.value})`, id));
    const op = expect('Asignación', undefined, "Se esperaba ':=' en la asignación");
    if (op) asig.children.push(leaf("':='", op));
    const expr = parseExpresion();
    if (expr) asig.children.push(expr);
    expect('Delimitador', ';', "Falta ';' al final de la asignación");
    return asig;
  }

  // llamada como instrucción: IDENT "(" [args] ")" ";"
  function parseLlamadaInst() {
    const inst = node('llamada_inst');
    inst.children.push(parseLlamadaFuncion());
    expect('Delimitador', ';', "Falta ';' al final de la llamada");
    return inst;
  }

  // llamada_funcion ::= IDENT "(" [lista_args] ")"
  function parseLlamadaFuncion() {
    const lf = node('llamada_funcion');
    const id = advance();
    lf.children.push(leaf(`IDENT (${id.value})`, id));
    expect('Delimitador', '(', "Se esperaba '(' después del nombre de la función");
    if (!check('Delimitador', ')')) {
      const args = node('lista_args');
      const e1 = parseExpresion(); if (e1) args.children.push(e1);
      while (match('Delimitador', ',')) {
        const en = parseExpresion(); if (en) args.children.push(en);
      }
      lf.children.push(args);
    }
    expect('Delimitador', ')', "Se esperaba ')' para cerrar la llamada");
    return lf;
  }

  // shu (expr) ;
  function parsePrintInst() {
    const inst = node('print_inst');
    const kw = advance();
    inst.children.push(leaf("'shu'", kw));
    expect('Delimitador', '(', "Se esperaba '(' después de 'shu'");
    const expr = parseExpresion();
    if (expr) inst.children.push(expr);
    expect('Delimitador', ')', "Se esperaba ')' después de la expresión de shu");
    expect('Delimitador', ';', "Falta ';' al final de shu");
    return inst;
  }

  // in (IDENT) ;
  function parseInputInst() {
    const inst = node('input_inst');
    const kw = advance();
    inst.children.push(leaf("'in'", kw));
    expect('Delimitador', '(', "Se esperaba '(' después de 'in'");
    const id = expect('Identificador', undefined, "Se esperaba un identificador dentro de in()");
    if (id) inst.children.push(leaf(`IDENT (${id.value})`, id));
    expect('Delimitador', ')', "Se esperaba ')' después del identificador de in");
    expect('Delimitador', ';', "Falta ';' al final de in");
    return inst;
  }

  // zetsu [expr] ;
  function parseReturnInst() {
    const inst = node('return_inst');
    const kw = advance();
    inst.children.push(leaf("'zetsu'", kw));
    if (!check('Delimitador', ';')) {
      const expr = parseExpresion();
      if (expr) inst.children.push(expr);
    }
    expect('Delimitador', ';', "Falta ';' al final de zetsu");
    return inst;
  }

  // gura ; / ren ;
  function parseSimpleKeywordInst(name, label) {
    const inst = node(label);
    const kw = advance();
    inst.children.push(leaf(`'${name}'`, kw));
    expect('Delimitador', ';', `Falta ';' al final de ${name}`);
    return inst;
  }

  // condicional ::= "ryodan" expr ":" lista_inst {"illumi" expr ":" lista_inst} ["hisoka" ":" lista_inst] "ko"
  function parseCondicional() {
    const cond = node('condicional');
    const kw = advance();
    cond.children.push(leaf("'ryodan'", kw));

    const e = parseExpresion(); if (e) cond.children.push(e);
    expect('Delimitador', ':', "Se esperaba ':' después de la condición de ryodan");
    cond.children.push(parseListaInst());

    while (check('Palabra_Reservada', 'illumi')) {
      const ill = advance();
      const ramaIll = node("rama_illumi", [ leaf("'illumi'", ill) ]);
      const e2 = parseExpresion(); if (e2) ramaIll.children.push(e2);
      expect('Delimitador', ':', "Se esperaba ':' después de la condición de illumi");
      ramaIll.children.push(parseListaInst());
      cond.children.push(ramaIll);
    }

    if (check('Palabra_Reservada', 'hisoka')) {
      const his = advance();
      const ramaHis = node("rama_hisoka", [ leaf("'hisoka'", his) ]);
      expect('Delimitador', ':', "Se esperaba ':' después de 'hisoka'");
      ramaHis.children.push(parseListaInst());
      cond.children.push(ramaHis);
    }

    const ko = expect('Palabra_Reservada', 'ko', "Se esperaba 'ko' para cerrar el condicional");
    if (ko) cond.children.push(leaf("'ko'", ko));
    return cond;
  }

  // ten expr : lista_inst ko
  function parseCicloWhile() {
    const cw = node('ciclo_while');
    const kw = advance();
    cw.children.push(leaf("'ten'", kw));
    const e = parseExpresion(); if (e) cw.children.push(e);
    expect('Delimitador', ':', "Se esperaba ':' después de la condición de ten");
    cw.children.push(parseListaInst());
    const ko = expect('Palabra_Reservada', 'ko', "Se esperaba 'ko' para cerrar el ciclo ten");
    if (ko) cw.children.push(leaf("'ko'", ko));
    return cw;
  }

  // ken decl ; expr ; asignacion : lista_inst ko
  function parseCicloFor() {
    const cf = node('ciclo_for');
    const kw = advance();
    cf.children.push(leaf("'ken'", kw));

    // declaración inicial (sin punto y coma final, lo consumimos manualmente)
    if (peek() && peek().type === 'Palabra_Reservada' &&
        ['gon','killua','kurapika','leorio'].includes(peek().value)) {
      const decl = node('decl_init');
      const tipoTok = advance();
      decl.children.push(leaf(`tipo (${tipoTok.value})`, tipoTok));
      const id = expect('Identificador', undefined, "Se esperaba identificador en la inicialización del ciclo ken");
      if (id) decl.children.push(leaf(`IDENT (${id.value})`, id));
      if (match('Asignación')) {
        const e = parseExpresion();
        if (e) decl.children.push(e);
      }
      cf.children.push(decl);
    } else {
      error("La inicialización de 'ken' debe ser una declaración con tipo", peek());
    }
    expect('Delimitador', ';', "Falta ';' después de la inicialización en ken");

    const condExpr = parseExpresion(); if (condExpr) cf.children.push(condExpr);
    expect('Delimitador', ';', "Falta ';' después de la condición en ken");

    // paso: asignación sin ;
    if (peek() && peek().type === 'Identificador') {
      const asig = node('paso');
      const id = advance();
      asig.children.push(leaf(`IDENT (${id.value})`, id));
      expect('Asignación', undefined, "Se esperaba ':=' en el paso del ciclo ken");
      const e = parseExpresion();
      if (e) asig.children.push(e);
      cf.children.push(asig);
    } else {
      error("El paso de 'ken' debe ser una asignación", peek());
    }
    expect('Delimitador', ':', "Se esperaba ':' después del paso de ken");
    cf.children.push(parseListaInst());
    const ko = expect('Palabra_Reservada', 'ko', "Se esperaba 'ko' para cerrar el ciclo ken");
    if (ko) cf.children.push(leaf("'ko'", ko));
    return cf;
  }

  // hatsu IDENT (params) : lista_inst ko
  function parseDeclaracionFuncion() {
    const fn = node('declaracion_funcion');
    const kw = advance();
    fn.children.push(leaf("'hatsu'", kw));
    const id = expect('Identificador', undefined, "Se esperaba el nombre de la función después de 'hatsu'");
    if (id) fn.children.push(leaf(`IDENT (${id.value})`, id));
    expect('Delimitador', '(', "Se esperaba '(' después del nombre de la función");
    if (!check('Delimitador', ')')) {
      const params = node('lista_params');
      params.children.push(parseParametro());
      while (match('Delimitador', ',')) params.children.push(parseParametro());
      fn.children.push(params);
    }
    expect('Delimitador', ')', "Se esperaba ')' para cerrar la lista de parámetros");
    expect('Delimitador', ':', "Se esperaba ':' antes del cuerpo de la función");
    fn.children.push(parseListaInst());
    const ko = expect('Palabra_Reservada', 'ko', "Se esperaba 'ko' para cerrar la función");
    if (ko) fn.children.push(leaf("'ko'", ko));
    return fn;
  }

  function parseParametro() {
    const par = node('parametro');
    const tipoTok = peek();
    if (!tipoTok || tipoTok.type !== 'Palabra_Reservada' ||
        !['gon','killua','kurapika','leorio'].includes(tipoTok.value)) {
      error("Se esperaba un tipo (gon, killua, kurapika, leorio) para el parámetro", tipoTok);
    } else {
      advance();
      par.children.push(leaf(`tipo (${tipoTok.value})`, tipoTok));
    }
    const id = expect('Identificador', undefined, "Se esperaba el nombre del parámetro");
    if (id) par.children.push(leaf(`IDENT (${id.value})`, id));
    return par;
  }

  // ── Expresiones (precedencia ascendente) ───────────────────────────────

  function parseExpresion() {
    return parseExprLogica();
  }

  function parseExprLogica() {
    let left = parseExprComparacion();
    while (check('Operador_Lógico', '&&') || check('Operador_Lógico', '||')) {
      const op = advance();
      const right = parseExprComparacion();
      left = node(`expr_logica (${op.value})`, [left, right].filter(Boolean));
    }
    return left;
  }

  function parseExprComparacion() {
    const left = parseExprAritmetica();
    if (check('Relacional')) {
      const op = advance();
      const right = parseExprAritmetica();
      return node(`expr_comparacion (${op.value})`, [left, right].filter(Boolean));
    }
    return left;
  }

  function parseExprAritmetica() {
    let left = parseTermino();
    while (check('Operador_Aritmético', '+') || check('Operador_Aritmético', '-')) {
      const op = advance();
      const right = parseTermino();
      left = node(`expr_aritmetica (${op.value})`, [left, right].filter(Boolean));
    }
    return left;
  }

  function parseTermino() {
    let left = parseFactor();
    while (check('Operador_Aritmético', '*') ||
           check('Operador_Aritmético', '/') ||
           check('Operador_Aritmético', '%')) {
      const op = advance();
      const right = parseFactor();
      left = node(`termino (${op.value})`, [left, right].filter(Boolean));
    }
    return left;
  }

  function parseFactor() {
    const tok = peek();
    if (!tok) { error("Se esperaba un factor (literal, identificador o expresión)", tok); return null; }

    // Unario !
    if (tok.type === 'Operador_Lógico' && tok.value === '!') {
      advance();
      const f = parseFactor();
      return node("factor_unario (!)", [f].filter(Boolean));
    }
    // Unario -
    if (tok.type === 'Operador_Aritmético' && tok.value === '-') {
      advance();
      const f = parseFactor();
      return node("factor_unario (-)", [f].filter(Boolean));
    }
    // Paréntesis
    if (tok.type === 'Delimitador' && tok.value === '(') {
      advance();
      const e = parseExpresion();
      expect('Delimitador', ')', "Falta ')' para cerrar la expresión entre paréntesis");
      return node("factor (paréntesis)", [e].filter(Boolean));
    }
    // Literales
    if (tok.type === 'Número_Entero')  { advance(); return leaf(`ENTERO (${tok.value})`,  tok); }
    if (tok.type === 'Número_Decimal') { advance(); return leaf(`DECIMAL (${tok.value})`, tok); }
    if (tok.type === 'Cadena')         { advance(); return leaf(`CADENA (${tok.value})`,  tok); }
    if (tok.type === 'Booleano')       { advance(); return leaf(`BOOLEANO (${tok.value})`,tok); }
    // Identificador o llamada a función
    if (tok.type === 'Identificador') {
      const next = peek(1);
      if (next && next.type === 'Delimitador' && next.value === '(') {
        return parseLlamadaFuncion();
      }
      advance();
      return leaf(`IDENT (${tok.value})`, tok);
    }

    error(`Token inesperado '${tok.value}' en una expresión`, tok);
    advance();
    return null;
  }

  // ── Punto de entrada ───────────────────────────────────────────────────
  let parseTree = null;
  if (stream.length === 0) {
    error("El archivo no contiene tokens analizables", null);
  } else {
    parseTree = parsePrograma();
  }

  return { parseTree, syntaxErrors: errors };
}