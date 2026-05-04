# Monitor Legislativo Municipal — Lições Aprendidas

> Documento gerado em 01/05/2026. Resume arquitetura, sistemas encontrados, técnicas que funcionaram e municípios mapeados nos projetos **monitor-sabesp-municipios** e **monitor-comgas-municipios**.

---

## 1. Arquitetura que Funciona

### Stack
- **Node.js** + **nodemailer** — sem dependências externas além do necessário
- **GitHub Actions** (cron 4×/dia) — custo zero para municípios sem bloqueio
- **VPS self-hosted runner** (187.127.16.109, Ubuntu 24.04, 8GB RAM) — para municípios com Cloudflare, captcha ou TLS fingerprinting
- **Estado** salvo em `estado.json` no próprio repositório
- **Email** via Gmail App Password (nodemailer)

### Repositórios
| Repo | Runner | Arquivo de municípios |
|------|--------|-----------------------|
| monitor-sabesp-municipios | GA + VPS | municipios.json (GA), municipios-vps.json (VPS) |
| monitor-comgas-municipios | GA + VPS | municipios.json (GA), municipios-vps.json (VPS) |

### Estrutura de arquivos
```
monitor-[projeto]-municipios/
├── monitor.js           # Orquestrador central
├── municipios.json      # Municípios GA
├── municipios-vps.json  # Municípios VPS
├── keywords.json        # Palavras-chave do projeto
├── estado.json          # IDs já vistos (persistido no repo)
├── parsers/             # Um arquivo .js por sistema
└── .github/workflows/monitor.yml
```

---

## 2. Secrets GitHub

| Secret | Descrição |
|--------|-----------|
| EMAIL_REMETENTE | Gmail do remetente |
| EMAIL_SENHA | App Password Gmail (16 chars, sem espaços) |
| EMAIL_DESTINO | Email de destino |

---

## 3. Microserviço VPS (Puppeteer)

**Arquivo:** `/home/github-runner/teste-gru/guarulhos-service.js`
**Porta:** 3002
**Systemd:** `guarulhos-service` (reinicia automaticamente)
**Chrome:** `/root/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome`

### Endpoints
```
GET http://localhost:3002/proposicoes?host=guarulhos&subtipo=projeto-de-lei-20&ano=2026&pagina=1
GET http://localhost:3002/proposicoes?host=sbc&subtipo=projeto-de-lei-101&ano=2026&pagina=1
GET http://localhost:3002/sagl?host=jundiai&tipo=1&ano=2026
```

### Hosts suportados
| host | Sistema | Bloqueio |
|------|---------|----------|
| guarulhos | Legisoft | Cloudflare |
| sbc | Legisoft | Captcha |
| jundiai | SAGL | TLS fingerprinting |

### Sessões reutilizadas por 90min. Browser fecha após 10min ocioso.

---

## 4. Sistemas Encontrados e Como Acessar

### SAPL (Interlegis DRF)
- **API REST:** `GET /api/materia/materialegislativa/?ano=AAAA&page=N&page_size=100`
- **Municípios:** Campinas, Barueri, Socorro, Jundiaí (via microserviço)
- **Campos úteis:** `tipo_materia.sigla`, `numero`, `ementa`, `data_apresentacao`
- **Atenção:** alguns estão atrás de proxy reverso (Caraguatatuba) — não acessíveis diretamente

### SPL (NoPaperCloud / Ágape)
- **API REST:** `GET /api/publico/proposicao/?pg=N&qtd=100&ano=AAAA`
- **Municípios:** Santo André, Caçapava, Tremembé, Taubaté, SJC, Santana de Parnaíba
- **Campos:** `sigla`, `tipo`, `numero`, `data`, `assunto`, `AutorRequerenteDados`
- **Atenção:** SJC precisa de timeout 30s (`AbortSignal.timeout(30000)`)
- **Filtro obrigatório:** ignorar siglas `PC, PAR, AUT, SUB, EMD, DES, OF, NR` (documentos derivados)

### SAGL
- **API REST:** `GET /@@materias?ano=AAAA&tipo=N`
- **Municípios:** Hortolândia, Jundiaí (via microserviço por TLS)
- **Tipos:** 1=PL, 2=PR, 3=REQ, 6=PDL, 7=MOC, 8=IND, etc.

### SINO Siscam
- **Dois modos:**
  - **Legado** (Botucatu, Várzea Paulista, Bragança Paulista): `GET /Documentos?GrupoId=N&TipoId=N&...`
  - **Novo** (Paulínia, Itatiba, Itaquaquecetuba, Piracicaba, Mauá, Sumaré, Olímpia, Lins): `GET /Documentos/Pesquisa?id=SISCAM_ID&Documento=N&AnoInicial=AAAA&AnoFinal=AAAA`
- **Descoberta chave:** o hCaptcha existe só na interface web — o endpoint `/Documentos/Pesquisa` não tem captcha
- **`siscam_id`** = descoberto acessando a URL raiz e pegando `/index/N/8`
- **Ementa:** não está na listagem — buscada via `enriquecerEmentas` na página de detalhe `/Documentos/Documento/ID`
- **Filtro obrigatório:** ignorar títulos com `" ao "` (Pareceres, Autógrafos, Relatores)

### Legisoft (Virtualiza Tecnologia)
- **URL:** `GET /documentos/tipo:legislativo-2/subtipo:SLUG/ano:AAAA/pagina:N`
- **Municípios:** Guarulhos (Cloudflare), SBC (captcha) — ambos via microserviço Puppeteer
- **Slugs Guarulhos:** `projeto-de-lei-20`, `requerimento-22`, `indicacao-12`, `mocao-13`
- **Slugs SBC:** `projeto-de-lei-101`, `requerimento-103`, `indicacao-108`
- **HTML renderizado via JS** — precisa Puppeteer para capturar

### Backsite (PHP Latin-1)
- **Municípios:** Santos
- **Encoding:** ISO-8859-1 — precisa decodificar

### WeblineSistemas
- **Dois sabores:**
  - **Igaratá (GET simples):** `GET /?pag=BASE64&view=getTPET&tp=N&ano=AAAA&estado=tramitacao`
  - **Nazaré Paulista / Presidente Prudente (GET com tiposBusca):** `GET /?pag=BASE64&set=N&tiposBusca[]=N&ano=AAAA&pg=N`
- **HTML server-side** — sem AJAX, sem captcha, scraping simples
- **Estrutura:** `<h3 class="tituloPagina">NNNN-AAAA</h3>` + campos em `<h4>`
- **ID interno:** `<input name="id" value="NNNNN">`

### Mogi das Cruzes (API própria)
- **API JSON:** `GET /api/projetos.php?tipodoc=N&ano=AAAA&itens_pagina=100&pagina=N`
- **Tipos:** 1=IND, 2=MOC, 3=REQ, 4=PELO, 5=PLC, 6=PDL, 9=PL, 10=PR
- **Campos:** `codigo`, `numero`, `data`, `assunto`, `url`

### São Paulo (CMSP SOAP)
- **API:** `GET /ProjetosPorAnoJSON?Ano=AAAA`
- **URL:** `https://splegisws.saopaulo.sp.leg.br`
- **Sem captcha, sem bloqueio**

### Santana de Parnaíba (SPL)
- **Mesma API SPL:** `https://sempapel.camarasantanadeparnaiba.sp.gov.br/api/publico/proposicao/`
- **Descoberta:** URL encontrada via nome do arquivo PDF no site antigo

### Mirasoft mLegislativo (São Caetano do Sul)
- **POST:** `https://mlegislativo.mirasoft.com.br/PortalMunicipe/Processos`

### Sistemas estáticos HTML
- **Jacareí:** WordPress HTML por tipo
- **Mairiporã:** PHP 2 formulários
- **Joanópolis:** API JSON própria
- **Rio Grande da Serra:** DocMan JSON
- **Praia Grande:** PHP offset paginação + ementa via detalhe
- **Limeira:** Siscam-like `/Documentos/Pesquisa` + ementa via detalhe

---

## 5. Técnicas de Diagnóstico

### Sequência de investigação para novo município
1. Inspecionar Network no DevTools — aba Fetch/XHR
2. Testar `curl -s -o /dev/null -w "%{http_code}" --max-time 10 URL`
3. Se 000: `socket.connect_ex` para verificar se é firewall
4. Se firewall OK mas HTTP falha: aumentar timeout para 30s
5. Se timeout mesmo com 30s: Puppeteer + stealth no VPS
6. Se Puppeteer passa: microserviço ou interceptação de resposta

### Teste de socket Python
```python
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(5)
resultado = sock.connect_ex(('IP', 443))
# 0 = OK, 110/10060 = timeout (DROP), outro = REJECT
```

### Interceptar API via Puppeteer
```javascript
page.on('response', async resp => {
  if (resp.url().includes('endpoint')) {
    const json = await resp.json();
    // processa
  }
});
```

---

## 6. Regras do `monitor.js`

### Hook enriquecerEmentas
```javascript
if (novas.length > 0 && typeof parser.enriquecerEmentas === 'function') {
  await parser.enriquecerEmentas(novas);
}
```
Parsers que suportam: `sino-siscam.js`, `limeira.js`, `praia-grande.js`

### Passar IDs já vistos para parsers
```javascript
proposicoes = await parser.buscar(municipio, estado.proposicoes_vistas[municipio.nome] || []);
```
Parsers que suportam: `carapicuiba.js`

### Timeout padrão
- Fetch normal: sem timeout explícito
- SPL lento (SJC): `AbortSignal.timeout(30000)`
- Microserviço VPS: `AbortSignal.timeout(90000)`

---

## 7. Armadilhas Conhecidas

| Armadilha | Solução |
|-----------|---------|
| Siscam hCaptcha na interface web | Usar `/Documentos/Pesquisa` direto — sem captcha |
| SPL retorna Pareceres de Comissão (sigla PC) | Filtrar `SIGLAS_IGNORAR = ['PC','PAR','AUT','SUB','EMD','DES','OF','NR']` |
| Siscam retorna documentos relacionados | Ignorar títulos com `" ao "` |
| Carapicuíba pagina 200 páginas | Passar `idsJaVistos` e parar quando página inteira já foi vista |
| SJC timeout | `AbortSignal.timeout(30000)` resolve |
| Cloudflare (Guarulhos) | Puppeteer + stealth no microserviço VPS |
| TLS fingerprinting (Jundiaí) | Puppeteer + stealth captura cookies e reutiliza em fetch |
| Proxy reverso (Caraguatatuba) | LAI pendente — não conseguimos bypass |
| JSON inválido no GitHub editor | Nunca editar linha a linha — substituir arquivo inteiro |
| Tremembé fora do ar | Era instabilidade temporária — voltou sozinho |
| Praia Grande 300 páginas | Calcula total real na primeira página e para quando acabar |

---

## 8. Municípios por Sistema

### SABESP — 24 GA + 6 VPS = 30 total

| Município | Sistema | Runner |
|-----------|---------|--------|
| Botucatu | sino-siscam (legado) | GA |
| Hortolândia | sagl | GA |
| Várzea Paulista | sino-siscam (legado) | GA |
| Socorro | sapl | GA |
| Santo André | spl | GA |
| Caçapava | spl | GA |
| Santos | backsite | GA |
| Bragança Paulista | sino-siscam (legado) | GA |
| Cajamar | cajamar | GA |
| Mairiporã | mairipora | GA |
| Joanópolis | joanopolis | GA |
| Rio Grande da Serra | rgserra | GA |
| Praia Grande | praia-grande | GA |
| Mauá | sino-siscam (novo) | GA |
| Itatiba | sino-siscam (novo) | GA |
| Itaquaquecetuba | sino-siscam (novo) | GA |
| Olímpia | sino-siscam (novo) | GA |
| São José dos Campos | spl | GA |
| Taubaté | spl | GA |
| Lins | sino-siscam (novo) | GA |
| São Paulo | saopaulo | GA |
| Santana de Parnaíba | spl | GA |
| Igaratá | igarata | GA |
| Nazaré Paulista | nazare-paulista | GA |
| Presidente Prudente | presidente-prudente | GA |
| Campinas | sapl | VPS |
| Carapicuíba | carapicuiba | VPS |
| Osasco | rdm | VPS |
| Tremembé | spl | VPS |
| Guarulhos | guarulhos | VPS |
| São Bernardo do Campo | sbc | VPS |

### COMGÁS — 14 GA + 5 VPS = 19 total

| Município | Sistema | Runner |
|-----------|---------|--------|
| Barueri | sapl | GA |
| São Caetano do Sul | sao-caetano-sul | GA |
| Jacareí | jacarei | GA |
| Santo André | spl | GA |
| Hortolândia | sagl | GA |
| Praia Grande | praia-grande | GA |
| Santos | backsite | GA |
| Bragança Paulista | sino-siscam (legado) | GA |
| Paulínia | sino-siscam (novo) | GA |
| Itatiba | sino-siscam (novo) | GA |
| Itaquaquecetuba | sino-siscam (novo) | GA |
| Piracicaba | sino-siscam (novo) | GA |
| Sumaré | sino-siscam (novo) | GA |
| São Paulo | saopaulo | GA |
| Campinas | sapl | VPS |
| Jundiaí | jundiai | VPS |
| Osasco | rdm | VPS |
| Guarulhos | guarulhos | VPS |
| São Bernardo do Campo | sbc | VPS |

### Regras de exclusividade
- **Olímpia** → só SABESP
- **Sumaré** → só COMGÁS
- **Lins** → só SABESP
- **Mogi das Cruzes** → só COMGÁS (pendente de implementação)

---

## 9. Pendentes

| Item | Status | Próximo passo |
|------|--------|---------------|
| Caraguatatuba | Bloqueado (proxy reverso) | LAI — pedir whitelist IP ou URL direta SAPL |
| Pindamonhangaba | Não testado | SoftCam — testar Puppeteer |
| Mogi das Cruzes | Parser criado, não subido | Subir parser + municipios-comgas.json |
| Jundiaí COMGÁS | Parser criado, não subido | Subir parser + municipios-vps.json COMGÁS |
| Cajamar | URLs 404 | Remapear URLs novas |
| Rio Grande da Serra | Sem PLs 2026 | Aguardar ou investigar subcategoria |
| Osasco | LAI enviado | Aguardar resposta |

---

## 10. Siscam — Mapeamento de IDs por Município

| Município | URL base | siscam_id | PL doc |
|-----------|----------|-----------|--------|
| Paulínia | paulinia.siscam.com.br | 78 | 129 |
| Itaquaquecetuba | itaquaquecetuba.siscam.com.br | 79 | 130 |
| Itatiba | siave.camaraitatiba.com.br | 80 | 134 |
| Piracicaba | siave.camarapiracicaba.sp.gov.br | 78 | 129 |
| Mauá | consulta.camaramaua.sp.gov.br | 74 | 122 |
| Sumaré | sumare.siscam.com.br | 80 | 135 |
| Olímpia | olimpia.siscam.com.br | 80 | 136 |
| Lins | lins.siscam.com.br | 80 | 140 |

---

## 11. Keywords

### SABESP (12)
`sabesp, saneamento, hídrico, hídrica, abastecimento, esgoto, água, concessão, privatização, serviço de água, serviço de esgoto, recursos hídricos`

### COMGÁS (28)
`comgas, comgás, companhia de gás, companhia de gas, distribuidora de gás, distribuidora de gas, gás natural, gas natural, gás canalizado, gas canalizado, rede de distribuição de gás, rede de gas, rede de gás, concessão de gás, concessão do gás, serviço de gás, serviço de gas, fornecimento de gás, fornecimento de gas, biometano, gasoduto, encanamento de gás, tubulação de gás, tubulação de gas, infraestrutura de gás, abertura de vala, escavação em via, interferência em rede, subsolo urbano`

---

## 12. Convenções de Código

### ID único de propositura
```javascript
id: `${municipio_slug}-${id_interno}`
// ex: "campinas-12345", "guarulhos-2130282"
```

### enriquecerEmentas — quando usar
Usar quando a ementa não está disponível na listagem — precisa buscar na página de detalhe.
Só é chamado para itens **novos** — não reprocessa histórico.

### Filtro de siglas SPL
```javascript
const SIGLAS_IGNORAR = new Set(['PC','PAR','AUT','SUB','EMD','DES','OF','NR']);
if (SIGLAS_IGNORAR.has(sigla.toUpperCase())) continue;
```

### Parada inteligente (Carapicuíba)
```javascript
const todosVistos = props.every(p => vistos.has(p.id));
if (todosVistos) break;
```

---

*Fim do documento — versão 1.0 — 01/05/2026*
