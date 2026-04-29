// lexer.js 
const PALABRAS_RESERVADAS = new Set([
  'nen', 'ko',
  'gon', 'killua', 'kurapika', 'leorio',
  'hatsu', 'zetsu',
  'ten', 'ken', 'ren', 'gura',
  'ryodan', 'hisoka', 'illumi',
  'shu', 'in',
  'verdad', 'falso',
  'yorknew'
]);

const OPERADORES_ARITMETICOS  = new Set(['+', '-', '*', '/', '%']);
const OPERADORES_DOBLES       = new Set(['>=', '<=', '==', '!=', ':=', '&&', '||']);
const OPERADORES_RELACIONALES = new Set(['>', '<']);
const OPERADORES_LOGICOS      = new Set(['!']);
const DELIMITADORES           = new Set(['(', ')', '{', '}', '[', ']', ',', ';', ':']);

function isLetter(c) { return /[a-zA-Z_]/.test(c); }
function isDigit(c)  { return /[0-9]/.test(c); }
function isAlnum(c)  { return /[a-zA-Z0-9_]/.test(c); }

const ERROR_TYPES = {
  IDENT_LARGO:      { tipo: 'Identificador largo',           desc: 'El identificador supera los 20 caracteres permitidos' },
  RESERVADA_MAL:    { tipo: 'Palabra reservada mal escrita', desc: 'Las palabras reservadas deben ir en minúsculas (case-sensitive)' },
  NUM_DECIMAL_MAL:  { tipo: 'Decimal malformado',            desc: 'Número decimal con formato incorrecto (ej: 3.4.5)' },
  CADENA_NOCERRADA: { tipo: 'Cadena sin cerrar',             desc: 'La cadena de texto no tiene comilla de cierre' },
  COMILLA_SIMPLE:   { tipo: 'Comilla simple no válida',      desc: 'NenScript solo permite cadenas con comillas dobles' },
  CHAR_INVALIDO:    { tipo: 'Carácter no reconocido',        desc: 'El carácter no pertenece al alfabeto de NenScript' },
};

// Tabla de símbolos
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
        valor:       inferirValor(tokens, i),
        lineaDecl:   tok.line,
        columnaDecl: tok.column,
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
      if (entry.valor === '—') {
        const valorNuevo = inferirValor(tokens, i);
        if (valorNuevo !== '—') entry.valor = valorNuevo;
      }
    }
  }

  return Array.from(table.values()).sort((a, b) => a.lineaDecl - b.lineaDecl);
}

function inferirTipo(tokens, idx) {
  const prev  = tokens[idx - 1];
  const prev2 = tokens[idx - 2];
  const next  = tokens[idx + 1];
  const next2 = tokens[idx + 2];

  // Declaración con yorknew (const) — el tipo viene 2 tokens atrás: yorknew gon PI
  if (prev2 && prev2.type === 'Palabra_Reservada' && prev2.value === 'yorknew'
      && prev && prev.type === 'Palabra_Reservada') {
    if (prev.value === 'gon')      return 'yorknew gon (const entero)';
    if (prev.value === 'killua')   return 'yorknew killua (const decimal)';
    if (prev.value === 'kurapika') return 'yorknew kurapika (const cadena)';
    if (prev.value === 'leorio')   return 'yorknew leorio (const booleano)';
  }

  // Declaración explícita: gon x, killua y, kurapika z, leorio w
  // (case-sensitive: solo coincide la forma exacta en minúsculas)
  if (prev && prev.type === 'Palabra_Reservada') {
    if (prev.value === 'gon')      return 'gon (entero)';
    if (prev.value === 'killua')   return 'killua (decimal)';
    if (prev.value === 'kurapika') return 'kurapika (cadena)';
    if (prev.value === 'leorio')   return 'leorio (booleano)';
  }

  // Inferencia por asignación
  if (next && next.type === 'Asignación' && next2) {
    if (next2.type === 'Número_Entero')  return 'gon (entero)';
    if (next2.type === 'Número_Decimal') return 'killua (decimal)';
    if (next2.type === 'Cadena')         return 'kurapika (cadena)';
    if (next2.type === 'Booleano')       return 'leorio (booleano)';
  }
  return 'desconocido';
}

function inferirValor(tokens, idx) {
  const next  = tokens[idx + 1];
  const next2 = tokens[idx + 2];
  if (next && next.type === 'Asignación' && next2) {
    if (
      next2.type === 'Número_Entero'  ||
      next2.type === 'Número_Decimal' ||
      next2.type === 'Cadena'         ||
      next2.type === 'Booleano'
    ) {
      return next2.value;
    }
  }
  return '—';
}

function analyzeLexer(source) {
  const tokens = [];
  let i = 0;
  let lineNum = 1;
  let colNum  = 1;

  function advance() {
    if (source[i] === '\n') { lineNum++; colNum = 1; }
    else                    { colNum++; }
    i++;
  }

  while (i < source.length) {
    const ch = source[i];
    const tokLine = lineNum;
    const tokCol  = colNum;

    // Saltos de línea y espacios
    if (ch === '\n' || ch === ' ' || ch === '\t' || ch === '\r') { advance(); continue; }

    // Comentario de línea //
    if (ch === '/' && source[i+1] === '/') {
      while (i < source.length && source[i] !== '\n') advance();
      continue;
    }
    // Comentario de bloque /* */
    if (ch === '/' && source[i+1] === '*') {
      advance(); advance(); // consume /*
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) {
        advance();
      }
      if (i < source.length) { advance(); advance(); } // consume */
      continue;
    }

    // Cadenas con comillas dobles
    if (ch === '"') {
      let str = ''; advance(); // consume "
      while (i < source.length && source[i] !== '"' && source[i] !== '\n') {
        str += source[i]; advance();
      }
      if (source[i] === '"') {
        advance();
        tokens.push({ type: 'Cadena', value: `"${str}"`, line: tokLine, column: tokCol });
      } else {
        tokens.push({ type: 'Error', value: `"${str}`, line: tokLine, column: tokCol, errorKey: 'CADENA_NOCERRADA' });
      }
      continue;
    }

    // Comillas simples — no válidas en NenScript
    if (ch === "'") {
      let str = ''; advance(); // consume '
      while (i < source.length && source[i] !== "'" && source[i] !== '\n') {
        str += source[i]; advance();
      }
      if (source[i] === "'") advance();
      tokens.push({ type: 'Error', value: `'${str}'`, line: tokLine, column: tokCol, errorKey: 'COMILLA_SIMPLE' });
      continue;
    }

    // Identificadores y palabras reservadas (case-sensitive)
    if (isLetter(ch)) {
      let word = '';
      while (i < source.length && isAlnum(source[i])) { word += source[i]; advance(); }

      // Easter egg: DraSheyla
      if (word === 'DraSheyla') {
        tokens.push({ type: 'Especial', value: word, line: tokLine, column: tokCol });
        continue;
      }

      // CASE-SENSITIVE: solo coincide si está exactamente en minúsculas
      if (PALABRAS_RESERVADAS.has(word)) {
        if (word === 'verdad' || word === 'falso') {
          tokens.push({ type: 'Booleano', value: word, line: tokLine, column: tokCol });
        } else {
          tokens.push({ type: 'Palabra_Reservada', value: word, line: tokLine, column: tokCol });
        }
        continue;
      }

      // Detección de palabra reservada mal escrita (mayúsculas / mixto)
      if (PALABRAS_RESERVADAS.has(word.toLowerCase())) {
        tokens.push({ type: 'Error', value: word, line: tokLine, column: tokCol, errorKey: 'RESERVADA_MAL' });
        continue;
      }

      if (word.length > 20) {
        tokens.push({ type: 'Error', value: word, line: tokLine, column: tokCol, errorKey: 'IDENT_LARGO' });
        continue;
      }

      tokens.push({ type: 'Identificador', value: word, line: tokLine, column: tokCol });
      continue;
    }

    // Números: enteros y decimales
    if (isDigit(ch)) {
      let num = '';
      while (i < source.length && isDigit(source[i])) { num += source[i]; advance(); }

      // Decimal
      if (source[i] === '.' && isDigit(source[i+1])) {
        num += source[i]; advance(); // consume el punto
        while (i < source.length && isDigit(source[i])) { num += source[i]; advance(); }
        // Segundo punto = decimal malformado
        if (source[i] === '.') {
          while (i < source.length && (isDigit(source[i]) || source[i] === '.')) { num += source[i]; advance(); }
          tokens.push({ type: 'Error', value: num, line: tokLine, column: tokCol, errorKey: 'NUM_DECIMAL_MAL' });
        } else {
          tokens.push({ type: 'Número_Decimal', value: num, line: tokLine, column: tokCol });
        }
      } else {
        tokens.push({ type: 'Número_Entero', value: num, line: tokLine, column: tokCol });
      }
      continue;
    }

    // Operadores de 2 caracteres (>=, <=, ==, !=, :=, &&, ||)
    const two = source[i] + (source[i+1] || '');
    if (OPERADORES_DOBLES.has(two)) {
      if (two === ':=') {
        tokens.push({ type: 'Asignación', value: ':=', line: tokLine, column: tokCol });
      } else if (two === '&&' || two === '||') {
        tokens.push({ type: 'Operador_Lógico', value: two, line: tokLine, column: tokCol });
      } else {
        tokens.push({ type: 'Relacional', value: two, line: tokLine, column: tokCol });
      }
      advance(); advance(); continue;
    }

    if (OPERADORES_ARITMETICOS.has(ch)) {
      tokens.push({ type: 'Operador_Aritmético', value: ch, line: tokLine, column: tokCol }); advance(); continue;
    }
    if (OPERADORES_RELACIONALES.has(ch)) {
      tokens.push({ type: 'Relacional', value: ch, line: tokLine, column: tokCol }); advance(); continue;
    }
    if (OPERADORES_LOGICOS.has(ch)) {
      tokens.push({ type: 'Operador_Lógico', value: ch, line: tokLine, column: tokCol }); advance(); continue;
    }
    if (DELIMITADORES.has(ch)) {
      tokens.push({ type: 'Delimitador', value: ch, line: tokLine, column: tokCol }); advance(); continue;
    }
    tokens.push({ type: 'Error', value: ch, line: tokLine, column: tokCol, errorKey: 'CHAR_INVALIDO' });
    advance();
  }

  const symbolTable = buildSymbolTable(tokens);

  const errorTable = tokens
    .filter(t => t.type === 'Error')
    .map((t, idx) => {
      const info = ERROR_TYPES[t.errorKey] || ERROR_TYPES.CHAR_INVALIDO;
      return {
        idx:    idx + 1,
        value:  t.value,
        tipo:   info.tipo,
        desc:   info.desc,
        line:   t.line,
        column: t.column
      };
    });

  return { tokens, symbolTable, errorTable };
}