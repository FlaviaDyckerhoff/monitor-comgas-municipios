// parsers/praia-grande.js
// Parser para a Câmara Municipal de Praia Grande/SP
// Sistema PHP próprio — server-side rendering, sem API JSON
// URL: GET /result_materias.php?ano_materia=AAAA&offset=N
// Ementa: buscada na página de detalhe detalhes_materia.php?codigo=XXXXX
// via enriquecerEmentas (só para itens novos)

const BASE_URL = 'https://www.praiagrande.sp.leg.br/dispositivo/ideCustom/camarapg_publico/materias_leg';

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let offset = 1;
  let totalPaginas = null;

  while (true) {
    const url = `${BASE_URL}/result_materias.php?ano_materia=${ano}&offset=${offset}`;
    console.log(`  [${nome}] Página ${offset}${totalPaginas ? '/' + totalPaginas : '/???'}...`);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': `${BASE_URL}/pesquisa.php`,
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

    const buf = await response.arrayBuffer();
    const html = Buffer.from(buf).toString('latin1');

    // Extrai total de matérias e calcula páginas na primeira requisição
    if (totalPaginas === null) {
      const totalMatch = html.match(/(\d+)\s+mat[eé]rias?\s+encontradas?/i)
        || html.match(/Total[^:]*:\s*(\d+)/i);
      if (totalMatch) {
        const total = parseInt(totalMatch[1]);
        totalPaginas = Math.ceil(total / 50); // ~50 por página
        console.log(`  [${nome}] Total: ${total} matérias, ${totalPaginas} páginas`);
      } else {
        totalPaginas = 300; // fallback
      }
    }

    const props = parsearHTML(html, ano);

    if (props.length === 0) break;
    todas.push(...props);

    if (offset >= totalPaginas || offset >= 300) break;
    offset++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`  [${nome}] → ${todas.length} proposituras no total`);
  return todas;
}

function parsearHTML(html, ano) {
  const proposituras = [];
  const vistos = new Set();

  // Link de detalhe: href="detalhes_materia.php?codigo=43783"
  const linkRegex = /href="detalhes_materia\.php\?codigo=(\d+)"/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const codigo = m[1];
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 100), idx + 1000);

    // Tipo e Número — estão dentro do link <a>: "Indicações Nº 2424/2026"
    const linkTextoMatch = bloco.match(/href="detalhes_materia\.php\?codigo=\d+"[^>]*>\s*([^\n<]{3,80}?)\s*<\/a>/i);
    const linkTexto = linkTextoMatch ? linkTextoMatch[1].trim() : '';
    const numMatch = linkTexto.match(/N[ºo°]?\s*([\d]+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '-';
    const tipoRaw = linkTexto.replace(/N[ºo°]?\s*[\d]+\/\d{4}/i, '').trim();
    const tipo = tipoRaw || '-';

    // Data — formato "30 de Abril de 2026"
    const MESES = {janeiro:'01',fevereiro:'02',março:'03',abril:'04',maio:'05',junho:'06',
                   julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12'};
    const dataExtensoMatch = bloco.match(/Data[^:]*:\s*<\/b>\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    let data = '-';
    if (dataExtensoMatch) {
      const dia = dataExtensoMatch[1].padStart(2,'0');
      const mes = MESES[dataExtensoMatch[2].toLowerCase()] || '00';
      const ano2 = dataExtensoMatch[3];
      data = `${dia}/${mes}/${ano2}`;
    } else {
      const dataNumMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dataNumMatch) data = dataNumMatch[1];
    }

    // Autor
    const autorMatch = bloco.match(/Autor:\s*<\/b>\s*([^\n<]{3,80})/i)
      || bloco.match(/Autor:\s*([^\n<]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    const url_prop = `${BASE_URL}/detalhes_materia.php?codigo=${codigo}`;

    proposituras.push({
      id: `praia-grande-${codigo}`,
      tipo,
      numero,
      data,
      autor,
      ementa: '', // preenchido por enriquecerEmentas
      url: url_prop,
      _codigo: codigo,
    });
  }

  return proposituras;
}

// Busca ementa na página de detalhe
async function buscarEmenta(codigo) {
  const url = `${BASE_URL}/detalhes_materia.php?codigo=${codigo}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
    });
    if (!response.ok) return '-';

    const buf = await response.arrayBuffer();
    const html = Buffer.from(buf).toString('latin1');

    // Ementa: dentro de form-control-static, após label "Ementa"
    const match = html.match(/Ementa<\/p>[\s\S]{0,300}?form-control-static[^>]*>[\s\S]{0,100}?<span[^>]*>([\s\S]{5,500}?)<\/span>/i)
      || html.match(/form-control-static[^>]*>[\s\S]{0,100}?<span[^>]*>([\s\S]{20,500}?)<\/span>/i);

    if (match) {
      return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400);
    }
    return '-';
  } catch {
    return '-';
  }
}

// Hook chamado pelo monitor.js apenas para itens novos
async function enriquecerEmentas(itens) {
  for (const item of itens) {
    if (!item._codigo) continue;
    item.ementa = await buscarEmenta(item._codigo);
    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = { buscar, enriquecerEmentas };
