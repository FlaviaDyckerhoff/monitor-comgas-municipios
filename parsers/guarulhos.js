// parsers/guarulhos.js
// Parser para a Câmara Municipal de Guarulhos/SP
// Sistema: Legisoft com Cloudflare — acesso via microserviço Puppeteer local
// Microserviço: http://localhost:3002/proposicoes
// Tipos mapeados pelo Vini no legisoft.go

const SERVICO_URL = 'http://localhost:3002/proposicoes';

const TIPOS = [
  { nome: 'Projeto de Lei',                    subtipo: 'projeto-de-lei-20' },
  { nome: 'Indicação',                          subtipo: 'indicacao-12' },
  { nome: 'Requerimento',                       subtipo: 'requerimento-22' },
  { nome: 'Moção',                              subtipo: 'mocao-13' },
  { nome: 'Projeto de Decreto Legislativo',     subtipo: 'projeto-de-decreto-legislativo-17' },
  { nome: 'Projeto de Resolução',               subtipo: 'projeto-de-resolucao-21' },
  { nome: 'Projeto de Emenda à Lei Orgânica',   subtipo: 'projeto-de-emenda-a-lei-organica-18' },
];

async function buscar(municipio) {
  const { nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);
    let pagina = 1;

    while (true) {
      const url = `${SERVICO_URL}?subtipo=${tipo.subtipo}&ano=${ano}&pagina=${pagina}`;

      let response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      } catch (err) {
        console.error(`  [${nome}] Erro ao chamar microserviço: ${err.message}`);
        break;
      }

      if (!response.ok) {
        console.error(`  [${nome}] Microserviço retornou ${response.status}`);
        break;
      }

      let json;
      try {
        json = await response.json();
      } catch (err) {
        console.error(`  [${nome}] Resposta inválida: ${err.message}`);
        break;
      }

      const props = json.proposituras || [];
      console.log(`  [${nome}] ${tipo.nome} p.${pagina} → ${props.length} itens`);

      todas.push(...props);

      if (!json.temProxima || props.length === 0 || pagina >= 50) break;
      pagina++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return todas;
}

module.exports = { buscar };
