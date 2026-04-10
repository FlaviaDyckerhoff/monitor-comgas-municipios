// parsers/mairipora.js
// Parser para o sistema próprio da Câmara Municipal de Mairiporã/SP
// Sistema PHP legado hospedado em /site-antigo/
// Requer PHPSESSID — inicializa sessão antes do POST
// PLs: busca por anoLei (ano de aprovação)
// IndReqMoc: busca por ano do projeto

const TIPOS_IND_REQ_MOC = [
  { valor: 'ind',      nome: 'Indicação' },
  { valor: 'req',      nome: 'Requerimento' },
  { valor: 'moc_a',   nome: 'Moção de Apoio' },
  { valor: 'moc_reiv',nome: 'Moção de Apelo' },
  { valor: 'moc_c',   nome: 'Moção de Congratulações' },
  { valor: 'moc_p',   nome: 'Moção de Pesar' },
  { valor: 'moc_rep', nome: 'Moção de Repúdio' },
];

async function initSession(baseUrl) {
  const r = await fetch(`${baseUrl}/index.php?form=formProjetos`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      'Accept': 'text/html',
    }
  });
  const setCookie = r.headers.get('set-cookie') || '';
  const match = setCookie.match(/PHPSESSID=[^;]+/);
  return match ? match[0] : null;
}

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const baseUrl = `${url_base}/site-antigo`;
  const todas = [];

  // Inicializar sessão (obrigatório)
  const cookie = await initSession(baseUrl);
  if (!cookie) {
    console.error(`  [${nome}] Não foi possível obter sessão`);
    return [];
  }

  // 1. Projetos de Lei aprovados em 2026 (campo anoLei)
  console.log(`  [${nome}] Buscando PLs de ${ano}...`);
  const propsPL = await buscarFormulario(baseUrl, cookie, {
    form: 'formProjetos',
    anoLei: String(ano),
    ano: String(ano),
    proj_autor: '',
    order: 'proj_num_DESC',
    numeroLei: '',
    numeroProj: '',
    proj_assunto: '',
    integra: '',
    PESQUISAR: 'PESQUISAR',
  }, `index.php?form=formProjetos`, '__view_LeiLecDleResPage', nome, ano, null);
  console.log(`  [${nome}] → ${propsPL.length} PLs`);
  todas.push(...propsPL);

  // 2. Indicações, Requerimentos, Moções
  for (const tipo of TIPOS_IND_REQ_MOC) {
    console.log(`  [${nome}] Buscando ${tipo.nome} de ${ano}...`);
    const props = await buscarFormulario(baseUrl, cookie, {
      form: 'formIndReqMoc',
      tipo_prop: tipo.valor,
      ano: String(ano),
      nome_vereador: '',
      numero: '',
      texto: '',
      PESQUISAR: 'PESQUISAR',
    }, 'index.php', '__view_IndReqMocPage', nome, ano, tipo.nome);
    console.log(`  [${nome}] → ${props.length} ${tipo.nome}`);
    todas.push(...props);
    await new Promise(r => setTimeout(r, 800));
  }

  return todas;
}

async function buscarFormulario(baseUrl, cookie, bodyParams, action, viewName, nome, ano, tipoForcado) {
  const endpoint = `${baseUrl}/${action}`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': cookie,
        'Referer': `${baseUrl}/index.php?form=formProjetos`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    });
  } catch (err) {
    console.error(`  Erro de conexão: ${err.message}`);
    return [];
  }
  if (!response.ok) {
    console.error(`  Erro HTTP ${response.status}`);
    return [];
  }
  const html = await response.text();
  return parsearHTML(html, baseUrl, viewName, ano, tipoForcado);
}

function parsearHTML(html, baseUrl, viewName, ano, tipoForcado) {
  const proposituras = [];
  const vistos = new Set();
  const linkRegex = new RegExp(`href="index\\.php\\?view=${viewName}&(?:amp;)?id=(\\d+)"`, 'gi');
  const prefixo = viewName === '__view_LeiLecDleResPage' ? 'mairipora-pl' : 'mairipora-irm';
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const id_interno = m[1];
    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 1500), idx + 800);

    let tipo = tipoForcado || 'Propositura';
    let numero = '';

    if (viewName === '__view_LeiLecDleResPage') {
      const tituloMatch = bloco.match(/<strong>\s*([^<]+)\s*<\/strong>/i);
      const tituloRaw = tituloMatch ? tituloMatch[1].trim() : '';
      const projetoMatch = tituloRaw.match(/\|\s*(.+?)\s+n[ºo°]?\s*([\d]+\/\d{4})/i);
      if (projetoMatch) { tipo = projetoMatch[1].trim(); numero = projetoMatch[2].trim(); }
    } else {
      const tituloMatch = bloco.match(/<h4[^>]*class="panel-title"[^>]*>\s*([\s\S]+?)\s*<\/h4>/i);
      const tituloRaw = tituloMatch ? tituloMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const numMatch = tituloRaw.match(/(.+?)\s+n[ºo°]?\s*([\d]+\/\d{4})/i);
      if (numMatch) { tipo = numMatch[1].trim(); numero = numMatch[2].trim(); }
      if (numero && !numero.endsWith(`/${ano}`)) continue;
    }

    const autorMatch = bloco.match(/Autor:\s*([^\n<]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    const ementaMatch = bloco.match(
      new RegExp(`view=${viewName}&(?:amp;)?id=\\d+"[^>]*>([\\s\\S]{10,600}?)(?=<\\/a>|"\\s+leia mais)`, 'i')
    );
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
          .replace(/&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : tipo;

    proposituras.push({
      id: `${prefixo}-${id_interno}`,
      tipo, numero, data: '-', autor, ementa,
      url: `${baseUrl}/index.php?view=${viewName}&id=${id_interno}`,
    });
  }

  return proposituras;
}

module.exports = { buscar };
