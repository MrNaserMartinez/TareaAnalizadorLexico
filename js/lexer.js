// lexer.js — Analizador Léxico de NenScript (Hunter x Hunter)

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

const OPERADORES_ARITMETICOS    = new Set(['+', '-', '*', '/', '%']);
const OPERADORES_RELACIONALES_2 = new Set(['>=', '<=', '==', '!=', ':=', '&&', '||']);
const OPERADORES_RELACIONALES_1 = new Set(['>', '<', '!', '(', ')', '{', '}', '[', ']', ',', ';', ':']);

function isLetter(c) { return /[a-zA-Z_]/.test(c); }
function isDigit(c)  { return /[0-9]/.test(c); }
function isAlnum(c)  { return /[a-zA-Z0-9_]/.test(c); }

const ERROR_TYPES = {
  IDENT_LARGO:      { tipo: 'Identificador largo',       desc: 'El identificador supera los 20 caracteres permitidos' },
  IDENT_INVALIDO:   { tipo: 'Identificador inválido',    desc: 'El identificador contiene caracteres no permitidos' },
  NUM_DECIMAL_MAL:  { tipo: 'Decimal malformado',        desc: 'Número decimal con formato incorrecto (ej: 3.4.5)' },
  CADENA_NOCERRADA: { tipo: 'Cadena sin cerrar',         desc: 'La cadena de texto no tiene comilla de cierre' },
  COMILLA_SIMPLE:   { tipo: 'Comilla simple no válida',  desc: 'NenScript solo permite cadenas con comillas dobles' },
  CHAR_INVALIDO:    { tipo: 'Carácter no reconocido',    desc: 'El carácter no pertenece al alfabeto de NenScript' },
  ASIGN_INCOMPLETA: { tipo: 'Asignación incompleta',     desc: 'Se encontró \':\' solo, se esperaba \':=\'' },
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

  // Declaración explícita: gon x, killua y, kurapika z, leorio w
  if (prev && prev.type === 'Palabra_Reservada') {
    const kw = prev.value.toLowerCase();
    if (kw === 'gon')      return 'gon (entero)';
    if (kw === 'killua')   return 'killua (decimal)';
    if (kw === 'kurapika') return 'kurapika (cadena)';
    if (kw === 'leorio')   return 'leorio (booleano)';
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

function analyzeLexer(source) {
  const tokens = [];
  let i = 0, lineNum = 1;

  while (i < source.length) {
    const ch = source[i];

    // Saltos de línea y espacios
    if (ch === '\n')                               { lineNum++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // Comentario de línea //
    if (ch === '/' && source[i+1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    // Comentario de bloque /* */
    if (ch === '/' && source[i+1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) {
        if (source[i] === '\n') lineNum++;
        i++;
      }
      i += 2;
      continue;
    }

    // Cadenas con comillas dobles
    if (ch === '"') {
      let str = ''; i++;
      while (i < source.length && source[i] !== '"' && source[i] !== '\n') str += source[i++];
      if (source[i] === '"') {
        i++;
        tokens.push({ type: 'Cadena', value: `"${str}"`, line: lineNum });
      } else {
        tokens.push({ type: 'Error', value: `"${str}`, line: lineNum, errorKey: 'CADENA_NOCERRADA' });
      }
      continue;
    }

    // Comillas simples — no válidas en NenScript
    if (ch === "'") {
      let str = ''; i++;
      while (i < source.length && source[i] !== "'" && source[i] !== '\n') str += source[i++];
      if (source[i] === "'") i++;
      tokens.push({ type: 'Error', value: `'${str}'`, line: lineNum, errorKey: 'COMILLA_SIMPLE' });
      continue;
    }

    // Identificadores y palabras reservadas
    if (isLetter(ch)) {
      let word = '';
      while (i < source.length && isAlnum(source[i])) word += source[i++];

      // Easter egg: DraSheyla
      if (word === 'DraSheyla') {
        tokens.push({ type: 'Especial', value: word, line: lineNum });
        continue;
      }

      if (PALABRAS_RESERVADAS.has(word.toLowerCase())) {
        // verdad / falso son booleanos
        if (word === 'verdad' || word === 'falso') {
          tokens.push({ type: 'Booleano', value: word, line: lineNum });
        } else {
          tokens.push({ type: 'Palabra_Reservada', value: word, line: lineNum });
        }
        continue;
      }

      if (word.length > 20) {
        tokens.push({ type: 'Error', value: word, line: lineNum, errorKey: 'IDENT_LARGO' });
        continue;
      }

      tokens.push({ type: 'Identificador', value: word, line: lineNum });
      continue;
    }

    // Números: enteros y decimales
    if (isDigit(ch)) {
      let num = '';
      while (i < source.length && isDigit(source[i])) num += source[i++];

      // Decimal
      if (source[i] === '.' && isDigit(source[i+1])) {
        num += source[i++]; // consume el punto
        while (i < source.length && isDigit(source[i])) num += source[i++];
        // Segundo punto = error
        if (source[i] === '.') {
          while (i < source.length && (isDigit(source[i]) || source[i] === '.')) num += source[i++];
          tokens.push({ type: 'Error', value: num, line: lineNum, errorKey: 'NUM_DECIMAL_MAL' });
        } else {
          tokens.push({ type: 'Número_Decimal', value: num, line: lineNum });
        }
      } else {
        tokens.push({ type: 'Número_Entero', value: num, line: lineNum });
      }
      continue;
    }

    // Operadores de 2 caracteres (incluyendo :=, ==, !=, >=, <=, &&, ||)
    const two = source[i] + (source[i+1] || '');
    if (OPERADORES_RELACIONALES_2.has(two)) {
      if (two === ':=') {
        tokens.push({ type: 'Asignación', value: ':=', line: lineNum });
      } else if (two === '&&' || two === '||') {
        tokens.push({ type: 'Operador_Lógico', value: two, line: lineNum });
      } else {
        tokens.push({ type: 'Relacional', value: two, line: lineNum });
      }
      i += 2; continue;
    }

    // Dos puntos solos = error de asignación incompleta
    if (ch === ':') {
      tokens.push({ type: 'Error', value: ':', line: lineNum, errorKey: 'ASIGN_INCOMPLETA' });
      i++; continue;
    }

    // Operadores aritméticos
    if (OPERADORES_ARITMETICOS.has(ch)) {
      tokens.push({ type: 'Operador_Aritmético', value: ch, line: lineNum }); i++; continue;
    }

    // Delimitadores y relacionales de 1 carácter
    if (OPERADORES_RELACIONALES_1.has(ch)) {
      tokens.push({ type: 'Delimitador', value: ch, line: lineNum }); i++; continue;
    }

    // Carácter no reconocido
    tokens.push({ type: 'Error', value: ch, line: lineNum, errorKey: 'CHAR_INVALIDO' });
    i++;
  }

  const symbolTable = buildSymbolTable(tokens);

  const errorTable = tokens
    .filter(t => t.type === 'Error')
    .map((t, idx) => {
      const info = ERROR_TYPES[t.errorKey] || ERROR_TYPES.CHAR_INVALIDO;
      return { idx: idx + 1, value: t.value, tipo: info.tipo, desc: info.desc, line: t.line };
    });

  return { tokens, symbolTable, errorTable };
}