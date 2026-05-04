// parsers/sao-caetano-sul.js
// Parser para a Câmara Municipal de São Caetano do Sul/SP
// Sistema: Mirasoft mLegislativo
// URL: POST /PortalMunicipe/Processos?page=N&ano=AAAA&IdClassificacao=N
// Campos inline: Protocolo, Data, Nome (autor), Classificação, Ementa
// ID único: número no link /AcompanhamentoEmail/XXXXXX

const TIPOS = [
  { nome: 'Projeto de Lei',              id: 3 },
  { nome: 'Indicação',                   id: 1 },
  { nome: 'Requerimento',                id: 2 },
  { nome: 'Moção',                       id: 7 },
  { nome: 'Projeto de Decreto Leg.',     id: 4 },
  { nome: 'Projeto de Resolução',        id: 5 },
  { nome: 'Emenda à Lei Orgânica',       id: 6 },
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);
    let pagina = 1;

    while (true) {
      const url = `${url_base}/PortalMunicipe/Processos?page=${pagina}&ano=${ano}&IdClassificacao=${tipo.id}`;

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Content-Length': '0',
          }
        });
      } catch (err) {
        console.error(`  [${nome}] Erro de conexão: ${err.message}`);
        break;
      }

      if (!response.ok) {
        console.error(`  [${nome}] Erro HTTP ${response.status}`);
        break;
      }

      const html = await response.text();
      const { props, temProxima } = parsearHTML(html, url_base, tipo.nome);

      todas.push(...props);
      console.log(`  [${nome}] ${tipo.nome} p.${pagina} → ${props.length} itens`);

      if (!temProxima || props.length === 0 || pagina >= 700) break;
      pagina++;
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return todas;
}

function parsearHTML(html, url_base, tipoNome) {
  const props = [];
  const vistos = new Set();

  // ID único: /AcompanhamentoEmail/282264
  const blocoRegex = /AcompanhamentoEmail\/(\d+)/g;
  let m;

  while ((m = blocoRegex.exec(html)) !== null) {
    const id_interno = m[1];
    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 2000), idx + 500);

    // Protocolo
    const protMatch = bloco.match(/Número de Protocolo[^:]*:\s*([\d\/]+)/i);
    const protocolo = protMatch ? protMatch[1].trim() : id_interno;

    // Data
    const dataMatch = bloco.match(/Data de Abertura[^:]*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const data = dataMatch ? dataMatch[1] : '-';

    // Autor
    const autorMatch = bloco.match(/Apelido[^:]*:\s*([^\n<]{3,60})/i)
      || bloco.match(/Nome[^:]*:\s*([^\n<]{3,60})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Ementa — dentro do panel-body do collapse
    const ementaMatch = bloco.match(/class="panel-body">\s*([\s\S]{10,600}?)\s*<\/div>/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : tipoNome;

    const url_prop = `${url_base}/PortalMunicipe/AcompanhamentoEmail/${id_interno}`;

    props.push({
      id: `sao-caetano-sul-${id_interno}`,
      tipo: tipoNome,
      numero: protocolo,
      data,
      autor,
      ementa,
      url: url_prop,
    });
  }

  // Verifica próxima página
  const temProxima = html.includes('Próxima') && !html.includes('page-item disabled">') || html.includes('>Próxima<');

  return { props, temProxima };
}

module.exports = { buscar };
