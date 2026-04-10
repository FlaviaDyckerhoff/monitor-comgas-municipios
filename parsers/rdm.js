// parsers/rdm.js
// Parser para câmaras que usam o sistema RDM Sistemas (GRP/portalcidadao)
// API: POST /GRP/portalcidadao/webservices/proposicao/filtrar
// Testado em: Câmara Municipal de Osasco/SP

const NATUREZAS = [
  { natureza: 'PROJETO',      tipoProposicaoId: 63, enderecoId: 6 },
  { natureza: 'INDICACAO',    tipoProposicaoId: null, enderecoId: 1 },
  { natureza: 'REQUERIMENTO', tipoProposicaoId: null, enderecoId: 1 },
  { natureza: 'MOCAO',        tipoProposicaoId: null, enderecoId: 1 },
];

async function buscar(municipio) {
  const { url_base, nome, rdm_api_base } = municipio;
  const apiBase = rdm_api_base || url_base;
  const ano = new Date().getFullYear();
  const dataInicio = `${ano}-01-01T00:00:00.000`;
  const dataFim = `${ano}-12-31T23:59:59.000`;
  const todas = [];

  for (const nat of NATUREZAS) {
    console.log(`  [${nome}] Buscando ${nat.natureza} de ${ano}...`);

    const body = {
      assunto: null,
      natureza: nat.natureza,
      listaNatureza: null,
      apenasAgentePoliticoMobile: null,
      ator: null,
      buscaProposicaoPublica: true,
      buscaTipoUltimoEvento: true,
      buscarSemNumeroItem: null,
      comissao: null,
      conteudoBuscaE: null,
      conteudoLista: null,
      dataCriacaoFim: dataFim,
      dataCriacaoInicio: dataInicio,
      dataSituacaoFim: null,
      dataSituacaoInicio: null,
      endereco: { '@id': nat.enderecoId, id: null },
      legislatura: null,
      leiFinal: null,
      leiInicial: null,
      mesaDiretora: null,
      numero: null,
      numeroProjeto: null,
      numeroProtocolo: null,
      numeros: null,
      numerosProtocolo: null,
      periodoPlenario: null,
      pessoa: null,
      possuiLei: null,
      possuiRedacaoFinal: null,
      reuniao: null,
      sessaoPlenaria: null,
      situacao: null,
      situacaoFinalAberta: null,
      tipoEvento: null,
      tipoProposicao: nat.tipoProposicaoId
        ? { '@id': 1, id: nat.tipoProposicaoId }
        : null,
      tipoProposicaoAtorEnum: null,
      vinculaProtocolo: true,
    };

    let response;
    try {
      response = await fetch(`${apiBase}/GRP/portalcidadao/webservices/proposicao/filtrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error(`  [${nome}] Erro de conexão: ${err.message}`);
      continue;
    }

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status} para ${nat.natureza}`);
      continue;
    }

    let json;
    try {
      json = await response.json();
    } catch (err) {
      console.error(`  [${nome}] Resposta não é JSON: ${err.message}`);
      continue;
    }

    const lista = Array.isArray(json) ? json : (json.lista || json.content || json.data || []);
    console.log(`  [${nome}] → ${lista.length} ${nat.natureza}`);

    for (const p of lista) {
      const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${p.id}`;

      // Tipo
      const tipo = p.tipoProposicao?.nome || nat.natureza;

      // Número — "00198/2025" ou "001/2026"
      const numero = p.numeroProjeto || p.documentoVO?.numeroOrigemExibicao || '-';

      // Data
      const dataRaw = p.dataCriacao || p.dataProposicao || '';
      const data = dataRaw
        ? new Date(dataRaw).toLocaleDateString('pt-BR')
        : '-';

      // Autor — primeiro ator com tipoPapel AUTOR
      const autorObj = (p.atores || []).find(a => a.tipoPapel === 'AUTOR');
      const autor = autorObj?.agentePolitico?.nomePolitico || '-';

      // Ementa — campo descricao, limpa @ementa e HTML entities
      const descricaoRaw = p.documentoVO?.descricao || p.ementa || '-';
      const ementa = descricaoRaw
        .replace(/@ementa\s*/gi, '')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 400);

      // URL de detalhe — usa o idEncrypted do primeiro ator se disponível
      const idEncrypted = autorObj?.idEncrypted;
      const url_prop = idEncrypted
        ? `${url_base}/portalcidadao/#proposicao/${encodeURIComponent(idEncrypted)}`
        : `${url_base}/portalcidadao/`;

      todas.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

module.exports = { buscar };
