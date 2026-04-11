// monitor.js — Orquestrador central
// Lê municipios.json, busca proposituras de cada um,
// destaca keywords na ementa e envia um email consolidado.

const fs = require('fs');
const nodemailer = require('nodemailer');

const EMAIL_DESTINO = process.env.EMAIL_DESTINO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;
const EMAIL_SENHA = process.env.EMAIL_SENHA;
const ARQUIVO_ESTADO = 'estado.json';

// ─── Carrega configurações ────────────────────────────────────────────────────

function carregarEstado() {
  if (fs.existsSync(ARQUIVO_ESTADO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  }
  return { proposicoes_vistas: {} };
}

function salvarEstado(estado) {
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2));
}

function carregarKeywords() {
  const raw = JSON.parse(fs.readFileSync('keywords.json', 'utf8'));
  return (raw.keywords || []).map(k => k.toLowerCase());
}

function carregarMunicipios() {
  const arquivo = process.env.MUNICIPIOS_FILE || 'municipios.json';
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

// ─── Parser dinâmico por sistema ─────────────────────────────────────────────

function obterParser(sistema) {
  try {
    return require(`./parsers/${sistema}.js`);
  } catch (e) {
    console.error(`❌ Parser não encontrado para sistema: ${sistema}`);
    return null;
  }
}

// ─── Destaque de keywords na ementa ──────────────────────────────────────────

function escapeHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function destacarKeywords(texto, keywords) {
  if (!texto || keywords.length === 0) return escapeHtml(texto || '-');

  let resultado = escapeHtml(texto);

  for (const kw of keywords) {
    const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${kwEscaped})`, 'gi');
    resultado = resultado.replace(
      regex,
      `<mark style="background:#fff176;color:#000;font-weight:bold;padding:0 2px;border-radius:2px">$1</mark>`
    );
  }

  return resultado;
}

function temKeyword(texto, keywords) {
  if (!texto) return false;
  const lower = texto.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// ─── Geração do email ─────────────────────────────────────────────────────────

function gerarLinhas(lista, keywords) {
  return lista.map(p => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap;vertical-align:top">
        <a href="${p.url}" style="color:#1a3a5c;font-weight:bold;text-decoration:none">${escapeHtml(p.tipo)}<br>${escapeHtml(p.numero)}</a>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#777;white-space:nowrap;vertical-align:top">${p.data || '-'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top">${destacarKeywords(p.ementa, keywords)}</td>
    </tr>
  `).join('');
}

function gerarSecaoMunicipio(municipio, novas, keywords) {
  if (novas.length === 0) return '';

  const comKeyword = novas.filter(p => temKeyword(p.ementa, keywords));
  const semKeyword = novas.filter(p => !temKeyword(p.ementa, keywords));

  let conteudo = '';

  if (comKeyword.length > 0) {
    conteudo += `
      <tr>
        <td colspan="3" style="padding:8px 10px 4px;background:#fff9c4;font-size:12px;font-weight:bold;color:#7a6000;border-top:1px solid #f0d800">
          ⭐ ${comKeyword.length} com palavras-chave de interesse
        </td>
      </tr>
      ${gerarLinhas(comKeyword, keywords)}
    `;
  }

  if (semKeyword.length > 0) {
    conteudo += `
      <tr>
        <td colspan="3" style="padding:8px 10px 4px;background:#f5f5f5;font-size:12px;color:#666;border-top:1px solid #ddd">
          ${semKeyword.length} demais propositura(s)
        </td>
      </tr>
      ${gerarLinhas(semKeyword, keywords)}
    `;
  }

  return `
    <div style="margin-bottom:32px">
      <h3 style="margin:0 0 6px;color:#1a3a5c;font-size:15px;border-left:4px solid #1a3a5c;padding-left:10px">
        ${escapeHtml(municipio.nome)} — ${escapeHtml(municipio.uf)}
        <span style="font-weight:normal;font-size:12px;color:#888"> — ${novas.length} nova(s)</span>
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#1a3a5c;color:white">
            <th style="padding:8px 10px;text-align:left;font-weight:normal;font-size:12px;white-space:nowrap">Tipo / Número</th>
            <th style="padding:8px 10px;text-align:left;font-weight:normal;font-size:12px;white-space:nowrap">Data</th>
            <th style="padding:8px 10px;text-align:left;font-weight:normal;font-size:12px">Ementa</th>
          </tr>
        </thead>
        <tbody>${conteudo}</tbody>
      </table>
    </div>
  `;
}

async function enviarEmail(resultados, keywords, totalNovas) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_REMETENTE, pass: EMAIL_SENHA },
  });

  const totalComKeyword = resultados.reduce(
    (acc, r) => acc + r.novas.filter(p => temKeyword(p.ementa, keywords)).length, 0
  );

  const municipiosAtivos = resultados.filter(r => r.novas.length > 0);

  const secoes = municipiosAtivos
    .map(r => gerarSecaoMunicipio(r.municipio, r.novas, keywords))
    .join('<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0">');

  const kwList = keywords.join(', ');
  const nomesMunicipios = municipiosAtivos.map(r => r.municipio.nome).join(', ');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#222">

      <div style="background:#1a3a5c;color:white;padding:16px 20px;border-radius:4px 4px 0 0">
        <h2 style="margin:0;font-size:18px">🏛️ Monitor COMGÁS — Proposituras Municipais</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.8">${new Date().toLocaleString('pt-BR')}</p>
      </div>

      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;padding:12px 20px;font-size:13px;line-height:1.8">
        📊 <strong>${totalNovas}</strong> propositura(s) nova(s) em
        <strong>${municipiosAtivos.length}</strong> município(s)<br>
        ⭐ <strong style="color:#7a6000">${totalComKeyword}</strong> com palavras-chave:
        <span style="color:#7a6000"><em>${kwList}</em></span>
      </div>

      <div style="border:1px solid #e0e0e0;border-top:none;padding:20px">
        ${secoes}
      </div>

      <div style="padding:10px 20px;font-size:11px;color:#aaa;border:1px solid #e0e0e0;border-top:none;text-align:center">
        Monitoramento automático via GitHub Actions · keywords: ${kwList}
      </div>

    </div>
  `;

  await transporter.sendMail({
    from: `"Monitor COMGÁS" <${EMAIL_REMETENTE}>`,
    to: EMAIL_DESTINO,
    subject: `🏛️ COMGÁS Monitor: ${totalNovas} nova(s) | ${nomesMunicipios} | ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  });

  console.log(`✅ Email enviado — ${totalNovas} proposituras, ${totalComKeyword} com keywords`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🚀 Iniciando Monitor COMGAS...');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

  const estado = carregarEstado();
  const keywords = carregarKeywords();
  const municipios = carregarMunicipios();

  // Migração: estado antigo era array, novo é objeto por município
  if (Array.isArray(estado.proposicoes_vistas)) {
    estado.proposicoes_vistas = {};
  }

  console.log(`📍 ${municipios.length} município(s) configurado(s)`);
  console.log(`🔑 Keywords: ${keywords.join(', ')}`);

  const resultados = [];
  let totalNovas = 0;

  for (const municipio of municipios) {
    console.log(`\n📍 ${municipio.nome}/${municipio.uf} [${municipio.sistema}]`);

    const parser = obterParser(municipio.sistema);
    if (!parser) {
      console.log(`  ⚠️ Pulando — parser "${municipio.sistema}" não disponível`);
      continue;
    }

    let proposicoes = [];
    try {
      proposicoes = await parser.buscar(municipio);
    } catch (err) {
      console.error(`  ❌ Erro: ${err.message}`);
      continue;
    }

    const idsVistos = new Set(estado.proposicoes_vistas[municipio.nome] || []);
    const novas = proposicoes.filter(p => p.id && !idsVistos.has(p.id));

    // Enriquecer ementas dos itens novos (parsers que suportam)
    if (novas.length > 0 && typeof parser.enriquecerEmentas === 'function') {
      await parser.enriquecerEmentas(novas);
    }

    console.log(`  🆕 ${novas.length} nova(s) de ${proposicoes.length} total`);

    resultados.push({ municipio, novas });
    totalNovas += novas.length;

    novas.forEach(p => idsVistos.add(p.id));
    estado.proposicoes_vistas[municipio.nome] = Array.from(idsVistos);
  }

  console.log(`\n📊 Total geral: ${totalNovas} propositura(s) nova(s)`);

  if (totalNovas > 0) {
    await enviarEmail(resultados, keywords, totalNovas);
  } else {
    console.log('✅ Sem novidades. Nada a enviar.');
  }

  estado.ultima_execucao = new Date().toISOString();
  salvarEstado(estado);

  console.log('\n✅ Monitor finalizado.');
})();

