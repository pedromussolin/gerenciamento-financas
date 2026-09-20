# Fluxo

Controle financeiro pessoal em React/TypeScript/Vite, com backend Cloudflare Workers e persistência D1. Interface responsiva em português, sem dados pessoais de demonstração. A interface é renderizada apenas no navegador; o Worker serve arquivos e uma API leve, sem SSR.

## Implementado

- Contas com saldo inicial datado, categorias com descrição/cor/limite.
- Receitas, despesas, transferências e recorrências mensais com início/fim.
- Pagamento/recebimento de recorrência substitui sua previsão.
- Projeção do mês selecionado: caixa registrado + recorrências pendentes de contas de dinheiro, menos reserva mínima e aporte adicional planejado.
- Benefícios e investimentos separados do caixa livre.
- Plano do apartamento e simulação SAC/Price com taxa anual efetiva, prazo e encargos fixos.
- API autenticada com dados por usuário, validação e revisão otimista contra sobrescrita entre abas.
- Exportação JSON de dados.

## Limites explícitos

BTG, Nubank e iFood estão desconectados. Não há chamadas bancárias, cotação automática, importação OFX/CSV ou recomendação de investimentos.
A projeção considera as recorrências do mês escolhido; não transporta automaticamente previsões não realizadas de meses anteriores.
Informe o saldo inicial no começo da data e registre movimentações dessa data em diante.
O aporte no plano é ADICIONAL ao já lançado; reduza-o após efetuar aportes, para não reservar o mesmo valor duas vezes.
O saldo reservado para apartamento é uma destinação do patrimônio, nunca somado novamente ao total.
Financiamento é simulação, sem TR, indexadores, carência ou seguros variáveis. Não cria despesas automaticamente.
Uma recorrência vinculada a lançamentos não deve ser excluída: preencha a data final para encerrar sua vigência.
O formato e o armazenamento JSON têm limite de 2 MB por usuário e 10.000 lançamentos. Para volumes maiores, migrar para tabelas normalizadas e paginação.

## Desenvolvimento e hospedagem

Node >=22.13; use o pnpm definido em package.json:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm build
node --experimental-strip-types --test tests/*.test.ts
pnpm exec tsc --noEmit
```

Sites gerencia a identidade autenticada e o D1. A API exige os cabeçalhos de identidade injetados pelo proxy confiável da plataforma; uma execução local sem esse proxy recebe 401 intencionalmente. Nunca publique diretamente um servidor que aceite cabeçalhos de identidade arbitrários da internet. Para migrar a hospedagem, implemente autenticação verificável no servidor antes.
Migrações em drizzle/ são geradas por `pnpm db:generate` e aplicadas pela publicação do Sites.
O espelho GitHub não inclui o identificador privado do Site. Publicar commits no GitHub não atualiza automaticamente o Site.

## Repository Secrets no GitHub

Use **Settings → Secrets and variables → Actions → New repository secret**:

- BANK_API_CLIENT_ID
- BANK_API_CLIENT_SECRET

Esses nomes são convenções para a integração futura; ajuste ao provedor escolhido. Não representam credenciais BTG/Nubank já obtidas.
Nenhuma chave real está cadastrada ou incluída neste repositório.
O workflow manual `bank-sync.yml` injeta os secrets SOMENTE no processo Node de `scripts/bank-sync.mjs`. Esse script falha explicitamente até você implementar o conector. Não há cron, sincronização fictícia nem upload automático de extratos.
Assim, chaves podem ficar apenas no GitHub se a integração rodar no Actions. Se mover a integração para o backend online, configure também os secrets de runtime na hospedagem; o servidor não consulta Actions Secrets durante requisições.
Nunca use VITE_ ou NEXT_PUBLIC_ para segredos, grave tokens em logs/artefatos, ou execute integrações com segredos em pull requests de terceiros.
GitHub Free suporta Repository Secrets sem tarifa separada por chave. Actions, hospedagem e provedores bancários têm cobranças/franquias próprias.

## Segurança e backup

Não commitar .env, .dev.vars, tokens, dumps ou exportações financeiras.
Manter o acesso do Site privado. Backups exportados contêm dados sensíveis.
As migrations e testes não contêm dados pessoais.
