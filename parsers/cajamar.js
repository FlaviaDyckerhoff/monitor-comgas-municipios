// parsers/cajamar.js
// Parser para o sistema próprio da Câmara Municipal de Cajamar/SP
// Método: GET com paginação por sufixo numérico (/documentos/lei/N)
// Dados vêm no HTML — sem API REST, sem XHR separado
// Cobre: /documentos/lei, /documentos/indicacoes, /documentos/requerimentos, etc.

async function buscar(municipio) {
  const { url_base, nome, cajamar_paths } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  // Paths a monitorar — configurável no municipios.json
  const paths = cajamar_paths || [
    '/documentos/lei',
    '/documentos/indicacoes',
    '/documentos/requerimentos',
    '/documentos/mocao',
  ];

  for (const path of paths) {
    let pagina = 1;

    while (true) {
      const url = `${url_base}${path}/${pagina}`;
      console.log(`  [${nome}] ${path} — página ${pagina}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        }
      });

      if (!response.ok) {
        console.error(`  [${nome}] Erro HTTP ${response.status} em ${url}`);
        break;
      }

      const html = await response.text();
      const props = parsearHTML(html, url_base, path, ano);
      console.log(`  [${nome}] → ${props.length} proposituras`);

      if (props.length === 0) break;

      // Filtra só o ano corrente
      const doAno = props.filter(p => p.numero.includes(`/${ano}`));
      todas.push(...doAno);

      // Se nenhuma propositura desta página é do ano corrente
      // e há proposituras de anos anteriores, para a paginação
      const temAnoAnterior = props.some(p => {
        const anoMatch = p.numero.match(/\/(\d{4})$/);
        return anoMatch && parseInt(anoMatch[1]) < ano;
      });

      if (temAnoAnterior || props.length < 5 || pagina >= 50) break;

      // Verifica se há próxima página
      const temProxima = html.includes(`${path}/${pagina + 1}`) ||
        html.includes('Próxima') || html.includes('próxima') ||
        html.match(/href="[^"]*\/\d+"\s*[^>]*>\s*(?:›|»|Próxima)/i);

      if (!temProxima) break;

      pagina++;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return todas;
}

function parsearHTML(html, url_base, path, ano) {
  const proposituras = [];
  const vistos = new Set();

  // Cajamar usa cards com padrão:
  // "Projeto de Lei Ordinaria Nº 38/2026"
  // Autor: "Reinaldo Santos"
  // Data: "30 de Março de 2026"
  // Ementa: texto da propositura

  // Extrai tipo e número do padrão "Tipo Nº numero/ano"
  const tituloRegex = /([A-ZÀ-Úa-zà-ú][^\n<]{4,60}?)\s+N[ºo°]\s+(\d+\/\d{4})/g;
  let m;

  while ((m = tituloRegex.exec(html)) !== null) {
    const tipo = m[1].trim();
    const numero = m[2].trim();

    if (vistos.has(numero)) continue;
    vistos.add(numero);

    // Verifica ano
    const anoMatch = numero.match(/\/(\d{4})$/);
    if (anoMatch && parseInt(anoMatch[1]) !== ano) continue;

    // Contexto ao redor para extrair demais campos
    const idx = m.index;
    const bloco = html.substring(idx, idx + 2000);

    // Autor — padrão "Autoria do vereador X" ou tag com nome
    const autorMatch = bloco.match(/(?:Autoria|Autor|vereador[a]?)\s+(?:do\s+)?(?:vereador[a]?\s+)?([A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ\s]{3,50})/i)
      || bloco.match(/class="[^"]*autor[^"]*"[^>]*>\s*([^<\n]{3,60})/i);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    // Data — padrão "30 de Março de 2026" ou "dd/mm/aaaa"
    const dataMatch = bloco.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1].trim() : '-';

    // Ementa — texto após o título, antes do próximo card
    const ementaMatch = bloco.match(/(?:Ementa|ementa|<p[^>]*>)\s*[":]*\s*([\s\S]{20,400}?)(?=<\/p>|Autor|Data|class=|$)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().substring(0, 400)
      : tipo;

    // URL — sistema não tem página de detalhe, usa a listagem com âncora
    const id = `cajamar-${numero.replace('/', '-')}`;
    const url_prop = `${url_base}${path}/1`;

    proposituras.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
