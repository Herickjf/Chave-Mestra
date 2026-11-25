# Backend — mapa do código

Comece por `src/server.ts` para entender a inicialização e por `src/app.ts` para
localizar as rotas e os middlewares registrados.

```text
src/
├── server.ts                 # Ambiente, migrações, servidor e encerramento
├── app.ts                    # Composição do Express e montagem das rotas
├── config.ts                 # Validação das variáveis de ambiente
├── routes/                   # Entrada HTTP, status, cookies e respostas
│   ├── auth.routes.ts
│   ├── vault.routes.ts
│   └── health.routes.ts
├── services/                 # Regras de negócio e consultas parametrizadas
│   ├── auth.service.ts        # Cadastro, login, prelogin e troca de senha
│   ├── session.service.ts     # Tokens, expiração, renovação e revogação
│   └── vault.service.ts       # CRUD cifrado, titularidade e versão dos itens
├── middleware/               # Sessão, CSRF, rate limit e tratamento de erros
├── validation/               # Schemas Zod e tipos de entrada derivados deles
├── types/database.ts         # Linhas retornadas pelo PostgreSQL
├── utils/                    # Base64url, HttpError e handlers async
├── db/
│   ├── pool.ts               # Conexão com o PostgreSQL
│   ├── migrate.ts            # Executor transacional com trava de migração
│   └── migrations/           # SQL versionado, também copiado para dist/
└── __tests__/app.test.ts      # Integração da API com banco real
scripts/copy-migrations.mjs    # Empacota o SQL após a compilação TypeScript
```

## Onde alterar

| Alteração                              | Local                                 |
| -------------------------------------- | ------------------------------------- |
| Endpoint ou formato de resposta        | `src/routes/`                         |
| Regra de autenticação, sessão ou cofre | `src/services/`                       |
| Campo ou limite aceito na requisição   | `src/validation/`                     |
| Erro compartilhado                     | `src/middleware/errors.ts`            |
| Variável de ambiente                   | `src/config.ts` e `.env.example`      |
| Evolução de banco existente            | Nova migração em `src/db/migrations/` |

As rotas validam entradas antes de chamar os serviços. Os serviços recebem dados
tipados e concentram o SQL. `HttpError` representa falhas esperadas; o middleware
central converte essas falhas em respostas sem expor mensagens internas do banco.

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

Os testes precisam de um banco exclusivo de teste e das variáveis `DATABASE_URL`,
`PRELOGIN_SECRET` e `ALLOWED_ORIGIN`. Eles criam contas e itens nesse banco.
O build compila TypeScript e copia as migrações para `dist/db/migrations/`.

Contrato: [docs/04-backend.md](../docs/04-backend.md).
Inicialização e migrações: [database/README.md](../database/README.md).
