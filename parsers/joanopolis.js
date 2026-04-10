// parsers/joanopolis.js
// Parser para a Câmara Municipal de Joanópolis/SP
// API JSON própria: GET /processo-legislativo/proposituras/?ano_arquivo=AAAA&pesquisar=true&api=true
// Retorna sempre os 10 mais recentes — sem paginação funcional via parâmetro
// Estratégia: pegar os 10 mais recentes por run, parar quando encontrar IDs já vistos

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();

  const url = `${url_base}/processo-legislativo/proposituras/?numero=&ano_arquivo=${ano}&numero_protocolo=&author=&tipo_autoria=all&categoria=&situacao=&setor=&keyWord=&pesquisar=true&api=true`;

  console.log(`  [${nome}] Buscando proposituras de ${ano}...`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'application/json, text/html',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      }
    });
  } catch (err) {
    console.error(`  [${nome}] Erro de conexão: ${err.message}`);
    return [];
  }

  if (!response.ok) {
    console.error(`  [${nome}] Erro HTTP ${response.status}`);
    return [];
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    console.error(`  [${nome}] Resposta não é JSON: ${err.message}`);
    return [];
  }

  const lista = json.files || [];
  console.log(`  [${nome}] → ${lista.length} proposituras`);

  return lista.map(p => {
    const ementa = (p.descricao || '')
      .replace(/\r\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 400);

    // URL de detalhe
    const url_prop = `${url_base}/processo-legislativo/detalhes/?id_file=${p.id}`;

    // URL do PDF se disponível
    const url_pdf = p.arquivo_pdf && p.arquivo_pdf !== '#'
      ? `${url_base}/processo-legislativo/arquivos/${p.arquivo_pdf}`
      : url_prop;

    return {
      id: `joanopolis-${p.id}`,
      tipo: p.categoria || '-',
      numero: p.numero_documento || '-',
      data: p.data_arquivo || '-',
      autor: p.autor || '-',
      ementa,
      url: url_prop,
    };
  });
}

module.exports = { buscar };
