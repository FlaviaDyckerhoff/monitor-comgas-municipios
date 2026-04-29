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

    const html = await response.text();

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

    // Tipo
    const tipoMatch = bloco.match(/Tipo:\s*<\/strong>\s*([^\n<]{3,60})/i)
      || bloco.match(/Tipo:\s*([^\n<]{3,60})/i);
    const tipo = tipoMatch ? tipoMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Número
    const numMatch = bloco.match(/N[ºo°]?\s*([\d]+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '-';

    // Data
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Autor
    const autorMatch = bloco.match(/Autor:\s*<\/strong>\s*([^\n<]{3,80})/i)
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
    // Página pode ser Latin-1
    let html;
    try {
      html = new TextDecoder('utf-8').decode(buf);
    } catch {
      html = new TextDecoder('latin1').decode(buf);
    }

    // Ementa está em <span class="align-middle h-auto">TEXTO</span>
    // dentro de <div class="form-control-static"> após <p class="control-label">Ementa</p>
    const match = html.match(/align-middle[^>]*>([\s\S]{5,500}?)<\/span>/i)
      || html.match(/form-control-static[^>]*>[\s\S]{0,100}?<span[^>]*>([\s\S]{5,500}?)<\/span>/i)
      || html.match(/Ementa<\/p>[\s\S]{0,300}?<span[^>]*>([\s\S]{5,500}?)<\/span>/i);

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
