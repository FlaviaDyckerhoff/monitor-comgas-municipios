// parsers/backsite.js
// Parser para câmaras que usam o sistema Backsite
// Servidor retorna sempre as 100 proposições mais recentes (paginação não funciona via API)
// Testado em: Câmara Municipal de Santos/SP

async function buscar(municipio) {
  const { url_base, nome, backsite_path } = municipio;
  const ano = new Date().getFullYear();

  const path = backsite_path || '/dispositivo/customizado_publico/legislativo/busca_propositura_pub/';
  const indexUrl = `${url_base}${path}index.php`;

  const qs = new URLSearchParams({
    'c522f793bcf692_tipo': '',
    'c522f747124526_ano': ano,
    'busca': '1',
    'local': '-1',
    'inicio': 0,
  });

  console.log(`  [${nome}] Buscando proposições de ${ano}...`);

  const response = await fetch(`${indexUrl}?${qs.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Chrome/120',
      'Accept': 'text/html',
      'Referer': `${url_base}${path}`,
    },
  });

  if (!response.ok) {
    console.error(`  [${nome}] Erro HTTP ${response.status}`);
    return [];
  }

  // HTML em Latin-1
  const html = Buffer.from(await response.arrayBuffer()).toString('latin1');

  const proposituras = parsearHTML(html, url_base, nome);
  console.log(`  [${nome}] → ${proposituras.length} proposituras`);

  const totalMatch = html.match(/Mostrando\s+\d+\s+de\s+(\d+)\s+proposituras/i);
  if (totalMatch) {
    console.log(`  [${nome}] Total no servidor: ${totalMatch[1]} (exibindo mais recentes)`);
  }

  return proposituras;
}

function parsearHTML(html, url_base, nome) {
  const proposituras = [];
  const idsVistos = new Set();

  // Âncora de cada card: <strong>Tipo - Nº N/ANO [Processo Nº N/ANO]</strong>
  const cardRegex = /<strong>([^<]+?)\s*-\s*N[\xbaº°o]\.?\s*(\d+\/\d{4})\s*\[Processo\s+N[\xbaº°o]\.?\s*(\d+\/\d{4})\]<\/strong>/g;

  const cards = [];
  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    cards.push({ tipo: m[1].trim(), numeroAno: m[2], index: m.index });
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const fim = cards[i + 1] ? cards[i + 1].index : card.index + 4000;
    const bloco = html.substring(card.index, fim);

    // ID único: auto_10 do bloco Array
    const autoMatch = bloco.match(/\[auto_10\]\s*=>\s*(\d+)/);
    if (!autoMatch) continue;
    const autoId = autoMatch[1];

    if (idsVistos.has(autoId)) continue;
    idsVistos.add(autoId);

    const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${autoId}`;

    // Data — campo c522f7549334b2_data (formato ISO: 2026-04-07)
    const dataMatch = bloco.match(/\[c522f7549334b2_data\]\s*=>\s*(\d{4}-\d{2}-\d{2})/);
    let data = '-';
    if (dataMatch) {
      const [, y, mo, d] = dataMatch[1].match(/(\d{4})-(\d{2})-(\d{2})/);
      data = `${d}/${mo}/${y}`;
    }

    // Ementa — campo c522f756ae367a_ementa
    const ementaMatch = bloco.match(/\[c522f756ae367a_ementa\]\s*=>\s*([^\n\[]{5,600})/);
    const ementa = ementaMatch ? ementaMatch[1].trim().substring(0, 400) : '-';

    // URL — página real da proposição (busca_documento_pub/detalhes.php)
    const detalhesMatch = bloco.match(/href="([^"]*busca_documento_pub[^"]*detalhes\.php\?cod=\d+[^"]*)"/i);
    const url_prop = detalhesMatch
      ? (detalhesMatch[1].startsWith('http') ? detalhesMatch[1] : `${url_base}${detalhesMatch[1]}`)
      : `${url_base}/dispositivo/customizado_publico/legislativo/busca_documento_pub/detalhes.php?cod=${autoId}`;

    proposituras.push({ id, tipo: card.tipo, numero: card.numeroAno, data, autor: '-', ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
