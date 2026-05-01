// parsers/jundiai.js
// Parser para a Câmara Municipal de Jundiaí/SP
// Sistema: SAGL — bloqueio TLS resolvido via Puppeteer no microserviço
// Microserviço: http://localhost:3002/sagl?host=jundiai&tipo=N&ano=AAAA

const SERVICO_URL = 'http://localhost:3002/sagl';

const TIPOS = [
  { id: 1,  nome: 'Projeto de Lei' },
  { id: 2,  nome: 'Projeto de Resolução' },
  { id: 3,  nome: 'Requerimento à Presidência' },
  { id: 5,  nome: 'Projeto de Lei Complementar' },
  { id: 6,  nome: 'Projeto de Decreto Legislativo' },
  { id: 7,  nome: 'Moção' },
  { id: 8,  nome: 'Indicação' },
  { id: 9,  nome: 'Requerimento ao Plenário' },
  { id: 11, nome: 'Proposta de Emenda à Lei Orgânica' },
  { id: 12, nome: 'Veto' },
];

async function buscar(municipio) {
  const { nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    const url = `${SERVICO_URL}?host=jundiai&tipo=${tipo.id}&ano=${ano}`;
    console.log(`  [${nome}] Buscando tipo ${tipo.id} (${tipo.nome})...`);

    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(90000) });
    } catch (err) {
      console.error(`  [${nome}] Erro ao chamar microserviço: ${err.message}`);
      continue;
    }

    if (!response.ok) {
      console.error(`  [${nome}] Microserviço retornou ${response.status}`);
      continue;
    }

    const json = await response.json();
    const items = json.items || [];
    console.log(`  [${nome}] → ${items.length} ${tipo.nome}`);

    for (const item of items) {
      const titleMatch = (item.title || '').match(/^(.+?)\s+n[ºo°]?\s*([\d\/]+)$/i);
      const tipoNome = titleMatch ? titleMatch[1].trim() : tipo.nome;
      const numero = titleMatch ? titleMatch[2].trim() : '';

      const data = item.date
        ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '-';

      const autores = (item.authorship || [])
        .filter(a => a.firstAuthor)
        .map(a => a.title)
        .join(', ') || (item.authorship || []).map(a => a.title).join(', ') || '-';

      const ementa = (item.description || '-').trim().substring(0, 400);
      const url_prop = item.remoteUrl || `https://sapl.jundiai.sp.leg.br/@@materias/${item.id}`;
      const id = `jundiai-${item.id}`;

      todas.push({ id, tipo: tipoNome, numero, data, autor: autores, ementa, url: url_prop });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  todas.sort((a, b) => {
    const na = parseInt(a.id.split('-').pop()) || 0;
    const nb = parseInt(b.id.split('-').pop()) || 0;
    return nb - na;
  });

  return todas;
}

module.exports = { buscar };
