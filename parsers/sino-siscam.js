// parsers/sino-siscam.js
// Parser para câmaras que usam o sistema SINO Siscam
// Estrutura SPA — sem <tbody>, links inline em <a href="/[Siscam/]Documentos/Details?id=...&amp;grupoId=...">
// Testado em: Botucatu/SP (com /Siscam prefix), Várzea Paulista/SP, Bragança Paulista/SP

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
  const { url_base, nome, grupo_id, tipo_ids } = municipio;
  const ano = new Date().getFullYear();

  // Botucatu tem url_base = "https://www.camarabotucatu.sp.gov.br/Siscam"
  // Outros têm url_base sem sufixo e /Documentos na raiz
  const docPath = url_base.endsWith('/Siscam') ? '/Documentos' : '/Documentos';
  const tipoParams = tipo_ids.map(id => `TipoId=${id}`).join('&');

  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}${docPath}?Pesquisa=Avancada&ShowSearch=False&GrupoId=${grupo_id}&${tipoParams}&SubtipoId=&Numeracao=Documento&NumeroSufixo=&Ano=${ano}&Data=&Ementa=&Observacoes=&SituacaoId=&ClassificacaoId=&RegimeId=&QuorumId=&TipoAutorId=&AutorId=&TipoIniciativaId=&Ordenacao=3&ItemsPerPage=100&NoTexto=false&Pagina=${pagina}`;

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
    const coes = parsearHTML(html, url_base, grupo_id, nome);
    console.log(`  [${nome}] → ${coes.length} turas`);

    todas.push(...coes);

    // Próxima página existe?
    const temProxima = html.includes(`Pagina=${pagina + 1}`) || html.includes(`pagina=${pagina + 1}`);
    if (!temProxima || coes.length === 0 || pagina >= 10) break;

    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

function parsearHTML(html, url_base, grupo_id, nome) {
  const coes = [];
  const idsVistos = new Set();

  // Links inline: <a href="/[Siscam/]Documentos/Details?id=123&amp;grupoId=1">Tipo Nº 10/2026</a>
  // &amp; ou & direto; grupoId pode estar ausente
  const linkRegex = /href="([^"]*\/Documentos\/Details\?id=(\d+)(?:&(?:amp;)?grupoId=\d+)?[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const id = m[2];
    const texto = m[3].trim();

    if (idsVistos.has(id)) continue;
    idsVistos.add(id);

    // Texto: "Projeto de Lei Nº 21/2026" ou "PL Nº 21/2026" ou "Despacho Nº 184/2026 ao Projeto de Lei Nº 21/2026"
    // Extrair tipo e número — ignorar Despachos (documentos derivados)
    const despacho = /^Despacho/i.test(texto);

    // Número no formato NNN/AAAA ou Nº NNN/AAAA
    const numMatch = texto.match(/N[ºoO°\xba]?\.?\s*(\d+\/\d{4})/i)
      || texto.match(/(\d{1,4}\/\d{4})$/);
    const numero = numMatch ? numMatch[1] : '-';

    // Tipo: tudo antes do número; decode HTML entities (&#xBA; = º)
    const tipoRaw = texto
      .replace(/N[ºoO°\xba]?\.?\s*\d+\/\d{4}/i, '')
      .replace(/&#x[0-9A-Fa-f]+;/g, c => String.fromCharCode(parseInt(c.slice(3,-1),16)))
      .replace(/&[a-z]+;/g, '')
      .replace(/\s+$/, '').trim();
    const tipo = tipoRaw || texto.replace(/&#x[0-9A-Fa-f]+;/g, c => String.fromCharCode(parseInt(c.slice(3,-1),16)));

    // Buscar contexto ao redor para data e ementa
    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 200), idx + 800);

    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    const ementaMatch = bloco.match(/(?:Ementa|Assunto)\s*:?\s*([^<\n]{10,400})/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 400)
      : texto.substring(0, 400);

    // URL absoluta
    const url_prop = href.startsWith('http')
      ? href.replace(/&amp;/g, '&')
      : `${url_base}${href.replace(/&amp;/g, '&')}`;

    const id_unico = `${nome.toLowerCase().replace(/[\s/]+/g, '-')}-${id}`;

    proposicoes.push({
  id: id_unico,
  tipo: decodificarEntities(tipo),
  numero,
  data,
  autor: '-',
  ementa: decodificarEntities(ementa),
  url: url_prop
});

  return proposicoes;
}

module.exports = { buscar };
