# Publicação gratuita com Firebase

## O que fica onde

- O repositório GitHub informado é público e recebe apenas os arquivos do sistema. Não envie `data/`, `importacoes/`, capturas, backups, hashes de senha ou dados da carteira.
- Firebase Hosting entrega a interface por HTTPS. Cloud Firestore guarda o estado de cada perfil em um documento separado, cuja leitura e escrita exigem autenticação e correspondência do UID.
- A autenticação usa a API oficial do Firebase. Na tela, a pessoa digita o perfil e a senha; não há uma lista de perfis nem usuário pré-selecionado.
- `firebase-config.js` contém somente a configuração pública do app web. Senhas e tokens não ficam no código nem no GitHub. A proteção dos dados é feita pelas regras em `firestore.rules`.

## Configuração inicial

1. Crie um projeto Firebase no plano Spark e habilite **Authentication > Email/Password**.
2. Crie as duas contas de autenticação. O perfil digitado é convertido nestes endereços internos:
   - `Vitor Samuel` → `vitor-samuel@carteira.app`
   - `Teste` → `teste@carteira.app`
   Os endereços são identificadores internos; não recebem e-mail. Não habilite confirmação por e-mail.
3. Crie o banco Cloud Firestore na edição Standard e aplique as regras de `firestore.rules`.
4. Copie `apiKey` e `projectId` da configuração do app Web Firebase para `firebase-config.js`. Essa configuração é pública; não inclua senhas ou chaves de servidor.
5. Faça o deploy da hospedagem com `firebase deploy --only hosting,firestore:rules`.
6. No site publicado, entre com o perfil e a senha, importe o backup completo exportado da instalação local e confira os totais e históricos. A primeira importação exige ação explícita após entrar; os dados não são copiados do repositório.
7. Configure o mesmo domínio publicado em **Authentication > Settings > Authorized domains** se o Firebase não o adicionou automaticamente.

## Plano gratuito e cotas

Firebase Spark não pede cartão de pagamento. Hosting oferece cotas sem custo e Firestore fornece, na cota gratuita, até 1 GiB armazenado, 50 mil leituras e 20 mil gravações por dia e 10 GiB de saída por mês. Ao exceder cota, o produto pode parar de atender até a reposição da cota, em vez de gerar cobrança no Spark. Projetos gratuitos podem ser afetados por limites de uso. Mantenha exportações de backup fora do GitHub e faça cópias periódicas.

## Privacidade

- No Firestore, cada documento é identificado pelo UID Firebase. As regras negam a leitura e a gravação por outros perfis.
- A senha não é gravada no Firestore, em `localStorage`, em log ou no repositório. O token Firebase fica em `sessionStorage` no navegador e expira/renova pela API de autenticação.
- O app mantém a cópia local do navegador. Para levar a carteira à nuvem, use **Exportar backup completo** localmente; depois entre no site hospedado e importe esse arquivo. A importação é mesclada sem apagar históricos existentes.
- O backup manual continua necessário. A cota gratuita não inclui backup/recuperação do Firestore.
