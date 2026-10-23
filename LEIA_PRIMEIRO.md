# Pacote inicial — Sistema de diversificação de carteira

## Arquivos

- `prompt_codex_diversificacao_carteira.md`: prompt principal para colar no Codex. Idealmente abra o Codex na pasta do projeto e peça para ele seguir esse arquivo até implementar e testar a aplicação.
- `backup_carteira_diversificacao.json`: backup recomendado para a importação inicial. Contém as quantidades por ativo, configurações, metas e referências históricas com status.
- `backup_carteira_posicoes.csv`: versão simples das posições, caso o sistema ofereça importação CSV.

## Posições informadas em 11/09/2026

- **Ações:** BBSE3 (5), BBAS3 (4), PETR4 (1), TAEE11 (1), KLBN4 (10), ITSA4 (1).
- **FIIs:** MXRF11 (50), VISC11 (2), BTLG11 (2), BTCI11 (9).
- **ETF:** IVVB11 (1).

## Importante sobre os valores

A conversa contém quantidades por ativo, mas não contém um custo médio individual validado nem uma cotação atual validada para cada ticker. Por isso, esses campos estão vazios/nulos de propósito: o sistema deverá consultar uma fonte permitida e atual ou pedir confirmação manual, sem inventar valores.

O JSON também registra saldos históricos de renda fixa informados em 21/09/2026, referências agregadas do Investidor10 sem data exata identificada e um plano de compras de outubro ainda sem confirmação de execução. O Codex deve mantê-los identificados como referências históricas/pendentes, sem somar tudo como se fosse o patrimônio atual nem adicionar automaticamente as compras planejadas.

## Como usar

1. Coloque o prompt e o JSON na pasta do projeto aberto no Codex.
2. Cole o conteúdo de `prompt_codex_diversificacao_carteira.md` como instrução inicial, ou diga ao Codex para ler o arquivo e cumprir todos os critérios de aceite.
3. Quando a tela de importação estiver pronta, importe `backup_carteira_diversificacao.json` e confira os valores identificados como históricos.
4. Confirme se as compras planejadas para outubro foram realmente executadas antes de registrá-las.
