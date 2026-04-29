'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// parsers/itatiba.js
// Parser para Câmara Municipal de Itatiba/SP
// Sistema: Sino.Siave 8 — siave.camaraitatiba.com.br
// Endpoint de exportação CSV (sem captcha):
//   GET /Documentos/Exportar?tipo=2&Pesquisa=Simples&id=80&pagina=1&Modulo=8
//       &Documento=0&Numeracao=Documento&AnoInicial=AAAA&AnoFinal=AAAA
// Retorna CSV completo (sem paginação real) com campos:
//   Documento;Numero;Ano;Data;Ementa;Autoria;Situação;Protocolo;Classificacao

const URL_BASE = 'https://siave.camaraitatiba.com.br';

// Parseia CSV simples com ; como separador e suporte a campos entre aspas
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  if (lines.length < 2) return [];

  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split respeitando aspas
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ';' && !inQuote) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());

    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? cols[idx].replace(/^"(.*)"$/, '$1').trim() : '';
    });
    rows.push(obj);
  }

  return rows;
}

async function buscarProposicoes(municipio, ano) {
  const url = `${URL_BASE}/Documentos/Exportar?tipo=2&Pesquisa=Simples&id=80&pagina=1&Modulo=8&Documento=0&Numeracao=Documento&AnoInicial=${ano}&AnoFinal=${ano}`;

  let text;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' },
    });
    if (!res.ok) {
      console.error(`  [itatiba] Erro HTTP ${res.status}`);
      return [];
    }
    text = await res.text();
  } catch (e) {
    console.error(`  [itatiba] Erro ao buscar CSV: ${e.message}`);
    return [];
  }

  const rows = parseCSV(text);
  const results = [];

  for (const row of rows) {
    const tipo = row['Documento'] || '-';
    const numero = row['Numero'] || '';
    const anoItem = parseInt(row['Ano'], 10) || ano;
    const ementa = (row['Ementa'] || '-').substring(0, 400);
    const protocolo = row['Protocolo'] || '';
    const situacao = row['Situação'] || '';

    // ID baseado no protocolo ou tipo+numero+ano
    const idBase = protocolo
      ? protocolo.replace(/\//g, '-')
      : `${tipo.toLowerCase().replace(/\s+/g, '-')}-${numero}-${anoItem}`;

    const titulo = numero
      ? `${tipo} Nº ${numero}/${anoItem}`
      : `${tipo} ${anoItem}`;

    // URL para visualização do documento na busca
    const urlDoc = `${URL_BASE}/Documentos/Pesquisa?Pesquisa=Simples&id=80&pagina=1&Modulo=8&Documento=0&Numeracao=Documento&AnoInicial=${anoItem}&AnoFinal=${anoItem}`;

    results.push({
      id: `itatiba-${idBase}`,
      titulo,
      ementa,
      tipo,
      ano: anoItem,
      url: urlDoc,
    });
  }

  return results;
}

module.exports = { buscarProposicoes };
