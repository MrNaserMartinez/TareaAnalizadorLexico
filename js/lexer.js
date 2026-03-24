//código lexer.js — v4: Tabla de Errores + Expresiones Regulares

const PALABRAS_RESERVADAS = new Set([
  'if', 'else', 'for', 'print', 'int',
  'asdfg',
  'ifasdfg',    'asdfgif',
  'elseasdfg',  'asdfgelse',
  'forasdfg',   'asdfgfor',
  'printasdfg', 'asdfgprint',
  'intasdfg',   'asdfgint'
]);

const OPERADORES_ARITMETICOS    = new Set(['+', '-', '*', '/']);
const OPERADORES_RELACIONALES_2 = new Set(['>=', '<=', '<>', '..']);
const OPERADORES_RELACIONALES_1 = new Set(['>', '<', '=', '{', '}', '[', ']', '(', ')', ',', ';']);

function isLetter(c) { return /[a-zA-Z]/.test(c); }
function isDigit(c)  { return /[0-9]/.test(c); }
function isAlnum(c)  { return isLetter(c) || isDigit(c); }

// ── Clasificación de tipos de error ──────────────────────────
const ERROR_TYPES = {
  IDENT_LARGO:    { tipo: 'Identificador largo',      desc: 'El identificador supera los 10 caracteres permitidos' },
  NUM_RANGO:      { tipo: 'Número fuera de rango',    desc: 'El número entero debe estar entre 0 y 100' },
  CADENA_INVALIDA:{ tipo: 'Cadena sin "asdfg"',       desc: 'Las cadenas deben contener la secuencia asdfg' },
  CHAR_INVALIDO:  { tipo: 'Carácter no reconocido',   desc: 'El carácter no pertenece al alfabeto del lenguaje' },
  ASIGN_INCOMPLETA:{ tipo: 'Asignación incompleta',   desc: 'Se encontró ":" pero se esperaba ":="' },
};

// ── Tabla de símbolos ────────────────────────────────────────

function buildSymbolTable(tokens) {
  const table = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== 'Identificador') continue;
    const nombre = tok.value;
    if (!table.has(nombre)) {
      table.set(nombre, {
        nombre,
        tipo:        inferirTipo(tokens, i),
        lineaDecl:   tok.line,
        apariciones: [tok.line],
        usos:        1
      });
    } else {
      const entry = table.get(nombre);
      if (!entry.apariciones.includes(tok.line)) entry.apariciones.push(tok.line);
      entry.usos++;
      if (entry.tipo === 'desconocido') {
        const tipoNuevo = inferirTipo(tokens, i);
        if (tipoNuevo !== 'desconocido') entry.tipo = tipoNuevo;
      }
    }
  }
  return Array.from(table.values()).sort((a, b) => a.lineaDecl - b.lineaDecl);
}

function inferirTipo(tokens, idx) {
  const prev  = tokens[idx - 1];
  const next  = tokens[idx + 1];
  const next2 = tokens[idx + 2];
  if (prev && prev.type === 'Palabra_Reservada' && prev.value.toLowerCase() === 'int') return 'int';
  if (next && next.type === 'Asignación' && next2) {
    if (next2.type === 'Número_Entero') return 'int';
    if (next2.type === 'Cadena')        return 'string';
  }
  return 'desconocido';
}

// ── Analizador léxico principal ──────────────────────────────

function analyzeLexer(source) {
  const tokens = [];
  let i = 0, lineNum = 1;

  while (i < source.length) {
    const ch = source[i];

    // Saltos de línea y espacios
    if (ch === '\n')                               { lineNum++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // Comentario de línea
    if (ch === '/' && source[i+1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    // Comentario de bloque
    if (ch === '/' && source[i+1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) {
        if (source[i] === '\n') lineNum++;
        i++;
      }
      i += 2;
      continue;
    }

    // ── Expresión regular: sintaxis /patrón/flags ──────────────
    if (ch === '/' && source[i+1] !== '/' && source[i+1] !== '*') {
      // Intentamos leer como regex solo si el char previo no es un operando (número/identificador)
      const prev = tokens[tokens.length - 1];
      const prevIsOperand = prev && (
        prev.type === 'Identificador' ||
        prev.type === 'Número_Entero' ||
        prev.type === 'Cadena'
      );
      if (!prevIsOperand) {
        let pattern = ''; let j = i + 1; let escaped = false;
        while (j < source.length) {
          const c = source[j];
          if (escaped) { pattern += c; escaped = false; j++; continue; }
          if (c === '\\') { pattern += c; escaped = true; j++; continue; }
          if (c === '/' ) { j++; break; }
          if (c === '\n') break; // regex sin cerrar → no es regex
          pattern += c; j++;
        }
        // Leer flags opcionales (g, i, m, s, u, y)
        let flags = '';
        while (j < source.length && /[gimsuy]/.test(source[j])) flags += source[j++];
        if (pattern.length > 0 && source[j - flags.length - 1] === '/') {
          // Validar que el patrón sea una regex legal
          let valid = true;
          try { new RegExp(pattern, flags); } catch { valid = false; }
          tokens.push({
            type:  valid ? 'Expresion_Regular' : 'Error',
            value: valid ? `/${pattern}/${flags}` : `/${pattern}/${flags} (regex inválida)`,
            line:  lineNum,
            errorKey: valid ? null : 'CHAR_INVALIDO'
          });
          i = j;
          continue;
        }
        // Si no resultó regex válida, cae a operador aritmético
      }
    }

    // Cadenas dobles
    if (ch === '"') {
      let str = ''; i++;
      while (i < source.length && source[i] !== '"' && source[i] !== '\n') str += source[i++];
      if (source[i] === '"') i++;
      tokens.push(str.includes('asdfg')
        ? { type: 'Cadena',  value: `"${str}"`, line: lineNum }
        : { type: 'Error',   value: `"${str}"`, line: lineNum, errorKey: 'CADENA_INVALIDA' });
      continue;
    }
    // Cadenas simples
    if (ch === "'") {
      let str = ''; i++;
      while (i < source.length && source[i] !== "'" && source[i] !== '\n') str += source[i++];
      if (source[i] === "'") i++;
      tokens.push(str.includes('asdfg')
        ? { type: 'Cadena', value: `'${str}'`, line: lineNum }
        : { type: 'Error',  value: `'${str}'`, line: lineNum, errorKey: 'CADENA_INVALIDA' });
      continue;
    }

    // Identificadores y palabras reservadas
    if (isLetter(ch)) {
      let word = '';
      while (i < source.length && isAlnum(source[i])) word += source[i++];
      if (word === 'DraSheyla')
        tokens.push({ type: 'Especial', value: word, line: lineNum });
      else if (PALABRAS_RESERVADAS.has(word.toLowerCase()))
        tokens.push({ type: 'Palabra_Reservada', value: word, line: lineNum });
      else if (word.length > 10)
        tokens.push({ type: 'Error', value: word, line: lineNum, errorKey: 'IDENT_LARGO' });
      else
        tokens.push({ type: 'Identificador', value: word, line: lineNum });
      continue;
    }

    // Números
    if (isDigit(ch)) {
      let num = '';
      while (i < source.length && isDigit(source[i])) num += source[i++];
      const val = parseInt(num, 10);
      tokens.push(val >= 0 && val <= 100
        ? { type: 'Número_Entero', value: num, line: lineNum }
        : { type: 'Error', value: num, line: lineNum, errorKey: 'NUM_RANGO' });
      continue;
    }

    // Asignación := o error :
    if (ch === ':' && source[i+1] === '=') {
      tokens.push({ type: 'Asignación', value: ':=', line: lineNum }); i += 2; continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'Error', value: ':', line: lineNum, errorKey: 'ASIGN_INCOMPLETA' }); i++; continue;
    }

    // Operadores relacionales de 2 chars
    const two = source[i] + (source[i+1] || '');
    if (OPERADORES_RELACIONALES_2.has(two)) {
      tokens.push({ type: 'Relacional', value: two, line: lineNum }); i += 2; continue;
    }

    // Operadores aritméticos
    if (OPERADORES_ARITMETICOS.has(ch)) {
      tokens.push({ type: 'Operador_Aritmético', value: ch, line: lineNum }); i++; continue;
    }

    // Operadores relacionales de 1 char
    if (OPERADORES_RELACIONALES_1.has(ch)) {
      tokens.push({ type: 'Relacional', value: ch, line: lineNum }); i++; continue;
    }

    // Carácter no reconocido
    tokens.push({ type: 'Error', value: ch, line: lineNum, errorKey: 'CHAR_INVALIDO' });
    i++;
  }

  const symbolTable = buildSymbolTable(tokens);

  // ── Construir tabla de errores ───────────────────────────────
  const errorTable = tokens
    .filter(t => t.type === 'Error')
    .map((t, idx) => {
      const key  = t.errorKey || 'CHAR_INVALIDO';
      const info = ERROR_TYPES[key] || ERROR_TYPES.CHAR_INVALIDO;
      return {
        idx:   idx + 1,
        value: t.value,
        tipo:  info.tipo,
        desc:  info.desc,
        line:  t.line
      };
    });

  return { tokens, symbolTable, errorTable };
}