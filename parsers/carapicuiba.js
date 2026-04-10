// parsers/carapicuiba.js
// Parser para o sistema próprio da Câmara Municipal de Carapicuíba/SP
// Endpoint: GET /atividade-legislativa/proposicoes/pesquisa/N?ano=AAAA
// URL de detalhe: /atividade-legislativa/proposicoes/materia/ID

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/atividade-legislativa/proposicoes/pesquisa/${pagina}?ano=${ano}`;
    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const props = parsearHTML(html, url_base);
    console.log(`  [${nome}] → ${props.length} proposituras`);

    if (props.length === 0) break;
    todas.push(...props);

    // Verifica próxima página
    const temProxima = html.includes(`/pesquisa/${pagina + 1}`);
    if (!temProxima || pagina >= 200) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1200));
  }

  return todas;
}

function parsearHTML(html, url_base) {
  const proposituras = [];

  // URL completa (absoluta ou relativa): .../atividade-legislativa/proposicoes/materia/ID
  const cardRegex = /href="(?:https?:\/\/[^"]*)?\/atividade-legislativa\/proposicoes\/materia\/(\d+)"/gi;
  const vistos = new Set();
  let m;

  while ((m = cardRegex.exec(html)) !== null) {
    const id_interno = m[1];
    const href = `/atividade-legislativa/proposicoes/materia/${id_interno}`;

    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 2000), idx + 200);

    // Tipo e número
    const tituloMatch = bloco.match(/([A-ZÀ-Úa-zà-ú][^\n<\d]{2,50}?)\s+(\d+\/\d{4})(?:\s|<)/);
    const tipo = tituloMatch ? tituloMatch[1].trim() : '-';
    const numero = tituloMatch ? tituloMatch[2].trim() : '-';

    // Identificação ex: PLO-3646/2026
    const identMatch = bloco.match(/Identifica(?:ção|cao)\s*:?[^>]*>?\s*([A-Z]+-[\d\/]+)/i);
    const identificacao = identMatch ? identMatch[1].trim() : numero;

    // Data
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Ementa
    const ementaMatch = bloco.match(/Ementa\/Assunto\s*:?[^>]*>\s*([\s\S]{10,400}?)(?=<\/|Autoria|Situação)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : '-';

    // Autor
    const autorMatch = bloco.match(/Autoria\s*:?[^>]*>\s*([^<\n]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    proposituras.push({
      id: `carapicuiba-${id_interno}`,
      tipo, numero, data, autor, ementa,
      url: `${url_base}${href}`
    });
  }

  return proposituras;
}

module.exports = { buscar };
