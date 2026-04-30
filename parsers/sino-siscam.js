// parsers/sino-siscam.js
// Parser para câmaras que usam o sistema SINO Siscam
// Suporta dois endpoints:
//   - /Documentos (legado, usado por Botucatu/Várzea Paulista/Bragança Paulista)
//   - /Documentos/Pesquisa (novo, usado por Paulínia/Itaquaquecetuba/Itatiba/Piracicaba/Mauá)
// Ementa disponível apenas na página de detalhe — buscada via enriquecerEmentas
// ID do sistema (siscam_id) configurado por município no municipios.json

function decodificarEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function buscar(municipio) {
  const { url_base, nome, grupo_id, tipo_ids, siscam_id, siscam_tipos } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  // Modo novo: siscam_id + siscam_tipos (Paulínia, Itatiba, etc.)
  if (siscam_id && siscam_tipos) {
    for (const tipo of siscam_tipos) {
      let pagina = 1;
      while (true) {
        const url = `${url_base}/Documentos/Pesquisa?Pesquisa=Avancada&id=${siscam_id}&pagina=${pagina}&Modulo=8&Documento=${tipo.documento}&Numeracao=Documento&AnoInicial=${ano}&AnoFinal=${ano}&DocumentosRelacionadosDetalhes=false&SubDocumentoId=0&SubTipoId=0&Situacao=0&Classificacao=0&TipoAutor=Todos&AutoriaId=0&Iniciativa=Nenhum&NoTexto=false`;

        console.log(`  [${nome}] ${tipo.nome} p.${pagina}...`);

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
          break;
        }

        if (!response.ok) {
          console.error(`  [${nome}] Erro HTTP ${response.status}`);
          break;
        }

        const html = await response.text();
        const props = parsearHTMLNovo(html, url_base, nome);
        console.log(`  [${nome}] → ${props.length} proposituras`);

        todas.push(...props);

        const temProxima = html.includes(`pagina=${pagina + 1}`);
        if (!temProxima || props.length === 0 || pagina >= 20) break;
        pagina++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return todas;
  }

  // Modo legado: grupo_id + tipo_ids (Botucatu, Várzea Paulista, Bragança Paulista)
  const tipoParams = tipo_ids.map(id => `TipoId=${id}`).join('&');
  let pagina = 1;

  while (true) {
    const url = `${url_base}/Documentos?Pesquisa=Avancada&ShowSearch=False&GrupoId=${grupo_id}&${tipoParams}&SubtipoId=&Numeracao=Documento&NumeroSufixo=&Ano=${ano}&Data=&Ementa=&Observacoes=&SituacaoId=&ClassificacaoId=&RegimeId=&QuorumId=&TipoAutorId=&AutorId=&TipoIniciativaId=&Ordenacao=3&ItemsPerPage=100&NoTexto=false&Pagina=${pagina}`;

    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const props = parsearHTMLLegado(html, url_base, nome);
    console.log(`  [${nome}] → ${props.length} proposituras`);

    todas.push(...props);

    const temProxima = html.includes(`Pagina=${pagina + 1}`) || html.includes(`pagina=${pagina + 1}`);
    if (!temProxima || props.length === 0 || pagina >= 10) break;

    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

// Parser para endpoint novo (/Documentos/Pesquisa) — usa title= do link
function parsearHTMLNovo(html, url_base, nome) {
  const proposicoes = [];
  const idsVistos = new Set();

  // Links: <a href="/Documentos/Documento/160535" title="Projeto de Lei Nº 52/2026">
  const linkRegex = /href="(\/Documentos\/Documento\/(\d+))"[^>]*title="([^"]+)"/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const id = m[2];
    const titulo = m[3].trim();

    // Ignora documentos relacionados
    if (/ ao /i.test(titulo)) continue;

    if (idsVistos.has(id)) continue;
    idsVistos.add(id);

    const numMatch = titulo.match(/N[ºoO°\xba]?\.?\s*(\d+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '-';

    const tipoRaw = titulo.replace(/N[ºoO°\xba]?\.?\s*\d+\/\d{4}/i, '').trim();
    const tipo = decodificarEntities(tipoRaw) || titulo;

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 200), idx + 500);
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    const url_prop = `${url_base}${href}`;
    const id_unico = `${nome.toLowerCase().replace(/[\s/]+/g, '-')}-${id}`;

    proposicoes.push({
      id: id_unico,
      tipo,
      numero,
      data,
      autor: '-',
      ementa: '',
      url: url_prop,
      _id: id,
      _grupo_id: null,
      _url_base: url_base,
      _endpoint: 'novo',
    });
  }

  return proposicoes;
}

// Parser para endpoint legado (/Documentos) — usa href com Details?id=
function parsearHTMLLegado(html, url_base, nome) {
  const proposicoes = [];
  const idsVistos = new Set();

  const linkRegex = /href="([^"]*\/Documentos\/Details\?id=(\d+)(?:&(?:amp;)?grupoId=(\d+))?[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const id = m[2];
    const grupoId = m[3] || '';
    const texto = m[4].trim();

    if (/ ao /i.test(texto)) continue;
    if (idsVistos.has(id)) continue;
    idsVistos.add(id);

    const numMatch = texto.match(/N[ºoO°\xba]?\.?\s*(\d+\/\d{4})/i);
    const numero = numMatch ? numMatch[1] : '-';

    const tipoRaw = texto.replace(/N[ºoO°\xba]?\.?\s*\d+\/\d{4}/i, '').trim();
    const tipo = decodificarEntities(tipoRaw) || texto;

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 200), idx + 800);
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    const url_prop = href.startsWith('http')
      ? href.replace(/&amp;/g, '&')
      : `${url_base}${href.replace(/&amp;/g, '&')}`;

    const id_unico = `${nome.toLowerCase().replace(/[\s/]+/g, '-')}-${id}`;

    proposicoes.push({
      id: id_unico,
      tipo,
      numero,
      data,
      autor: '-',
      ementa: '',
      url: url_prop,
      _id: id,
      _grupo_id: grupoId,
      _url_base: url_base,
      _endpoint: 'legado',
    });
  }

  return proposicoes;
}

// Busca ementa na página de detalhe
async function buscarEmenta(url_base, id, grupoId, endpoint) {
  let url;
  if (endpoint === 'novo') {
    url = `${url_base}/Documentos/Documento/${id}`;
  } else {
    url = grupoId
      ? `${url_base}/Documentos/Details?id=${id}&grupoId=${grupoId}`
      : `${url_base}/Documentos/Details?id=${id}`;
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
    });
    if (!response.ok) return '-';
    const html = await response.text();
    const match = html.match(/<strong>Ementa:<\/strong>\s*([\s\S]{5,500}?)(?=<\/p>|<strong>)/i)
      || html.match(/Ementa[^<]*<\/[^>]+>\s*([\s\S]{5,500}?)(?=<\/p>|<strong>)/i);
    if (match) {
      return decodificarEntities(
        match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      );
    }
    return '-';
  } catch {
    return '-';
  }
}

// Hook chamado pelo monitor.js apenas para itens novos
async function enriquecerEmentas(itens) {
  for (const item of itens) {
    if (!item._id) continue;
    item.ementa = await buscarEmenta(item._url_base, item._id, item._grupo_id, item._endpoint);
    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = { buscar, enriquecerEmentas };
