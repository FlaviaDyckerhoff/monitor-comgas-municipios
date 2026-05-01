'use strict';

// parsers/santana-parnaiba.js
// Santana de Parnaíba — parser híbrido
// SPL: PLs, Requerimentos, Indicações, Moções (sempapel.camarasantanadeparnaiba.sp.gov.br)
// HTML: /atos e /audiencias (www.camarasantanadeparnaiba.sp.gov.br)

const spl = require('./spl.js');

const BASE_URL_HTML = 'https://www.camarasantanadeparnaiba.sp.gov.br';
const PAGINAS = [
  { path: '/atos',       tipo: 'Ato da Presidência' },
  { path: '/audiencias', tipo: 'Audiência Pública'   },
];

function parsearHTML(html, tipoBase, ano) {
  const proposituras = [];
  const vistos = new Set();
  const anoStr = String(ano);

  const tag = `accordion-middle-${anoStr}`;
  const idx1 = html.indexOf(tag);
  if (idx1 === -1) return proposituras;
  const idxAno = html.indexOf(tag, idx1 + 1);
  if (idxAno === -1) return proposituras;

  const idxProximo = html.indexOf('accordion-middle-', idxAno + 10);
  const blocoAno = html.substring(idxAno, idxProximo > 0 ? idxProximo : idxAno + 50000);

  const itemRegex = /<h3[^>]*>([\s\S]*?)<\/h3>\s*([\s\S]*?)(?=<h3|<\/ul>|$)/gi;
  let m;
  while ((m = itemRegex.exec(blocoAno)) !== null) {
    const tituloRaw = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const resto = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!tituloRaw || tituloRaw.length < 3) continue;

    const numMatch = tituloRaw.match(/n[ºo°]\s*(\d+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '';
    if (numero && !numero.endsWith(`/${ano}`)) continue;

    const idBase = numero
      ? `santana-html-${tipoBase.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')}-${numero.replace('/', '-')}`
      : `santana-html-${Buffer.from(tituloRaw).toString('base64').substring(0, 10)}`;
    if (vistos.has(idBase)) continue;
    vistos.add(idBase);

    const dataMatch = resto.match(/\d{2}\/\d{2}\/\d{4}/);
    const ementa = resto.replace(/\d{2}\/\d{2}\/\d{4}/, '').trim() || tituloRaw;

    proposituras.push({
      id:     idBase,
      titulo: tituloRaw,
      tipo:   tipoBase,
      numero: numero || '-',
      data:   dataMatch ? dataMatch[0] : '-',
      autor:  '-',
      ementa: ementa.substring(0, 400),
      url:    `${BASE_URL_HTML}${PAGINAS.find(p => p.tipo === tipoBase)?.path || ''}`,
    });
  }
  return proposituras;
}

async function buscarHTML(ano) {
  const todos = [];
  for (const pagina of PAGINAS) {
    try {
      const res = await fetch(`${BASE_URL_HTML}${pagina.path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.error(`[Santana de Parnaíba] HTML ${pagina.path} → HTTP ${res.status}`); continue; }
      const html = await res.text();
      const items = parsearHTML(html, pagina.tipo, ano);
      console.log(`[Santana de Parnaíba] ${pagina.tipo} → ${items.length} itens de ${ano}`);
      todos.push(...items);
    } catch (err) {
      console.error(`[Santana de Parnaíba] Erro ${pagina.path}: ${err.message}`);
    }
  }
  return todos;
}

async function buscar(municipio) {
  const ano = new Date().getFullYear();
  const [splItems, htmlItems] = await Promise.all([
    spl.buscar(municipio),
    buscarHTML(ano),
  ]);
  console.log(`[Santana de Parnaíba] SPL: ${splItems.length} | Audiências/Atos: ${htmlItems.length}`);
  return [...splItems, ...htmlItems];
}

module.exports = { buscar };
