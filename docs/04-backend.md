# VaultZero: Especificação do Backend

## 1. Responsabilidades

O backend **autentica, autoriza e armazena**. Nunca interpreta o conteúdo do cofre. Ele deve ser projetado assumindo que o banco de dados é público: o que está lá não pode revelar nada. Detalhes criptográficos em `02-criptografia.md`.

## 2. Stack

| Tecnologia | Uso |
|---|---|
| Node.js 20 + TypeScript | Runtime |
| Express | API HTTP |
| `pg` (node-postgres) | Acesso ao banco, **somente consultas parametrizadas** |
| `argon2` | Hash do `authKey` |
| `zod` | Validação de entrada |
| `helmet` | Cabeçalhos de segurança |
| `express-rate-limit` | Limite de requisições |
| `cookie-parser` | Cookies de sessão |
| `pino` (com redação) | Logs |
| `node-pg-migrate` ou SQL puro | Migrações |
| Vitest/Jest + Supertest | Testes |
| PostgreSQL 15+ | Banco |

## 3. Estrutura de pastas

```text
backend/
├── README.md                 # Mapa de navegação e comandos
├── scripts/copy-migrations.mjs
└── src/
    ├── app.ts                # Composição do Express
    ├── server.ts             # Inicialização, migrações e encerramento
    ├── config.ts             # Validação do ambiente
    ├── db/
    │   ├── pool.ts
    │   ├── migrate.ts
    │   └── migrations/
    ├── middleware/           # Sessão, CSRF, rate limiting e erros
    ├── validation/           # Schemas Zod e tipos de entrada
    ├── routes/               # Contratos HTTP: auth, vault e health
    ├── services/             # Regras e SQL: auth, session e vault
    ├── types/database.ts     # Tipos das linhas do PostgreSQL
    ├── utils/                # Base64url, HttpError e handlers async
    └── __tests__/app.test.ts
```

## 4. Modelo de dados

```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id                  UUID PRIMARY KEY,              -- gerado pelo cliente (entra no AAD)
  email               CITEXT NOT NULL UNIQUE,
  auth_hash           TEXT   NOT NULL,               -- Argon2id do authKey
  kdf_salt            BYTEA  NOT NULL UNIQUE,        -- 16 bytes
  kdf_iterations      INTEGER NOT NULL CHECK (kdf_iterations >= 600000),
  wrapped_vault_key   BYTEA  NOT NULL,
  wrapped_vault_iv    BYTEA  NOT NULL,               -- 12 bytes
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   BYTEA NOT NULL UNIQUE,                -- SHA-256 do token; o token em si não é guardado
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- atualizado a cada requisição autenticada para renovar a janela de inatividade
  expires_at   TIMESTAMPTZ NOT NULL,                 -- prazo absoluto fixado na criação da sessão
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX ON sessions (user_id);

CREATE TABLE vault_items (
  id          UUID PRIMARY KEY,                      -- gerado pelo cliente (entra no AAD)
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  iv          BYTEA NOT NULL,                        -- 12 bytes
  ciphertext  BYTEA NOT NULL,                        -- inclui a tag GCM
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vault_items (user_id);
```

Observações:
- **Título, URL, usuário, senha e notas ficam dentro do `ciphertext`.** Não existem colunas legíveis sobre o conteúdo.
- O token de sessão é guardado como hash: um vazamento do banco não entrega sessões válidas.
- `ciphertext` limitado a ~64 KB por item (`CHECK (octet_length(ciphertext) <= 65536)`).

## 5. API

Prefixo `/api`. JSON em UTF-8. Bytes trafegam em **base64url**.

### 5.1 Autenticação

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/auth/register` | Cria conta | Não |
| POST | `/auth/prelogin` | Retorna `salt` e `kdfIterations` | Não |
| POST | `/auth/login` | Valida `authKey`, cria sessão | Não |
| POST | `/auth/logout` | Revoga sessão atual | Sim |
| POST | `/auth/change-password` | Troca senha mestra (reembrulha chave) | Sim |
| GET | `/auth/me` | Dados da sessão e chave embrulhada | Sim |

**`POST /auth/register`**
```json
{
  "id": "uuid",
  "email": "a@b.com",
  "authKey": "b64url(32 bytes)",
  "kdfSalt": "b64url(16 bytes)",
  "kdfIterations": 600000,
  "wrappedVaultKey": "b64url",
  "wrappedVaultIv": "b64url(12 bytes)"
}
```
→ `201 {}`. E-mail repetido retorna `409` (aceito no beta; em produção, resposta uniforme com confirmação por e-mail).

**`POST /auth/prelogin`** `{ "email" }` → `200 { "kdfSalt", "kdfIterations" }`.
Para e-mail inexistente: salt = `HMAC-SHA256(PRELOGIN_SECRET, email)[0:16]` e iterações padrão. Assim a resposta é indistinguível.

**`POST /auth/login`** `{ "email", "authKey" }`
→ `200 { "userId", "wrappedVaultKey", "wrappedVaultIv" }` + `Set-Cookie: vz_session=...`.
Falha → `401 { "error": "invalid_credentials" }` (mesma resposta para usuário inexistente, senha errada ou conta bloqueada, exceto o `429` do rate limit).

Para igualar o tempo de resposta quando o usuário não existe, executar uma verificação Argon2id contra um hash "dummy".

**`POST /auth/change-password`**
```json
{ "currentAuthKey", "newAuthKey", "newKdfSalt", "newKdfIterations",
  "newWrappedVaultKey", "newWrappedVaultIv" }
```
Verifica `currentAuthKey`, atualiza tudo em **uma transação** e revoga as demais sessões.

### 5.2 Cofre

| Método | Rota | Descrição |
|---|---|---|
| GET | `/vault/items` | Lista itens do usuário |
| POST | `/vault/items` | Cria item (`id` vindo do cliente) |
| GET | `/vault/items/:id` | Retorna um item |
| PUT | `/vault/items/:id` | Atualiza (exige `version` atual) |
| DELETE | `/vault/items/:id` | Exclui |

Item no corpo/resposta:
```json
{ "id": "uuid", "iv": "b64url", "ciphertext": "b64url", "version": 3,
  "createdAt": "...", "updatedAt": "..." }
```

Regras:
- **Autorização:** toda query inclui `WHERE id = $1 AND user_id = $2`. Item de outro usuário → `404` (não revela existência).
- **Controle otimista:** `PUT` faz `UPDATE ... WHERE id=$1 AND user_id=$2 AND version=$3` e incrementa `version`; zero linhas → `409`.
- No `POST`, se o `id` já existir (mesmo de outro usuário) → `409` genérico; o `id` nunca é aceito para sobrescrever.
- Validar `iv` com exatamente 12 bytes e `ciphertext` com tamanho mínimo (≥ 16, tag GCM).

### 5.3 Saúde
`GET /health` → `200 { "status": "ok" }`.

## 6. Autenticação e sessão

- Token de sessão: 32 bytes de `crypto.randomBytes`, enviado em cookie `vz_session` com `HttpOnly; Secure; SameSite=Strict; Path=/api`.
- No banco: `SHA-256(token)`.
- Expiração: 30 min de inatividade, 8 h absolutas (renovação deslizante a cada requisição válida, respeitando o teto).
- Logout: marca `revoked_at`, limpa o cookie.
- **CSRF:** `SameSite=Strict` + exigir cabeçalho `X-Requested-With: vaultzero` nas rotas que mudam estado + CORS restrito à origem do front.
- Middleware `auth.ts`: lê cookie → hash → busca sessão válida (não expirada, não revogada) → `req.user = { id }`.

## 7. Proteção contra força bruta · RNF09

| Camada | Regra |
|---|---|
| Por IP | 20 requisições/15 min em `/auth/login` e `/auth/prelogin` (ajustável) |
| Por conta | Após 5 falhas seguidas, `locked_until = now() + backoff` (1, 5, 15 min…) |
| Sucesso | Zera `failed_attempts` |
| Mensagens | Sempre genéricas |

O contador por conta pode ser atualizado de forma atômica (`UPDATE ... RETURNING`) para evitar corrida. Atenção: bloqueio por conta permite *DoS* contra um usuário-alvo; no beta é um compromisso aceitável e vale discutir em sala.

## 8. Segurança da aplicação · RNF10

- **SQL injection:** somente `pool.query(text, params)`. Proibido concatenar strings em SQL.
- **Validação:** `zod` em todo corpo, parâmetro e query; rejeitar campos desconhecidos (`.strict()`); limite de corpo (`express.json({ limit: "128kb" })`).
- **Helmet:** HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, CSP.
- **CORS:** lista fixa de origens vinda de variável de ambiente, `credentials: true`.
- **Erros:** handler central que nunca devolve stack trace nem mensagens do banco.
- **Logs:** `pino` com redação de `authKey`, `currentAuthKey`, `newAuthKey`, `ciphertext`, `wrappedVaultKey`, cookies e `Authorization`. Registrar apenas eventos (login ok/falha, bloqueio), IP e id do usuário.
- **Argon2id:** parâmetros configuráveis por variável; medir no hardware da demo (alvo ~100–300 ms).
- **Dependências:** lockfile e `npm audit`.

## 9. Configuração (variáveis de ambiente)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `PRELOGIN_SECRET` | Segredo para salts falsos (≥ 32 bytes aleatórios) |
| `ALLOWED_ORIGIN` | Origem do frontend (CORS) |
| `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST` | Parâmetros do Argon2id |
| `SESSION_IDLE_MIN`, `SESSION_ABSOLUTE_HOURS` | Tempos de sessão |
| `NODE_ENV` | `development` / `production` |

Fornecer `.env.example` sem valores reais; `.env` no `.gitignore`. A aplicação falha na inicialização se variáveis obrigatórias estiverem ausentes.

## 10. Docker Compose (RNF14)

Serviços: `db` (postgres:15 com volume), `api` (Node), `web` (build do React servido por Nginx, com proxy `/api` → `api` e TLS com certificado local). Um único `docker compose up` deve subir tudo, aplicando as migrações no início.

## 11. Testes

- **Autenticação:** registro e login felizes; senha errada → 401; e-mail inexistente → 401 com mesmo corpo; `prelogin` indistinguível para e-mail inexistente; bloqueio após N falhas; sessão expirada/revogada → 401.
- **Autorização:** usuário A não lê, edita nem exclui item de B (404); `POST` com `id` existente não sobrescreve.
- **Integridade de dados:** `PUT` com `version` desatualizada → 409; `iv` com tamanho inválido → 400.
- **Segurança:** entrada com payload de SQL injection não altera o comportamento; corpo grande → 413; logs não contêm campos sensíveis.
- **Prova de zero-knowledge:** teste que cadastra usuário e item, consulta o banco diretamente e verifica que nenhum texto claro (senha, título) aparece nas tabelas.

## 12. Roteiro para as demonstrações

1. **Vazamento:** `docker compose exec db psql ... -c "SELECT * FROM vault_items;"` e `SELECT email, auth_hash, wrapped_vault_key FROM users;` mostram apenas bytes e hashes.
2. **Adulteração:** `UPDATE vault_items SET ciphertext = <um byte alterado> WHERE id = ...;` → o front exibe "Adulterado".
3. **Troca de blobs:** trocar `iv`+`ciphertext` entre dois itens → falha por causa do AAD.
4. **Acesso indevido:** com a sessão de A, `curl /api/vault/items/<id de B>` → 404.
5. **Força bruta:** script com tentativas repetidas → 429/bloqueio.
6. **Custo offline:** medir o tempo de derivação (PBKDF2 + Argon2id) e estimar tentativas/segundo de um atacante.

## 13. Entregáveis do backend

- [ ] Migrações e modelo de dados
- [ ] Rotas de autenticação com Argon2id, sessões e rate limiting
- [ ] Rotas do cofre com autorização por recurso e controle de versão
- [ ] Validação, Helmet, CORS, logs com redação
- [ ] Testes de autenticação, autorização e zero-knowledge
- [ ] `docker-compose.yml`, `.env.example` e README
