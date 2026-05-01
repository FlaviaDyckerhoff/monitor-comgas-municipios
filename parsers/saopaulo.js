'use strict';

// parsers/saopaulo.js
// Parser para Câmara Municipal de São Paulo (CMSP)
// API: https://splegisws.saopaulo.sp.leg.br/ws/ws2.asmx/ProjetosPorAnoJSON

const API_BASE = 'https://splegisws.saopaulo.sp.leg.br/ws/ws2.asmx';

const TIPOS_MONITORADOS = new Set([
  'PL', 'PDL', 'PR', 'PLO', 'MOC', 'IND',
  'REQ', 'RPL', 'AUD', 'RDS',
  'RPP', 'RPS', 'RDP', 'REQCOM', 'RSC',
]);

async function buscar(municipio) {
  const ano = new Date().getFullYear();
  console.log(`[São Paulo] Buscando proposições de ${ano}...`);

  let lista;
  try {
    const res = await fetch(`${API_BASE}/ProjetosPorAnoJSON?Ano=${ano}`, {
      signal: AbortSignal.timeout(60000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    lista = await res.json();
  } catch (err) {
    console.error(`[São Paulo] Erro na API: ${err.message}`);
    return [];
  }

  console.log(`[São Paulo] Total API: ${lista.length} | Filtrando tipos monitorados...`);

  return lista
    .filter(p => TIPOS_MONITORADOS.has(p.tipo))
    .map(p => ({
      id:     `sp-${p.id || p.IdProposicao || p.numero}`,
      titulo: `${p.tipo} ${p.numero}/${p.ano || ano}`,
      ementa: p.ementa || p.Ementa || p.titulo || '',
      tipo:   p.tipo,
      ano:    String(p.ano || ano),
      url:    p.url || `https://www.saopaulo.sp.leg.br/atividade-legislativa/proposicoes/?tipo=${p.tipo}&numero=${p.numero}&ano=${p.ano || ano}`,
    }));
}

module.exports = { buscar };
