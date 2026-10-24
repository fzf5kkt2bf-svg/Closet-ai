# Meu Closet AI · V2

Guarda-roupa digital em português brasileiro, feito com Next.js App Router, TypeScript, Tailwind CSS e Supabase. As cinco telas da V1 continuam disponíveis: Início, Meu Guarda-Roupa, Adicionar Peça, Montar Look e Meus Looks.

## Instalação

Requer Node.js 20.9+ e npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL do seu projeto e a **publishable key** do Supabase. Abra http://localhost:3000. Sem as variáveis, o aplicativo exibe uma mensagem de configuração e permite apenas o modo de demonstração. Nunca use `service_role` ou uma chave secreta no navegador. `.env.local` é ignorado pelo Git.

## Configurar o Supabase manualmente

1. Crie um projeto Supabase. Em **Project Settings → API**, copie a Project URL e a publishable key (`sb_publishable_...`; para projetos antigos, a chave pública `anon` pode ser usada no mesmo campo). Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em `.env.local`. Essas variáveis são públicas no bundle: a proteção dos dados depende das políticas RLS, não do sigilo da chave.
2. Abra **SQL Editor** no painel Supabase. Revise e execute [a migration inicial](supabase/migrations/20261024192021_initial_meu_closet_ai_v2.sql) uma vez no projeto desejado. Ela cria `profiles`, `clothing_items`, `outfits`, `outfit_items`, índices, funções, triggers, políticas RLS e o bucket privado `clothing-photos-private`. Não execute repetidamente: alguns triggers e políticas são criados uma única vez. A migration não apaga registros ou arquivos existentes. Se encontrar tabelas ou bucket com os mesmos nomes, ela interrompe a execução para evitar alterar dados anteriores; revise o conflito antes de aplicar. Verifique no painel que o bucket está marcado como **Private**. No projeto Supabase `Closet AI` conectado nesta sessão, a migration já foi registrada como `20261024192021`; não a execute novamente nesse projeto.
3. Em **Authentication → URL Configuration**, configure a Site URL de produção e adicione `http://localhost:3000` e as URLs HTTPS usadas na Vercel em Redirect URLs. Os links de confirmação de e-mail e recuperação redirecionam para a origem atual do aplicativo. Ative o provedor de e-mail e defina a política de confirmação desejada. Para envio confiável em produção, configure SMTP no Supabase.
4. Reinicie `npm run dev` depois de mudar variáveis de ambiente. Cadastre uma conta e confirme o e-mail, se a confirmação estiver ativa. A tabela `profiles` é preenchida por um trigger após o cadastro; a migration também cria perfis para usuários já existentes, sem sobrescrever perfis.

**Segurança:** as quatro tabelas usam RLS com `auth.uid()`. As chaves estrangeiras compostas de `outfit_items` impedem relacionar looks e peças de usuários distintos. As políticas de Storage limitam operações ao prefixo `<id-do-usuário>/` do bucket privado. As fotos são mostradas por links assinados de curta duração (10 minutos), renovados com a página ativa. Quem receber um link assinado poderá abri-lo até expirar; não compartilhe esses links.

## Dados da V1 e demonstração

O modo demonstração é separado da conta: mostra 12 peças ilustrativas, permite testar a geração de looks e mantém o histórico somente em memória até sair ou recarregar. Peças fictícias nunca são enviadas ao Supabase. A conta pessoal começa vazia.

Se este navegador tiver peças reais salvas pela V1, aparece **Importar da V1** após entrar na conta. A importação é opcional, ignora peças de demonstração e copia fotos e looks válidos. Pode ser retomada se a conexão falhar; IDs estáveis evitam duplicatas. O IndexedDB da V1 permanece intacto, sem exclusão ou migração automática. Confira a conta antes de limpar os dados antigos do navegador. A importação só alcança os dados da V1 presentes **neste mesmo navegador e origem**.

## Fotos e falhas

A câmera e a galeria usam seletores de arquivo do iPhone. Imagens de até 20 MB são decodificadas e convertidas em JPEG (lado máximo de 1.200 px) antes do upload; o bucket aceita JPEG de até 6 MB. Se o Safari não decodificar um HEIC, exporte a foto como JPEG. A foto é opcional e peças sem foto usam SVGs originais.

Ao substituir uma foto, o aplicativo envia a nova, grava o novo caminho na peça e só então remove a antiga. Se a gravação falhar, tenta remover o arquivo recém-enviado. Ao excluir uma peça, exclui primeiro o registro e seus looks relacionados, depois remove a foto. Se a limpeza do Storage falhar, um aviso indica o possível arquivo órfão; a operação de banco já concluída não é revertida. Links das fotos são temporários. Fotos pessoais não são armazenadas no IndexedDB da V2 e não há imagens externas de demonstração.

## Versão de catálogo com IA

Depois de salvar uma peça com foto, abra **Editar peça → Gerar versão de catálogo**. O app envia a foto original privada ao servidor, que confirma a sessão e a propriedade da peça, baixa o arquivo com as políticas RLS e pede uma edição ao modelo `openai/gpt-image-2.5-sunburst` pelo Vercel AI Gateway. A prévia gerada volta ao navegador sem ser salva. Compare **Original / Gerada por IA** e escolha **Usar esta versão** ou **Descartar**. Apenas **Salvar peça** grava a versão aceita em outro arquivo JPEG no bucket privado. A original permanece disponível; é possível voltar a exibi-la. Trocar ou excluir a foto limpa os arquivos antigos quando o banco confirma a alteração.

A geração pode alterar detalhes de tecido, cor ou marca; confira a prévia antes de aprovar. Uma geração consome créditos do AI Gateway, mesmo quando descartada. As fotos são enviadas ao provedor do modelo para processamento. Consulte as opções de privacidade e cobrança do AI Gateway antes de usar fotos sensíveis. A função é exclusiva do closet pessoal; o modo demonstração não envia imagens.

No projeto Supabase existente, aplique uma única vez [a migration aditiva da versão de catálogo](supabase/migrations/20261024200423_enhanced_photo.sql) pelo SQL Editor, antes de publicar o código. Ela adiciona somente `enhanced_photo_path` à tabela `clothing_items`; não altera fotos ou registros existentes. No projeto `Closet AI` conectado nesta sessão, ela já foi aplicada e registrada como `20261024200423`; não a execute novamente nesse projeto.

Na Vercel, habilite o AI Gateway, ative OIDC no projeto e configure um orçamento adequado para as gerações. Depois de ativar OIDC, crie um novo deployment. No projeto `closet-ai` conectado nesta sessão, OIDC já foi habilitado. O SDK aceita o token OIDC fornecido pela Vercel ao deployment ou à requisição, sem chave de provedor no cliente. Para rodar a geração localmente, configure uma chave **do AI Gateway** em `AI_GATEWAY_API_KEY` apenas no `.env.local`; não use `NEXT_PUBLIC_` nessa variável. Se a autenticação do Gateway falhar, o erro aparece junto ao botão e o cadastro normal continua funcionando.

Se o Gateway devolver `403` mesmo com OIDC ativo, confira **AI Gateway → créditos e acesso da equipe** no painel Vercel. Um `GatewayInternalServerError` com `403` e sem `ruleId` indica que a requisição chegou ao Gateway, mas não aponta para uma regra de bloqueio de modelo. Caso o painel mostre acesso e créditos disponíveis, abra um chamado com o suporte da Vercel informando o ID da equipe e o horário/request ID do log, sem anexar fotos ou credenciais.

## Testes

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:auth
```

Os testes de interface usam Chromium em viewport de iPhone e rodam sem acesso ao seu projeto Supabase. O teste `test:e2e:auth` simula a API para verificar cadastro, login, recuperação, fotos, comparação e aprovação da imagem gerada, edição e exclusão. Os testes de banco executam as migrations em PostgreSQL local (PGlite) e verificam RLS entre dois usuários. Por padrão usa `/usr/bin/chromium` se disponível; em outro ambiente, execute `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_PATH`. Testes locais não substituem a validação manual da câmera, galeria, links de e-mail, geração real, área segura e instalação em um iPhone físico com Safari.

## Publicar na Vercel

1. Revise e integre o PR; importe o repositório ou atualize o deployment existente na Vercel, usando Next.js e a raiz do repositório.
2. No projeto Vercel, configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para os ambientes desejados. Faça novo deploy após alterar as variáveis, pois Next.js inclui as variáveis `NEXT_PUBLIC_` no build do cliente. Não configure uma chave `service_role` no cliente.
3. Adicione o domínio de produção e os domínios de preview que serão usados nas Redirect URLs do Supabase. Teste cadastro, confirmação e recuperação de acesso em HTTPS.
4. Execute a migration manualmente no projeto Supabase correto **antes** de liberar a V2. Faça backup do projeto Supabase pelos mecanismos da sua conta antes de mudanças futuras de schema.

Manifesto, ícones, metadados iOS e service worker permitem instalar o site na Tela de Início. O shell do app pode abrir offline após uma visita; login, dados pessoais e fotos privadas exigem rede. Nenhum dado de conta ou resposta do Supabase é armazenado no cache do service worker.

## Escopo

A V2 oferece autenticação por e-mail, recuperação de senha, dados por usuário e Storage privado. A geração de looks segue regras determinísticas locais sobre as peças carregadas da conta. A versão de catálogo usa IA apenas para apresentar fotos individuais após aprovação. Ainda não há análise de moda por IA, compartilhamento entre contas ou acesso offline aos dados pessoais.
