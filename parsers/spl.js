// parsers/spl.js
// Parser para câmaras que usam o sistema SPL (Ágape Consultoria)
// API: GET /api/publico/proposicao/?pg=N&qtd=100&ano=AAAA
// Testado em: Tremembé/SP, Santo André/SP, Caçapava/SP, Taubaté/SP

// Siglas de documentos derivados — não são proposituras originais
const SIGLAS_IGNORAR = new Set([
  'PC',   // Parecer da Comissão
  'PAR',  // Parecer
  'AUT',  // Autógrafo
  'SUB',  // Substitutivo
  'EMD',  // Emenda
  'VET',  // Veto (opcional — remova se quiser monitorar vetos)
  'DES',  // Despacho
  'OF',   // Ofício
  'NR',   // Nova Redação
]);

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  const idsVistos = new Set();
  let pagina = 1;

  while (true) {
    const url = `${url_base}/api/publico/proposicao/?pg=${pagina}&qtd=100&ano=${ano}`;
    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      },
      signal: AbortSignal.timeout(30000), // SJC é lento — precisa de 30s
    });

    if (!response.ok) {
      if (response.status === 500) break;
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    let json;
    try {
      json = await response.json();
    } catch (e) {
      console.error(`  [${nome}] Resposta não é JSON: ${e.message}`);
      break;
    }

    const resultados = json.Data || json.data || json.results || json.items || [];
    const total = json.Total || json.total || json.count || 0;
    console.log(`  [${nome}] → ${resultados.length} proposições (total: ${total})`);

    if (resultados.length === 0) break;

    let novasPagina = 0;
    for (const p of resultados) {
      const idRaw = p.Id || p.id || p.ProposicaoId || p.proposicaoId || p.Codigo || p.codigo;
      if (!idRaw) continue;

      if (idsVistos.has(String(idRaw))) continue;
      idsVistos.add(String(idRaw));

      const anoP = String(p.Ano || p.ano || '');
      if (anoP && anoP !== String(ano)) continue;

      // Filtrar documentos derivados por sigla
      const sigla = (p.Sigla || p.sigla || '').toUpperCase();
      if (SIGLAS_IGNORAR.has(sigla)) continue;

      novasPagina++;

      const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${idRaw}`;

      const tipoDesc = p.Tipo || p.tipo || p.TipoDescricao || p.tipoDescricao || sigla || '-';
      const tipo = typeof tipoDesc === 'object' ? (tipoDesc.Descricao || tipoDesc.descricao || sigla) : tipoDesc;

      const numero = p.Numero || p.numero || '';
      const numeroAno = numero ? `${numero}/${anoP || ano}` : `${anoP || ano}`;

      const dataRaw = p.Data || p.data || p.DataApresentacao || p.dataApresentacao
        || p.DataProtocolo || p.dataProtocolo || '';
      let data = '-';
      if (dataRaw) {
        const isoMatch = dataRaw.match(/(\d{4})-(\d{2})-(\d{2})/);
        const brMatch  = dataRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        const msMatch  = dataRaw.match(/\/Date\((\d+)[\+\-]/);
        if (isoMatch) data = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        else if (brMatch) data = `${brMatch[1]}/${brMatch[2]}/${brMatch[3]}`;
        else if (msMatch) data = new Date(parseInt(msMatch[1])).toLocaleDateString('pt-BR');
      }

      let autor = '-';
      const autoresRaw = p.Autores || p.autores || p.Autor || p.autor
        || p.AutorRequerenteDados;
      if (Array.isArray(autoresRaw)) {
        autor = autoresRaw.map(a => a.Nome || a.nome || a.NomeAutor || a.nomeAutor || a.nomeRazao || '').filter(Boolean).join(', ') || '-';
      } else if (autoresRaw && typeof autoresRaw === 'object') {
        autor = autoresRaw.nomeRazao || autoresRaw.Nome || autoresRaw.nome || '-';
      } else if (typeof autoresRaw === 'string' && autoresRaw) {
        autor = autoresRaw;
      }

      const ementa = (p.Ementa || p.ementa || p.Assunto || p.assunto || '-')
        .toString().trim().substring(0, 400);

      const processo = p.Processo || p.processo || p.NumProcesso || p.numProcesso || idRaw;
      const url_prop = p.Url || p.url || `${url_base}/spl/processo.aspx?id=${processo}`;

      todas.push({ id, tipo, numero: numeroAno, data, autor, ementa, url: url_prop });
    }

    if (novasPagina === 0) break;
    if (pagina * 100 >= total || resultados.length < 100 || pagina >= 100) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

module.exports = { buscar };
