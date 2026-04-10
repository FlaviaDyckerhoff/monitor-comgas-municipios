// parsers/praia-grande.js
// Parser para a Câmara Municipal de Praia Grande/SP
// Sistema PHP próprio — server-side rendering
// URL: GET /dispositivo/ideCustom/camarapg_publico/materias_leg/result_materias.php?ano_materia=AAAA&offset=N
// Estrutura: tabela HTML, 50 itens/pág, ~42 páginas para 2026
// Campos: Tipo, Autor, Data de apresentação, link PDF (sem ementa inline)
// ID único: codigo= do href de detalhes

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  const base = `${url_base}/dispositivo/ideCustom/camarapg_publico/materias_leg`;
  let offset = 1;
  let totalPaginas = 300;

  while (true) {
    const url = `${base}/result_materias.php?ano_materia=${ano}&offset=${offset}`;
    if (offset === 1 || offset % 10 === 0) console.log(`  [${nome}] Página ${offset}/${totalPaginas}...`);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': `${base}/pesquisa.php`,
        }
      });
    } catch (err) {
      console.error(`  [${nome}] Erro de conexão: ${err.message}`);
      break;
    }

    if (!response.ok) {
      if (response.status === 500) break; // fim de paginação em câmaras pequenas
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const buf = Buffer.from(await response.arrayBuffer());
    const html = buf.toString('latin1');

    // Extrai total e limite da função paginacao() inline (só pág 1)
    if (offset === 1) {
      const totalMatch = html.match(/var total\s*=\s*(\d+)/);
      const limiteMatch = html.match(/let limite\s*=\s*(\d+)/);
      if (totalMatch && limiteMatch) {
        const total = parseInt(totalMatch[1]);
        const limite = parseInt(limiteMatch[1]);
        totalPaginas = Math.ceil(total / limite);
        console.log(`  [${nome}] Total: ${total} matérias, ${totalPaginas} páginas`);
      }
    }

    const props = parsearHTML(html, url_base, base, ano);
    if (props.length === 0) break;
    todas.push(...props);

    if (offset >= totalPaginas) break;
    offset++;
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`  [${nome}] → ${todas.length} proposituras no total`);
  return todas;
}

function parsearHTML(html, url_base, base, ano) {
  const proposituras = [];
  const vistos = new Set();

  // Cada matéria: <a class="result" href="detalhes_materia.php?codigo=XXXXX">TIPO Nº NUM/ANO</a>
  const blocoRegex = /<a[^>]*class="result"[^>]*href="(detalhes_materia\.php\?codigo=(\d+))"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
  let m;

  while ((m = blocoRegex.exec(html)) !== null) {
    const href = m[1];
    const codigo = m[2];
    const linkText = m[3].replace(/\s+/g, ' ').trim();

    // Verificar ano no texto do link
    if (!linkText.includes(`/${ano}`)) continue;
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);

    // Tipo e número: "Indicações Nº 1910/2026"
    const tipoNumMatch = linkText.match(/^(.+?)\s+N[ºo°]\s*([\d]+\/\d{4})/i);
    if (!tipoNumMatch) continue;

    const tipo = tipoNumMatch[1].trim();
    const numero = tipoNumMatch[2].trim();

    // Contexto após o link
    const idx = m.index;
    const bloco = html.substring(idx, idx + 1500);

    // Autor: <b>Autor: </b> NOME
    const autorMatch = bloco.match(/<b>Autor:\s*<\/b>\s*([^<\n]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    // Data: <b>Data de apresentação: </b> DD de Mês de AAAA
    const dataMatch = bloco.match(/<b>Data[^<]*<\/b>\s*([^<\n]{5,40})/i);
    const data = dataMatch ? dataMatch[1].trim() : '-';

    // Sem ementa inline — usar tipo + número como descrição
    const ementa = linkText;

    // URL de detalhe
    const url_prop = `${url_base}/dispositivo/ideCustom/camarapg_publico/materias_leg/${href}`;

    proposituras.push({
      id: `praia-grande-${codigo}`,
      tipo, numero, data, autor, ementa, url: url_prop
    });
  }

  return proposituras;
}

module.exports = { buscar };
