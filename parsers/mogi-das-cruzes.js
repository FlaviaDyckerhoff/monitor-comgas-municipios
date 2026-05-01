// parsers/mogi-das-cruzes.js
// Parser para a Câmara Municipal de Mogi das Cruzes/SP
// API JSON própria: GET /api/projetos.php?tipodoc=N&ano=AAAA&itens_pagina=100&pagina=N
// Endpoint único para todos os tipos — mesmo para indicações e requerimentos

const TIPOS = [
  { nome: 'Projeto de Lei',                    tipodoc: 9 },
  { nome: 'Projeto de Lei Complementar',       tipodoc: 5 },
  { nome: 'Projeto de Emenda à Lei Orgânica',  tipodoc: 4 },
  { nome: 'Projeto de Decreto Legislativo',    tipodoc: 6 },
  { nome: 'Projeto de Resolução',              tipodoc: 10 },
  { nome: 'Requerimento',                      tipodoc: 3 },
  { nome: 'Moção',                             tipodoc: 2 },
  { nome: 'Indicação',                         tipodoc: 1 },
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);
    let pagina = 1;

    while (true) {
      const url = `${url_base}/api/projetos.php?ano=${ano}&tipodoc=${tipo.tipodoc}&itens_pagina=100&pagina=${pagina}`;

      let response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });
      } catch (err) {
        console.error(`  [${nome}] Erro de conexão: ${err.message}`);
        break;
      }

      if (!response.ok) {
        console.error(`  [${nome}] Erro HTTP ${response.status}`);
        break;
      }

      const json = await response.json();
      const resultado = json.resultado || [];
      const totalPaginas = parseInt(json.paginacao?.total_paginas || 1);

      console.log(`  [${nome}] ${tipo.nome} p.${pagina}/${totalPaginas} → ${resultado.length} itens`);

      for (const r of resultado) {
        const codigo = r.codigo || '';
        if (!codigo) continue;

        const data = r.data
          ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')
          : '-';

        const ementa = (r.assunto || '-').trim().substring(0, 400);
        const numero = r.numero || '-';
        const url_prop = r.url || `${url_base}/siteadmin/projetos/anexos/`;

        todas.push({
          id: `mogi-das-cruzes-${codigo}`,
          tipo: tipo.nome,
          numero: `${numero}/${ano}`,
          data,
          autor: '-',
          ementa,
          url: url_prop,
        });
      }

      if (pagina >= totalPaginas || resultado.length === 0) break;
      pagina++;
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return todas;
}

module.exports = { buscar };
