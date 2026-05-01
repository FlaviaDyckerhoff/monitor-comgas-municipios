'use strict';

// parsers/sbc.js
// Parser para Câmara de São Bernardo do Campo/SP
// Sistema: Legisoft (Cloudflare) — acesso via microserviço Puppeteer local
// Serviço: http://localhost:3002/proposicoes?host=sbc (guarulhos-service.js rodando no VPS)

const SERVICE_URL = 'http://localhost:3002/proposicoes';

const SUBTIPOS = [
  'projeto-de-lei-101',
  'projeto-de-lei-complementar-105',
  'projeto-de-decreto-legislativo-106',
  'projeto-de-resolucao-102',
  'proposta-de-emenda-a-lei-organica-109',
  'requerimento-103',
  'indicacao-108',
];

async function buscarSubtipo(subtipo, ano) {
  const results = [];
  let pagina = 1;

  while (true) {
    const url = `${SERVICE_URL}?host=sbc&subtipo=${subtipo}&ano=${ano}&pagina=${pagina}`;
    let data;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      data = await res.json();
    } catch (err) {
      console.error(`[sbc] Erro subtipo=${subtipo} pagina=${pagina}: ${err.message}`);
      break;
    }

    if (!data.proposituras || data.proposituras.length === 0) break;

    for (const p of data.proposituras) {
      results.push({
        id:     `sbc-${p.id}`,
        titulo: p.ementa || p.tipo,
        ementa: p.ementa || '',
        tipo:   p.tipo   || 'Propositura',
        ano:    String(ano),
        url:    p.url,
      });
    }

    if (!data.temProxima) break;
    pagina++;
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
      console.log(`[sbc] ${subtipo}: ${items.length} proposituras`);
    }
  }

  return todos;
}

module.exports = { buscarProposicoes };
