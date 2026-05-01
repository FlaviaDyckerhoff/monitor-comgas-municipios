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
    .map(p => {
      const anoItem = p.ano || ano;
      const numero  = p.numero ? `${p.numero}/${anoItem}` : '-';
      // data: "2026-01-06T00:00:00" → "06/01/2026"
      let data = '-';
      if (p.data) {
        const d = new Date(p.data);
        if (!isNaN(d)) data = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      }
      return {
        id:     `sp-${p.chave || p.numero}`,
        titulo: `${p.tipo} ${numero}`,
        numero,
        data,
        ementa: (p.ementa || '').trim(),
        tipo:   p.tipo,
        ano:    String(anoItem),
        url:    `https://www.saopaulo.sp.leg.br/atividade-legislativa/proposicoes/?tipo=${p.tipo}&numero=${p.numero}&ano=${anoItem}`,
      };
    });
}

module.exports = { buscar };
