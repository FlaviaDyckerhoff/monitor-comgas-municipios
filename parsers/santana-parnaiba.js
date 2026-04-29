'use strict';
// parsers/santana-parnaiba.js
// Parser para Câmara Municipal de Santana de Parnaíba/SP
// Sistema: camaraonline.org/cm_santana — form GET, HTML scraping
// Busca projetos de lei e projetos de decreto legislativo/resolução separadamente
// Endpoint: /projetos/resultado.php?type=0&fromYear=AAAA&toYear=AAAA&page=N
//           /dec_res/resultado.php?type=0&fromYear=AAAA&toYear=AAAA&page=N

const URL_BASE = 'http://camaraonline.org/cm_santana';

// Extrai proposições de uma página HTML do resultado.php
function parsePagina(html, urlBase) {
  const results = [];

  // Cada proposição está em uma <table width='100%'>...</table>
  // Campos: Documento (com data-link para PDF), Autor do projeto, Assunto
  const tableRe = /<table width='100%'>([\s\S]*?)<\/table>/g;
  let tableMatch;

  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tbl = tableMatch[1];

    // Documento: <a ... data-link='URL'>Texto</a>
    const docMatch = tbl.match(/data-link='([^']+)'>([^<]+)<\/a>/);
    if (!docMatch) continue;

    const pdfUrl = docMatch[1].trim();
    const titulo = docMatch[2].trim();

    // Extrair tipo e número do título (ex: "Projeto de Lei Nº 117/2026")
    const tipoNumMatch = titulo.match(/^(.+?)\s+[Nn]º?\s*([\d\/]+)$/);
    const tipo = tipoNumMatch ? tipoNumMatch[1].trim() : titulo;
    const numero = tipoNumMatch ? tipoNumMatch[2].trim() : '';

    // Ano — pegar do número ou do link
    let ano = '';
    const anoNumMatch = numero.match(/\/(\d{4})$/);
    if (anoNumMatch) {
      ano = anoNumMatch[1];
    } else {
      const anoLinkMatch = pdfUrl.match(/\/(\d{4})\//);
      if (anoLinkMatch) ano = anoLinkMatch[1];
    }

    // Assunto/ementa
    const ementaMatch = tbl.match(/<td style='font-size:small;text-align:justify'>([^<]+)<\/td>/);
    const ementa = ementaMatch ? ementaMatch[1].trim() : '';

    // ID único baseado no PDF URL (ex: PLE0117_2026)
    const idMatch = pdfUrl.match(/\/([A-Z0-9_]+)\.pdf$/i);
    const id = idMatch ? idMatch[1].toLowerCase() : titulo.replace(/\s+/g, '-').toLowerCase();

    results.push({
      id: `santana-parnaiba-${id}`,
      titulo,
      ementa,
      tipo,
      ano: parseInt(ano, 10) || null,
      url: pdfUrl,
    });
  }

  return results;
}

// Busca todas as páginas de um sub-módulo (projetos ou dec_res)
async function buscarModulo(modulo, ano) {
  const results = [];
  let pagina = 1;
  const maxPaginas = 50;

  while (pagina <= maxPaginas) {
    const url = `${URL_BASE}/${modulo}/resultado.php?type=0&fromYear=${ano}&toYear=${ano}&page=${pagina}`;

    let html;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' },
      });
      if (!res.ok) break;
      html = await res.text();
    } catch (e) {
      console.error(`  [santana-parnaiba] Erro ao buscar ${url}: ${e.message}`);
      break;
    }

    // Verificar se há resultados
    if (!html.includes('resultado')) break;

    const pagItems = parsePagina(html, URL_BASE);
    if (pagItems.length === 0) break;

    results.push(...pagItems);

    // Verificar paginação via JS: totalPages: N
    const totalPagesMatch = html.match(/totalPages:\s*(\d+)/);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1;
    if (pagina >= totalPages) break;

    pagina++;
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

async function buscarProposicoes(municipio, ano) {
  const results = [];

  // Projetos de Lei e Lei Complementar
  const projetos = await buscarModulo('projetos', ano);
  results.push(...projetos);

  // Projetos de Decreto Legislativo e Resolução
  const decRes = await buscarModulo('dec_res', ano);
  results.push(...decRes);

  return results;
}

module.exports = { buscarProposicoes };
