//código lexer.js

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


function buildSymbolTable(tokens) {

  const table = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type !== 'Identificador') continue;

    const nombre = tok.value;

    if (!table.has(nombre)) {
      table.set(nombre, {
        nombre,
        tipo:       inferirTipo(tokens, i),
        lineaDecl:  tok.line,
        apariciones: [tok.line],
        usos:       1
      });
    } else {
      const entry = table.get(nombre);
      if (!entry.apariciones.includes(tok.line)) {
        entry.apariciones.push(tok.line);
      }
      entry.usos++;

      if (entry.tipo === 'desconocido') {
        const tipoNuevo = inferirTipo(tokens, i);
        if (tipoNuevo !== 'desconocido') entry.tipo = tipoNuevo;
      }
    }
  }

  return Array.from(table.values()).sort((a, b) => a.lineaDecl - b.lineaDecl);
}

/**
 * @param {Array}  
 * @param {number} 
 * @returns {string} 
 */
function inferirTipo(tokens, idx) {
  const prev = tokens[idx - 1];
  const next = tokens[idx + 1];
  const next2 = tokens[idx + 2];

  if (prev && prev.type === 'Palabra_Reservada' && prev.value.toLowerCase() === 'int') {
    return 'int';
  }

  if (next && next.type === 'Asignación' && next2) {
    if (next2.type === 'Número_Entero') return 'int';
    if (next2.type === 'Cadena')        return 'string';
  }

  return 'desconocido';
}

/**
 * Analiza el código fuente y retorna tokens + tabla de símbolos.
 * @param {string} source - código fuente completo
 * @returns {{ tokens: Array, symbolTable: Array }}
 */
function analyzeLexer(source) {
  const tokens = [];
  let i = 0, lineNum = 1;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\n')                               { lineNum++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    if (ch === '/' && source[i+1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i+1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) {
        if (source[i] === '\n') lineNum++;
        i++;
      }
      i += 2;
      continue;
    }

    if (ch === '"') {
      let str = ''; i++;
      while (i < source.length && source[i] !== '"' && source[i] !== '\n') str += source[i++];
      if (source[i] === '"') i++;
      tokens.push(str.includes('asdfg')
        ? { type: 'Cadena',  value: `"${str}"`, line: lineNum }
        : { type: 'Error',   value: `"${str}" (cadena inválida — sin 'asdfg')`, line: lineNum });
      continue;
    }
    if (ch === "'") {
      let str = ''; i++;
      while (i < source.length && source[i] !== "'" && source[i] !== '\n') str += source[i++];
      if (source[i] === "'") i++;
      tokens.push(str.includes('asdfg')
        ? { type: 'Cadena', value: `'${str}'`, line: lineNum }
        : { type: 'Error',  value: `'${str}' (cadena inválida — sin 'asdfg')`, line: lineNum });
      continue;
    }

    if (isLetter(ch)) {
      let word = '';
      while (i < source.length && isAlnum(source[i])) word += source[i++];
      if (PALABRAS_RESERVADAS.has(word.toLowerCase()))
        tokens.push({ type: 'Palabra_Reservada', value: word, line: lineNum });
      else if (word.length > 10)
        tokens.push({ type: 'Error', value: `${word} (identificador > 10 chars)`, line: lineNum });
      else
        tokens.push({ type: 'Identificador', value: word, line: lineNum });
      continue;
    }

    if (isDigit(ch)) {
      let num = '';
      while (i < source.length && isDigit(source[i])) num += source[i++];
      const val = parseInt(num, 10);
      tokens.push(val >= 0 && val <= 100
        ? { type: 'Número_Entero', value: num, line: lineNum }
        : { type: 'Error', value: `${num} (número fuera de rango 0-100)`, line: lineNum });
      continue;
    }

    if (ch === ':' && source[i+1] === '=') {
      tokens.push({ type: 'Asignación', value: ':=', line: lineNum }); i += 2; continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'Error', value: `: (se esperaba ':=')`, line: lineNum }); i++; continue;
    }

    const two = source[i] + (source[i+1] || '');
    if (OPERADORES_RELACIONALES_2.has(two)) {
      tokens.push({ type: 'Relacional', value: two, line: lineNum }); i += 2; continue;
    }

    if (OPERADORES_ARITMETICOS.has(ch)) {
      tokens.push({ type: 'Operador_Aritmético', value: ch, line: lineNum }); i++; continue;
    }

    if (OPERADORES_RELACIONALES_1.has(ch)) {
      tokens.push({ type: 'Relacional', value: ch, line: lineNum }); i++; continue;
    }

    tokens.push({ type: 'Error', value: `${ch} (carácter no reconocido)`, line: lineNum });
    i++;
  }

  const symbolTable = buildSymbolTable(tokens);

  return { tokens, symbolTable };
}