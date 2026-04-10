// parsers/rgserra.js
// Parser para a Câmara Municipal de Rio Grande da Serra/SP
// Sistema: Joomla + DocMan — API JSON server-side (sem AJAX)
// API: GET /materias-legislativas-categorias/[subcat-slug]?format=json&limit=20&offset=N
// Documentos em: response.linked.documents[]
// Nota: sem ementa inline — usar title como ementa; PDF em links.file.href

const CATEGORIAS_BASE = [
  'indicacoes',
  'requerimentos',
  'mocoes',
  'projetos-de-leis',
  'pedidos-de-providencia',
  'atos',
  'decreto-legislativo',
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const cat of CATEGORIAS_BASE) {
    const subcatSlug = await descobrirSubcat(url_base, cat, ano);
    if (!subcatSlug) {
      console.log(`  [${nome}] ${cat}: sem subcat ${ano}, pulando`);
      continue;
    }

    console.log(`  [${nome}] Buscando ${cat} ${ano}...`);
    const docs = await buscarDocs(url_base, subcatSlug);
    console.log(`  [${nome}] → ${docs.length} docs em ${cat}`);
    todas.push(...docs);
    await new Promise(r => setTimeout(r, 500));
  }

  // Ordenar por data decrescente
  todas.sort((a, b) => b.data.localeCompare(a.data));

  return todas;
}

async function descobrirSubcat(url_base, catSlug, ano) {
  try {
    const r = await fetch(`${url_base}/materias-legislativas-categorias/${catSlug}?format=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const cats = (d.linked || {}).categories || [];
    const match = cats.find(c => c.title && c.title.includes(String(ano)));
    if (!match) return null;
    const href = (match.links || {}).self?.href || '';
    const slugMatch = href.match(/materias-legislativas-categorias\/([^?]+)/);
    return slugMatch ? slugMatch[1] : null;
  } catch {
    return null;
  }
}

async function buscarDocs(url_base, subcatSlug) {
  const LIMIT = 20;
  const docs = [];
  let offset = 0;

  while (true) {
    try {
      const url = `${url_base}/materias-legislativas-categorias/${subcatSlug}?format=json&limit=${LIMIT}&offset=${offset}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
      });
      if (!r.ok) break;
      const d = await r.json();
      const pageDocs = (d.linked || {}).documents || [];
      if (pageDocs.length === 0) break;

      for (const doc of pageDocs) {
        const title = doc.title || '';
        const { tipo, numero } = parsearTitulo(title);
        const urlDetalhe = (doc.links || {}).self?.href ||
          `${url_base}/materias-legislativas-categorias/${subcatSlug}/${doc.id}`;

        docs.push({
          id: `rgserra-${doc.id}`,
          tipo,
          numero,
          data: (doc.created_on || '-').substring(0, 10),
          autor: doc.created_by_name || '-',
          ementa: title,  // sem ementa inline — conteúdo só no PDF
          url: urlDetalhe,
        });
      }

      const total = (d.meta || {}).total || 0;
      offset += LIMIT;
      if (offset >= total || pageDocs.length < LIMIT) break;
      await new Promise(r => setTimeout(r, 400));
    } catch {
      break;
    }
  }

  return docs;
}

// "Indicação n 14.2026" → tipo="Indicação", numero="14/2026"
// "REQUERIMENTO n 10.2026" → tipo="Requerimento", numero="10/2026"
function parsearTitulo(title) {
  if (!title) return { tipo: 'Propositura', numero: '-' };

  const m = title.match(/^(.+?)\s+[nN]\s+(\d+)\.(\d{4})/);
  if (m) {
    const raw = m[1].trim();
    const tipo = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const numero = `${m[2]}/${m[3]}`;
    return { tipo, numero };
  }

  // Fallback: "Moção n 04.2026" com acento
  const m2 = title.match(/^([A-Za-zÀ-ú\s]+?)\s+[nN][º°]?\s*(\d+)[./](\d{4})/);
  if (m2) {
    return { tipo: m2[1].trim(), numero: `${m2[2]}/${m2[3]}` };
  }

  return { tipo: title.split(' ').slice(0, 2).join(' '), numero: '-' };
}

module.exports = { buscar };
