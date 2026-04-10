// parsers/nazare-paulista.js
// Parser para o sistema PHP próprio da Câmara de Nazaré Paulista/SP

const TIPOS = [
  {
    nome: 'Projetos',
    pag: 'T1RFPU9UVT1PVEk9T0dZPU9HRT1PV0k9T1RZPQ==',
    tp: 10,
    view: 'getTPET',
    estado: 'tramitacao',
    tpBusca: 'projeto',
  },
  {
    nome: 'Indicações',
    pag: 'T0RVPU9UST1PRFk9T1dFPU9UST1PR009T1RVPU9XUT1PVGc9T1dVPQ==',
    tp: 5,
    tpBusca: 'indicacao',
  },
  {
    nome: 'Moções',
    pag: 'T0RVPU9UST1PRFk9T1dFPU9UST1PR009T1RVPU9XUT1PVGc9T1dVPQ==',
    tp: 4,
    tpBusca: 'mocao',
  },
  {
    nome: 'Requerimentos',
    pag: 'T0RVPU9UST1PRFk9T1dFPU9UST1PR009T1RVPU9XUT1PVGc9T1dVPQ==',
    tp: 3,
    tpBusca: 'requerimento',
  },
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);

    const params = new URLSearchParams({
      pag: tipo.pag,
      tp: tipo.tp,
      comissao: '',
      tpdocumento: '',
      estado: tipo.estado || '',
      ano,
    });

    if (tipo.view) params.set('view', tipo.view);

    const url = `${url_base}/?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status} em ${tipo.nome}`);
      continue;
    }

    const html = await response.text();
    const props = parsearListagem(html, url_base, tipo, ano);
    console.log(`  [${nome}] → ${props.length} ${tipo.nome}`);
    todas.push(...props);

    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

function parsearListagem(html, url_base, tipo, ano) {
  const proposituras = [];
  const linkRegex = /\?pag=[^"'&]+&(?:amp;)?id=(\d+)&(?:amp;)?tpBusca=([^"'&\s]+)/gi;
  const vistos = new Set();
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const id = m[1];
    const tpBusca = m[2];

    if (vistos.has(id)) continue;
    vistos.add(id);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 500), idx + 1000);

    const numMatch = bloco.match(/N[ºo°]?\s*\.?\s*(\d+\/\d{4})/i)
      || bloco.match(/(\d{2,4}\/\d{4})/);
    const numero = numMatch ? numMatch[1] : '-';

    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    const ementaMatch = bloco.match(/(?:Assunto|Ementa|Objeto)\s*:?\s*([^<\n]{20,400})/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 400)
      : tipo.nome;

    const autorMatch = bloco.match(/(?:Autor|Vereador[a]?)\s*:?\s*([A-ZÁÉÍÓÚÃÕ][^<\n]{3,60})/i);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    const urlDetalhe = `${url_base}/?pag=${encodeURIComponent(tipo.pag)}&id=${id}&tpBusca=${tpBusca}`;

    proposituras.push({
      id: `nazare-paulista-${id}`,
      tipo: tipo.nome,
      numero, data, autor, ementa,
      url: urlDetalhe,
    });
  }

  return proposituras;
}

module.exports = { buscar };
