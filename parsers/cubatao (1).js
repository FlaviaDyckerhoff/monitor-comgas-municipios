// parsers/cubatao.js
// Parser para a Câmara Municipal de Cubatão/SP
// Sistema: Plone CMS, página HTML estática por ano
// URL: /processo-legislativo/projetos-de-lei/projetos-de-lei-e-vetos-AAAA
// Dados: tabela HTML com PROC, AUTOR, TIPO, DATA, ASSUNTO (ementa+link PDF), STATUS
// Sem paginação — tudo em uma página (~40 PLs/ano)
// Limitação: só PLs são atualizados — indicações/req não disponíveis publicamente

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const url = `${url_base}/processo-legislativo/projetos-de-lei/projetos-de-lei-e-vetos-${ano}`;

  console.log(`  [${nome}] Buscando PLs de ${ano}...`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
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

  const html = await response.text();
  const props = parsearHTML(html, url_base, ano);
  console.log(`  [${nome}] → ${props.length} proposituras`);
  return props;
}

function parsearHTML(html, url_base, ano) {
  const proposituras = [];
  const vistos = new Set();

  // Cada linha da tabela: <tr><td>PROC</td><td>AUTOR</td><td>TIPO</td><td>DATA</td><td><a href="PDF">EMENTA</a></td><td>STATUS</td></tr>
  const linhaRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;

  while ((m = linhaRegex.exec(html)) !== null) {
    const linha = m[1];
    const tds = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(t =>
      t[1].replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length < 5) continue;

    const proc = tds[0];
    const autor = tds[1];
    const tipo = tds[2];
    const data = tds[3];
    const assunto = tds[4];

    // Ignora cabeçalho e linhas sem dados úteis
    if (!proc || proc === 'PROC.' || !tipo || !data.match(/\d{2}\/\d{2}\/\d{4}/)) continue;
    if (vistos.has(proc)) continue;
    vistos.add(proc);

    // Extrai link do PDF da célula de assunto
    const pdfMatch = linha.match(/href="([^"]*\.pdf[^"]*)"/i);
    const url_prop = pdfMatch
      ? (pdfMatch[1].startsWith('http') ? pdfMatch[1] : `${url_base}${pdfMatch[1]}`)
      : url_base + `/processo-legislativo/projetos-de-lei/projetos-de-lei-e-vetos-${ano}`;

    // Ementa é o texto da célula assunto (sem tags)
    const ementaMatch = linha.match(/<td[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : assunto.substring(0, 400);

    proposituras.push({
      id: `cubatao-${proc.replace(/\//g, '-')}`,
      tipo: tipo || 'Propositura',
      numero: `${tipo}/${ano}`.replace(/\s+/g, ''),
      data,
      autor,
      ementa,
      url: url_prop,
    });
  }

  return proposituras;
}

module.exports = { buscar };
