// parsers/jacarei.js
// Parser para a Câmara Municipal de Jacareí/SP
// Sistema: WordPress com páginas estáticas por tipo
// Sem paginação — tudo numa página por tipo
// Tipos disponíveis: PLL, PLCL, PLE, PDL, PR
// Sem indicações/requerimentos no site público

const TIPOS = [
  { nome: 'Projeto de Lei',                slug: 'pll',  prefix: 'PLL' },
  { nome: 'Projeto de Lei Complementar',   slug: 'plcl', prefix: 'PLCL' },
  { nome: 'Projeto de Emenda à LOM',       slug: 'ple',  prefix: 'PLE' },
  { nome: 'Projeto de Decreto Legislativo',slug: 'pdl',  prefix: 'PDL' },
  { nome: 'Projeto de Resolução',          slug: 'pr',   prefix: 'PR' },
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    const url = `${url_base}/trabalhos-gerais/projetos-ano-${ano}-${tipo.slug}/`;
    console.log(`  [${nome}] Buscando ${tipo.nome}...`);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        }
      });
    } catch (err) {
      console.error(`  [${nome}] Erro de conexão: ${err.message}`);
      continue;
    }

    if (!response.ok) {
      console.error(`  [${nome}] HTTP ${response.status} para ${tipo.slug}`);
      continue;
    }

    const html = await response.text();
    const props = parsearHTML(html, url_base, tipo, ano, url);
    console.log(`  [${nome}] ${tipo.nome} → ${props.length} itens`);
    todas.push(...props);

    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

function parsearHTML(html, url_base, tipo, ano, url_pagina) {
  const proposituras = [];
  const vistos = new Set();

  // Cada projeto começa com um <h2> contendo o número
  // Ex: ## Projeto de Lei do Legislativo nº 1/2026
  const blocoRegex = /##\s+[^#\n]+n[ºo°]\s*(\d+)\/(\d{4})([\s\S]*?)(?=##\s+[^#\n]+n[ºo°]\s*\d+\/\d{4}|$)/gi;

  // Alternativa: split por <hr> ou por padrão de número
  // Usa regex direto no HTML
  const secaoRegex = new RegExp(
    `${tipo.prefix}-?(\\d+)\\.${ano}`,
    'gi'
  );

  // Abordagem: busca todos os blocos com o prefixo do tipo
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  const posicoes = [];

  while ((m = h2Regex.exec(html)) !== null) {
    const texto = m[1].replace(/<[^>]+>/g, '').trim();
    const numMatch = texto.match(/n[ºo°]?\s*(\d+)\/(\d{4})/i);
    if (numMatch && parseInt(numMatch[2]) === ano) {
      posicoes.push({ idx: m.index, numero: numMatch[1], texto });
    }
  }

  for (let i = 0; i < posicoes.length; i++) {
    const pos = posicoes[i];
    const fim = i + 1 < posicoes.length ? posicoes[i + 1].idx : html.length;
    const bloco = html.substring(pos.idx, fim);

    const id = `jacarei-${tipo.prefix}-${pos.numero}-${ano}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    // Ementa
    const ementaMatch = bloco.match(/[Ee]menta[^–\-]*[–\-]\s*([\s\S]{10,400}?)(?=\*\*[A-Z]|\n\n|<\/p>)/i)
      || bloco.match(/Ementa[^<]*<\/strong>\s*[–\-]?\s*([\s\S]{10,300}?)(?=<br|<\/p>|<strong>)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : `${tipo.nome} nº ${pos.numero}/${ano}`;

    // Autor
    const autorMatch = bloco.match(/[Aa]utor[^–\-]*[–\-]\s*([\s\S]{3,80}?)(?=\n|\*\*\d|\<)/i);
    const autor = autorMatch
      ? autorMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 80)
      : '-';

    // Data — primeira ocorrência dd/m/aaaa ou dd/mm/aaaa
    const dataMatch = bloco.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Link PDF do protocolo
    const pdfMatch = bloco.match(/href="([^"]*\.pdf[^"]*)"/i);
    const url_prop = pdfMatch
      ? (pdfMatch[1].startsWith('http') ? pdfMatch[1] : `${url_base}${pdfMatch[1]}`)
      : url_pagina;

    proposituras.push({
      id,
      tipo: tipo.nome,
      numero: `${pos.numero}/${ano}`,
      data,
      autor,
      ementa,
      url: url_prop,
    });
  }

  return proposituras;
}

module.exports = { buscar };
