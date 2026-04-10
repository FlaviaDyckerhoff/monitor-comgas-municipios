// parsers/sapl.js
// Parser para câmaras que usam SAPL moderno (Interlegis 3.x)
// API REST padrão Django REST Framework em /api/materia/materialegislativa/
// Suporta dois formatos de paginação:
//   - Padrão DRF: { next, results }
//   - Campinas/customizado: { pagination: { next_page, total_pages }, results }
// Testado em: Socorro/SP, Campinas/SP, Boa Vista/RR, Rio Branco/AC

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/api/materia/materialegislativa/?ano=${ano}&page=${pagina}&page_size=100&ordering=-id`;
    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const json = await response.json();
    const resultados = json.results || [];
    console.log(`  [${nome}] → ${resultados.length} matérias`);

    for (const p of resultados) {
      const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${p.id}`;

      // Tipo: extrair do __str__ ("Projeto de Lei nº 12 de 2026" → "Projeto de Lei")
      const tipo = p.__str__
        ? p.__str__.replace(/\s+n[ºo°]?\s*\d+.*$/i, '').trim()
        : 'Matéria';

      const numero = `${p.numero}/${p.ano}`;

      const data = p.data_apresentacao
        ? new Date(p.data_apresentacao + 'T12:00:00').toLocaleDateString('pt-BR')
        : '-';

      const autor = (p.autores || [])
        .map(a => a.nome || a.autor_related?.nome || '')
        .filter(Boolean).join(', ') || '-';

      const ementa = (p.ementa || '-').trim().substring(0, 400);

      // Garante https na URL
      const url_prop = `${url_base}/materia/${p.id}`;

      todas.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
    }

    // Suporte aos dois formatos de paginação
    const temProxima =
      json.next ||                                    // DRF padrão
      (json.pagination && json.pagination.next_page); // Campinas

    if (!temProxima || resultados.length === 0 || pagina >= 50) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

module.exports = { buscar };
