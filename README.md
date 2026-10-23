# Carteira · Gestão pessoal

Aplicação web local, em português do Brasil, para acompanhar posições, registrar cotações manuais com fonte, salvar snapshots, controlar proventos e planejar aportes sem tratar simulações como compras.

## Executar

Requer Node.js 18 ou superior. No diretório do projeto:

```sh
node server.js
```

Abra <http://127.0.0.1:4173>. Para outra porta, defina `PORT`. A aplicação não exige instalação de pacotes, banco externo ou credenciais.
O arquivo `.env.example` documenta a única configuração do servidor (`PORT`) e que ainda não existe integração de mercado; o servidor não carrega arquivos `.env` automaticamente.

## Importação inicial e dados

Na primeira abertura, a aplicação tenta importar `backup_carteira_diversificacao.json` automaticamente. Também é possível importar um JSON em **Fontes e configurações**. A importação inicial reconhece `schema_version`, associa posições por ticker e é idempotente. Posições em arquivo de backup completo são mescladas por ticker/ID para evitar duplicação. Importações parciais não apagam dados locais.

As 11 quantidades importadas correspondem a 11/09/2026. Campos `null` permanecem ausentes. Não são atribuídos preços, custo médio ou valor atual. Referências de renda fixa de 21/09/2026, snapshots sem data exata e o plano de outubro/2026 ficam históricos/pendentes. Confirmar esse plano pede as quantidades efetivamente executadas e não aplica automaticamente as quantidades planejadas.

## Persistência e recuperação

Localmente, os dados compartilhados entre navegadores deste computador são gravados em `data/carteira.json` pelo servidor em `127.0.0.1`; `localStorage` permanece como cópia local. Para hospedagem gratuita, o projeto inclui Firebase Hosting e Cloud Firestore com isolamento por conta (veja [DEPLOY.md](DEPLOY.md)). O app não inclui carteira ou senha nos arquivos publicados. Exporte **backup completo** regularmente para recuperação e transporte entre dispositivos.

## Cotações e outras fontes

Não existe integração automática com Investidor10, B3, CVM, provedor de mercado ou serviço de notícias. O Investidor10 é indicado no backup como fonte preferida para conferência, mas não há scraping. A tela permite registrar preço manual, fonte, URL, data de referência e método; o valor fica marcado como manual. Fundamentos, notícias e eventos futuros de proventos são marcados como indisponíveis quando não registrados. Para automação será necessário escolher um provedor com API/uso permitido, revisar custo e limites, obter credenciais do usuário e implementar um backend com cache, timeout, controle de chamadas e segredos em ambiente privado. Nenhuma chave é necessária para a versão atual.

## Regras e limitações

- Patrimônio total confirmado vem dos snapshots, e não é inferido somando valores históricos sobre caixa atual.
- O valor de mercado e os pesos usam somente quantidades e cotações manuais confirmadas; caixa/renda fixa só entram com dados atuais confirmados em snapshot.
- Variação entre snapshots é mostrada, mas sua causa permanece não conciliada até haver dados de preço e fluxos suficientes.
- Proventos previstos são separados de recebidos; apenas recebimentos explicitamente destinados ao aporte entram nos proventos elegíveis.
- O planejador soma contribuição fixa + proventos elegíveis do mês anterior + sobra anterior. Compras simuladas não mudam posições. O registro de transação confirmada altera a quantidade.
- O relatório mensal abre uma página própria pronta para **Imprimir / salvar em PDF** no navegador. O PDF arquivado deve ser salvo pelo usuário.
- Idioma e moeda: pt-BR / BRL. Datas usam `America/Maceio`; fins de semana requerem confirmação explícita para snapshots.

## Validação

`node --test` executa testes Node.js de idempotência, null, valor de mercado, variação percentual, orçamento, sobra e detecção de fim de semana. `node server.js` sobe um servidor estático local sem dependências externas. `npm start` e `npm test` também estão definidos para ambientes com npm instalado.
