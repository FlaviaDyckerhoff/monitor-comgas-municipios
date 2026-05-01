'use strict';

// parsers/guarulhos.js
// Parser para Câmara Municipal de Guarulhos/SP
// Sistema: Legisoft (Cloudflare) — acesso via microserviço Puppeteer local
// Serviço: http://localhost:3002/proposicoes (guarulhos-service.js rodando no VPS)

const SERVICE_URL = 'http://localhost:3002/proposicoes';

const SUBTIPOS = [
  'projeto-de-lei-20',
  'projeto-de-decreto-legislativo-17',
  'projeto-de-resolucao-21',
  'projeto-de-emenda-a-lei-organica-18',
  'requerimento-22',
  'indicacao-12',
  'mocao-13',
];

async function buscarSubtipo(subtipo, ano) {
  const results = [];
  let pagina = 1;

  while (true) {
    const url = `${SERVICE_URL}?subtipo=${subtipo}&ano=${ano}&pagina=${pagina}`;
    let data;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      data = await res.json();
    } catch (err) {
      console.error(`[guarulhos] Erro subtipo=${subtipo} pagina=${pagina}: ${err.message}`);
      break;
    }

    if (!data.proposituras || data.proposituras.length === 0) break;

    for (const p of data.proposituras) {
      results.push({
        id:     p.id,
        titulo: p.ementa || p.tipo,
        ementa: p.ementa || '',
        tipo:   p.tipo   || 'Propositura',
        ano:    String(ano),
        url:    p.url,
      });
    }

    if (!data.temProxima) break;
    pagina++;
    // Pequena pausa entre páginas para não sobrecarregar o Puppeteer
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

async function buscarProposicoes(municipio, ano) {
  const todos = [];

  for (const subtipo of SUBTIPOS) {
    const items = await buscarSubtipo(subtipo, ano);
    todos.push(...items);
    if (items.length > 0) {
      console.log(`[guarulhos] ${subtipo}: ${items.length} proposituras`);
    }
  }

  return todos;
}

module.exports = { buscarProposicoes };
