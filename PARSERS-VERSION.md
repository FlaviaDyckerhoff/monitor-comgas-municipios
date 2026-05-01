# PARSERS-VERSION.md

> Controle de versão dos parsers compartilhados entre repositórios.
> Quando corrigir um parser, atualizar **todos** os repos que o utilizam no mesmo commit.

## Parsers e repositórios que os utilizam

| Parser | SABESP | COMGÁS | Versão | Última atualização |
|--------|--------|--------|--------|--------------------|
| sapl.js | ✅ Campinas, Socorro | ✅ Campinas, Barueri, Jundiaí | 1.1 | 2026-04-09 |
| spl.js | ✅ Santo André, Caçapava, Tremembé, SJC, Taubaté, Santana de Parnaíba* | ✅ Caçapava, SJC, Santana de Parnaíba* | 1.2 | 2026-05-01 |
| legisoft.js | ✅ SBC | ✅ SBC | 1.2 | 2026-04-09 |
| rdm.js | ✅ Osasco | ✅ Osasco (LAI) | 1.0 | 2026-04-06 |
| sagl.js | ✅ Hortolândia | — | 1.0 | 2026-04-06 |
| sino-siscam.js | ✅ Botucatu, Várzea Paulista, Bragança Paulista, Mauá, Itatiba, Itaquaquecetuba, Olímpia, Lins | ✅ Bragança Paulista, Paulínia, Itatiba, Itaquaquecetuba, Piracicaba, Sumaré | 1.1 | 2026-05-01 |
| backsite.js | ✅ Santos | — | 1.1 | 2026-04-09 |
| cajamar.js | ✅ Cajamar | — | 1.0 | 2026-04-06 |
| carapicuiba.js | ✅ Carapicuíba | — | 1.0 | 2026-04-06 |
| joanopolis.js | ✅ Joanópolis | — | 1.0 | 2026-04-09 |
| mairipora.js | ✅ Mairiporã | — | 1.0 | 2026-04-09 |
| nazare-paulista.js | ✅ (bloqueado) | — | 1.0 | 2026-04-09 |
| praia-grande.js | ✅ Praia Grande | — | 1.0 | 2026-04-09 |
| rgserra.js | ✅ Rio Grande da Serra | — | 1.0 | 2026-04-09 |

## Regra de atualização

1. Corrigiu um parser → abre os dois repos em abas separadas
2. Aplica o mesmo diff nos dois
3. Atualiza a coluna **Última atualização** e **Versão** aqui
4. Commit com a mesma mensagem em ambos

## Parsers de risco (sincronização obrigatória)

| Parser | Motivo |
|--------|--------|
| sapl.js | Campinas e outros nos dois repos |
| spl.js | Caçapava nos dois repos |
| legisoft.js | SBC nos dois repos |
| rdm.js | Osasco nos dois repos (LAI) |
| sagl.js | Hortolândia (SABESP) + Jundiaí (COMGÁS) |
