// parsers/limeira.js
// Parser para a Câmara Municipal de Limeira/SP
// Sistema próprio — scraping HTML
// URL listagem: /Documentos/Pesquisa?Pesquisa=Avancada&id=79&pagina=N&Modulo=8&Documento=ID&AnoInicial=AAAA&AnoFinal=AAAA
// URL detalhe: /Documentos/Documento/ID (busca ementa no campo Assunto)
// Tipos: PL=133, Indicação=139, Moção=140, Requerimento=138, Req.CPI=2060

const TIPOS = [
  { nome: 'Projeto de Lei',   documento: 133 },
  { nome: 'Indicação',        documento: 139 },
  { nome: 'Moção',            documento: 140 },
  { nome: 'Requerimento',     documento: 138 },
  { nome: 'Requerimento CPI', documento: 2060 },
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const tipo of TIPOS) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);
    let pagina = 1;

    while (true) {
      const url = `${url_base}/Documentos/Pesquisa?Pesquisa=Avancada&id=79&pagina=${pagina}&Modulo=8&Documento=${tipo.documento}&Numeracao=Documento&AnoInicial=${ano}&AnoFinal=${ano}&DocumentosRelacionadosDetalhes=false&SubDocumentoId=0&SubTipoId=0&Situacao=0&Classificacao=0&TipoAutor=Todos&AutoriaId=0&Iniciativa=Nenhum&NoTexto=false`;

      let response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
      const { props, temProxima } = parsearListagem(html, url_base, tipo.nome, ano);

      todas.push(...props);
      console.log(`  [${nome}] ${tipo.nome} p.${pagina} → ${props.length} itens`);

      if (!temProxima || props.length === 0 || pagina >= 50) break;
      pagina++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Busca ementa na página de detalhe para itens sem ementa
  // (feito separadamente no monitor.js para itens novos apenas)
  return todas;
}

function parsearListagem(html, url_base, tipoNome, ano) {
  const props = [];
  const vistos = new Set();

  // Links de detalhe com title: <a href="/Documentos/Documento/420947" ... title="Projeto de Lei Nº 46/2026">
  // Ignora documentos relacionados que têm " ao " no título (Análises Técnicas, Pareceres, Relatores)
  const linkRegex = /href="(\/Documentos\/Documento\/(\d+))"[^>]*title="([^"]+)"/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const id_interno = m[2];
    const titulo = m[3].trim();

    // Ignora documentos relacionados (Análise Técnica, Parecer, Relator, etc.)
    if (titulo.includes(' ao ')) continue;

    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    // Extrai número do título
    const numMatch = titulo.match(/N[ºo°]\s*([\d]+\/\d{4})/i);
    // Data — dd/mm/aaaa
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Autor
    const autorMatch = bloco.match(/Autoria?:\s*([^<\n]{5,100})/i);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    const url_prop = `${url_base}${href}`;

    props.push({
      id: `limeira-${id_interno}`,
      tipo,
      numero,
      data,
      autor,
      ementa: '', // preenchido após buscar detalhe
      url: url_prop,
      _id_interno: id_interno, // usado para buscar ementa
    });
  }

  // Verifica se há próxima página
  const temProxima = html.includes(`pagina=${parseInt(html.match(/pagina=(\d+)/)?.[1] || 1) + 1}`)
    || html.includes('Próxima') || html.includes('próxima') || html.includes('&gt;&gt;');

  return { props, temProxima };
}

// Busca ementa na página de detalhe
async function buscarEmenta(url_base, id_interno) {
  const url = `${url_base}/Documentos/Documento/${id_interno}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    if (!response.ok) return '-';
    const html = await response.text();

    // Campo Assunto na página de detalhe
    const assuntoMatch = html.match(/Assunto:\s*<\/strong>\s*([\s\S]{10,400}?)(?=<\/p>|<strong>|Comissões)/i)
      || html.match(/<strong>Assunto:<\/strong>\s*([\s\S]{10,400}?)(?=<\/)/i);

    if (assuntoMatch) {
      return assuntoMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400);
    }
    return '-';
  } catch {
    return '-';
  }
}



// Enriquece ementas dos itens novos buscando página de detalhe
// Chamado pelo monitor.js apenas para itens novos (não no primeiro run completo)
async function enriquecerEmentas(itens) {
  for (const item of itens) {
    if (!item._id_interno) continue;
    item.ementa = await buscarEmenta(
      item.url.replace(`/Documentos/Documento/${item._id_interno}`, ''),
      item._id_interno
    );
    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = { buscar, buscarEmenta, enriquecerEmentas };
