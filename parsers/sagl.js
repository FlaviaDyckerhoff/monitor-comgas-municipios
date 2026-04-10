// parsers/sagl.js
// Parser para câmaras que usam o sistema SAGL 5.1 (OpenLegis)
// API: GET /@@materias?ano=AAAA&tipo=N
// Busca por cada tipo separadamente pois sem &tipo= retorna só o índice
// Testado em: Câmara de Hortolândia/SP

// Tipos disponíveis em Hortolândia
const TIPOS = [
  { id: 1,  nome: 'Projeto de Lei' },
  { id: 2,  nome: 'Projeto de Resolução' },
  { id: 3,  nome: 'Requerimento' },
  { id: 6,  nome: 'Projeto de Decreto Legislativo' },
  { id: 7,  nome: 'Moção' },
  { id: 8,  nome: 'Indicação' },
  { id: 9,  nome: 'Proposta de Emenda à Lei Orgânica' },
  { id: 20, nome: 'Projeto de Lei Complementar' },
  { id: 25, nome: 'Veto' },
];

async function buscar(municipio) {
  const { url_base, nome, sagl_tipos } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  // Usa tipos customizados se definidos no municipios.json, senão usa os padrão
  const tipos = sagl_tipos || TIPOS;

  for (const tipo of tipos) {
    const url = `${url_base}/@@materias?ano=${ano}&tipo=${tipo.id}`;
    console.log(`  [${nome}] Buscando tipo ${tipo.id} (${tipo.nome})...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status} para tipo ${tipo.id}`);
      continue;
    }

    const json = await response.json();
    const items = json.items || [];
    console.log(`  [${nome}] → ${items.length} ${tipo.nome}`);

    for (const item of items) {
      const titleMatch = (item.title || '').match(/^(.+?)\s+n[ºo°]?\s*([\d\/]+)$/i);
      const tipoNome = titleMatch ? titleMatch[1].trim() : tipo.nome;
      const numero = titleMatch ? titleMatch[2].trim() : '';

      const data = item.date
        ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '-';

      const autores = (item.authorship || [])
        .filter(a => a.firstAuthor)
        .map(a => a.title)
        .join(', ') || (item.authorship || []).map(a => a.title).join(', ') || '-';

      const ementa = (item.description || '-').trim().substring(0, 400);
      const url_prop = item.remoteUrl || `${url_base}/@@materias/${item.id}`;
      const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${item.id}`;

      todas.push({ id, tipo: tipoNome, numero, data, autor: autores, ementa, url: url_prop });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Ordena por id numérico decrescente
  todas.sort((a, b) => {
    const na = parseInt(a.id.split('-').pop()) || 0;
    const nb = parseInt(b.id.split('-').pop()) || 0;
    return nb - na;
  });

  return todas;
}

module.exports = { buscar };
