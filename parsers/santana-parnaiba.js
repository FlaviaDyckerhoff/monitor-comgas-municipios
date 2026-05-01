// parsers/santana-parnaiba.js
// Parser para a Câmara Municipal de Santana de Parnaíba/SP
// Sistema: HTML estático SSR — sem captcha, sem JS, fetch nativo
// Monitora: /atos (Atos da Presidência) e /audiencias (Audiências Públicas)
// Estrutura HTML: accordion por ano com <h3> para título e texto para ementa/data

const BASE_URL = 'https://www.camarasantanadeparnaiba.sp.gov.br';

const PAGINAS = [
  { path: '/atos',       tipo: 'Ato da Presidência' },
  { path: '/audiencias', tipo: 'Audiência Pública'   },
];

async function buscar(municipio) {
  const { nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const pagina of PAGINAS) {
    const url = `${BASE_URL}${pagina.path}`;
    console.log(`  [${nome}] Buscando ${pagina.tipo}...`);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      console.error(`  [${nome}] Erro de conexão: ${err.message}`);
      continue;
    }

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      continue;
    }

    const html = await response.text();
    const props = parsearHTML(html, pagina.tipo, ano, url);
    console.log(`  [${nome}] ${pagina.tipo} → ${props.length} itens de ${ano}`);
    todas.push(...props);
  }

  return todas;
}

function parsearHTML(html, tipoBase, ano, url_pagina) {
  const proposituras = [];
  const vistos = new Set();

  // Localiza o bloco do ano atual no accordion
  // Padrão: accordion-middle-AAAA seguido de conteúdo
  const anoStr = String(ano);
  // O accordion aparece 2x: no link href e no div id= com conteúdo real — usar a 2a ocorrência
  const tag = `accordion-middle-${anoStr}`;
  const idx1 = html.indexOf(tag);
  if (idx1 === -1) return proposituras;
  const idxAno = html.indexOf(tag, idx1 + 1);
  if (idxAno === -1) return proposituras;

  // Pega o bloco do ano até o próximo accordion ou fim
  const idxProximo = html.indexOf('accordion-middle-', idxAno + 10);
  const blocoAno = html.substring(idxAno, idxProximo > 0 ? idxProximo : idxAno + 50000);

  // Cada item tem: <h3>Título nº NNN/AAAA</h3>\n\nDATA\n\nDescrição
  // Regex captura: título do h3, seguido de data opcional e ementa
  const itemRegex = /<h3[^>]*>([\s\S]*?)<\/h3>\s*([\s\S]*?)(?=<h3|<\/ul>|$)/gi;
  let m;

  while ((m = itemRegex.exec(blocoAno)) !== null) {
    const tituloRaw = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const resto = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (!tituloRaw || tituloRaw.length < 3) continue;

    // Extrai número do título: "nº 008/2025" ou "Nº 008/2025"
    const numMatch = tituloRaw.match(/n[ºo°]\s*(\d+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '';

    // Filtra só itens do ano atual
    if (numero && !numero.endsWith(`/${ano}`)) continue;

    // Gera ID único
    const idBase = numero
      ? `santana-parnaiba-${tipoBase.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')}-${numero.replace('/', '-')}`
      : `santana-parnaiba-${tipoBase.toLowerCase().replace(/\s+/g, '-')}-${Buffer.from(tituloRaw).toString('base64').substring(0, 10)}`;

    if (vistos.has(idBase)) continue;
    vistos.add(idBase);

    // Data — dd/mm/aaaa no texto restante
    const dataMatch = resto.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Ementa — remove a data do texto restante
    const ementa = resto.replace(/\d{2}\/\d{2}\/\d{4}/, '').replace(/\s+/g, ' ').trim().substring(0, 400)
      || tituloRaw;

    proposituras.push({
      id: idBase,
      titulo: tituloRaw,
      tipo: tipoBase,
      numero: numero || '-',
      data,
      autor: '-',
      ementa: ementa || tituloRaw,
      url: url_pagina,
    });
  }

  return proposituras;
}

module.exports = { buscar };
