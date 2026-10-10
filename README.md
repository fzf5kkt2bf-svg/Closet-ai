# Meu Closet AI

Guarda-roupa digital em português brasileiro, feito com Next.js App Router, TypeScript, Tailwind CSS e React. Protótipo sem backend, contas ou chamadas a serviços de IA.

## Rodar localmente

Requer Node.js 20.9+ (recomendado Node 22 ou 24) e npm.

```sh
npm install
npm run dev
```

Abra http://localhost:3000. Para testar no iPhone, use a mesma rede e o IP local do computador; câmera e instalação funcionam melhor em HTTPS, como no preview da Vercel. A escolha de câmera/galeria depende das opções oferecidas pelo Safari/iOS.

## Funcionalidades

- Início com resumo, atalhos e sugestões baseadas no catálogo.
- Catálogo com busca sem acentos, filtros por categoria e cor e detalhes acessíveis em diálogo.
- Cadastro, edição e exclusão de peças, com foto opcional da câmera ou galeria. Imagens de até 20 MB são convertidas para JPEG com lado máximo de 1.200 px. Se o navegador não decodificar HEIC, use JPEG/PNG/WebP.
- 12 peças fictícias marcadas como DEMO, com ilustrações SVG originais. Nenhuma imagem externa ou fonte remota.
- Até três looks únicos por ocasião, com vestido OU blusa + calça/saia, sempre com calçado. Apenas peças cadastradas compatíveis com a ocasião são usadas; cores neutras têm prioridade. A saída é determinística e não usa IA. Quando há menos possibilidades, gera menos looks e informa a quantidade.
- Histórico de combinações geradas, favoritos e exclusão de looks. Excluir uma peça remove os looks que a utilizam. Editar uma peça atualiza sua representação nos looks existentes; o histórico guarda referências, não fotografias imutáveis.
- Interface mobile-first, navegação fixa com safe area, campos de 16 px no mobile para evitar zoom de formulário no Safari, foco visível, rótulos, avisos acessíveis e respeito a movimento reduzido.

## Persistência e privacidade

Peças, fotos e looks são salvos no IndexedDB deste navegador. As peças de demonstração aparecem na primeira utilização; um catálogo salvo vazio permanece vazio. Não há envio das fotos a servidores, autenticação, sincronização ou backup. Limpar os dados do site, trocar de navegador/dispositivo ou encerrar uma sessão privada pode perder o catálogo. Use uma única aba para editar: não há resolução de alterações concorrentes entre abas. Em caso de falha de escrita, a interface mantém o estado anterior e mostra um aviso. O servidor recebe somente pedidos da aplicação, nunca o catálogo.

## Verificações

```sh
npm run lint
npm test
npm run build
npm start
```

Para testar o fluxo no navegador, faça o build e execute:

```sh
npx playwright install chromium
npm run test:e2e
```

O teste usa viewport de 390 × 844 px no Chromium. Se houver Chromium em `/usr/bin/chromium`, ele será utilizado; para outro executável, defina `PLAYWRIGHT_CHROMIUM_PATH`. O servidor de produção é iniciado pelo Playwright.

Os testes cobrem integridade, compatibilidade de ocasião, determinismo, escassez de peças e exclusão de looks dependentes.

Checklist manual no Safari/iPhone: cadastrar foto pela câmera e galeria; editar e excluir; buscar/filtrar; gerar cada ocasião; salvar favorito; recarregar e conferir persistência; testar área segura, orientação, teclado e navegação por VoiceOver. Verificação automatizada em ambiente Linux não substitui validação em um iPhone físico.

## Publicar na Vercel

1. Faça push da branch e revise/integre o PR.
2. Em Vercel, importe este repositório e escolha o framework Next.js.
3. Use a raiz do repositório, instalação `npm install` (ou `npm ci`), build `npm run build` e as configurações padrão de saída do Next.js.
4. Nenhuma variável de ambiente ou segredo é necessário. Deploys de PR geram previews HTTPS para teste no iPhone.
5. Publique o deployment após revisão. Os dados ficam isolados por origem: preview e domínio de produção têm closets separados.

## Preparação para PWA e próxima fase

Manifesto, ícones PNG (192/512), ícone Apple (180), tema, modo standalone e metadados iOS incluídos. O Safari pode adicionar o site à Tela de Início. Ainda não há service worker, cache offline garantido ou atualização controlada de PWA.

Backend futuro: autenticação, sincronização entre dispositivos, backup/exportação, armazenamento remoto de fotos, regras de acesso, recuperação de conta e limites por usuário. Uma eventual integração de IA deve ocorrer em servidor, com segredos em variáveis de ambiente e consentimento para envio das fotos. OpenAI e Supabase não estão integrados nesta versão.
