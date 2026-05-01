// parsers/sbc.js
// Parser para a Câmara de São Bernardo do Campo/SP
// Sistema: Legisoft com captcha — acesso via microserviço Puppeteer local
// Microserviço: http://localhost:3002/proposicoes?host=sbc

const SERVICO_URL = 'http://localhost:3002/proposicoes';

const TIPOS = [
  { nome: 'Projeto de Lei', subtipo: 'projeto-de-lei-101' },
  { nome: 'Projeto de Lei Complementar', subtipo: 'projeto-de-lei-complementar-105' },
  { nome: 'Projeto de Decreto Legislativo', subtipo: 'projeto-de-decreto-legislativo-106' },
  { nome: 'Projeto de Resolução', subtipo: 'projeto-de-resolucao-102' },
  { nome: 'Proposta de Emenda à Lei Orgânica', subtipo: 'proposta-de-emenda-a-lei-organica-109' },
  { nome: 'Requerimento', subtipo: 'requerimento-103' },
  { nome: 'Indicação', subtipo: 'indicacao-108' },
];

async function buscar(municipio) {
  const { nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`[${nome}] Buscando ${tipo.nome} de ${ano}...`);
    let pagina = 1;

    while (true) {
      const url = `${SERVICO_URL}?host=sbc&subtipo=${tipo.subtipo}&ano=${ano}&pagina=${pagina}`;

      let response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      } catch (err) {
        console.error(`[${nome}] Erro ao chamar microserviço: ${err.message}`);
        break;
      }

      if (!response.ok) {
        console.error(`[${nome}] Microserviço retornou ${response.status}`);
        break;
      }

      const json = await response.json();
      const props = (json.proposituras || []).map(p => ({
        ...p,
        id: `sbc-${p.id}`,
      }));

      console.log(`[${nome}] ${tipo.nome} p.${pagina} → ${props.length} itens`);
      todas.push(...props);

      if (!json.temProxima || props.length === 0 || pagina >= 50) break;
      pagina++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return todas;
}

module.exports = { buscar };
