# Frontend — mapa do código

`src/main.tsx` carrega fontes locais e monta a aplicação. `src/App.tsx` contém a
tabela de rotas; a autorização de navegação fica em `routing/`.

```text
src/
├── App.tsx                     # Rotas públicas e protegidas
├── main.tsx                    # Entrada da aplicação
├── routing/RouteGuards.tsx      # Estados anônimo, bloqueado e desbloqueado
├── layouts/                    # Estrutura das telas públicas e autenticadas
├── components/                 # Alert, Brand, PasswordInput e StrengthMeter
├── pages/
│   ├── auth/                   # Login, Register, LockScreen e GuestEntry
│   ├── vault/
│   │   ├── Vault.tsx           # Composição da página do cofre
│   │   ├── useVault.ts         # Carregamento, busca, cifragem e operações dos itens
│   │   ├── ItemList.tsx        # Lista, busca e estados vazio/carregando
│   │   ├── ItemDetail.tsx      # Detalhes e aviso de adulteração
│   │   ├── ItemForm.tsx        # Formulário de criação e edição
│   │   └── types.ts            # Tipos locais e item vazio
│   ├── settings/               # Ajustes da conta, senha mestra e modo visitante
│   └── Generator.tsx           # Gerador configurável de senhas
├── state/                      # Provider, contexto, tipos e bloqueio automático
├── services/auth.ts            # Fluxos de autenticação com API e criptografia
├── api/client.ts               # Transporte HTTP e tipos do contrato da API
├── crypto/                     # KDF, key wrapping, itens, encoding e gerador
├── utils/                      # Clipboard, erros, força de senha e URLs seguras
└── styles/                     # CSS por área; index.css define a ordem
```

## Onde alterar

| Alteração                                     | Local                                    |
| --------------------------------------------- | ---------------------------------------- |
| Entrada, cadastro ou bloqueio                 | `src/pages/auth/`                        |
| Apresentação da credencial                    | `src/pages/vault/ItemDetail.tsx`         |
| Formulário de credenciais                     | `src/pages/vault/ItemForm.tsx`           |
| Busca, carregamento ou persistência dos itens | `src/pages/vault/useVault.ts`            |
| Fluxo de login ou troca de senha              | `src/services/auth.ts`                   |
| Navegação e barras da aplicação               | `src/layouts/AppShell.tsx`               |
| Cores e padrões globais                       | `src/styles/base.css` e `components.css` |
| Adaptação a telas pequenas                    | `src/styles/responsive.css`              |

`styles/index.css` importa base, componentes, autenticação, layout, cofre, gerador,
configurações e responsividade, nessa ordem. Preserve a ordem para manter a cascata.
Os seletores e as regras foram mantidos ao separar o antigo `styles.css`.

`state/SessionProvider.tsx` mantém a sessão e a chave em memória. `SessionContext.tsx`
expõe o contexto e `useSession`; `session.types.ts` define os estados e as operações.
Os testes ficam junto da área que exercitam: `crypto/`, `pages/auth/` e `pages/vault/`.

## Comandos

Execute nesta pasta, após `npm ci`:

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run format
npm run format:check
```

`infra/nginx.conf` permanece aqui porque é parte do contexto de build do frontend.
Ele serve o React, entrega a CSP e encaminha `/api` para o backend.

Contrato: [docs/03-frontend.md](../docs/03-frontend.md).
Diretrizes visuais: [docs/05-diretrizes-frontend.md](../docs/05-diretrizes-frontend.md).
