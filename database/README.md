# Banco de dados — estrutura e inicialização

```text
scripts/
├── 01_users.sql        # Contas, parâmetros do KDF e chave embrulhada
├── 02_sessions.sql     # Sessões, hash do token e prazos
└── 03_vault_items.sql  # Credenciais cifradas, titularidade e versão
```

O Compose monta `scripts/` em `/docker-entrypoint-initdb.d`. O entrypoint do
PostgreSQL executa esses arquivos, em ordem, somente ao inicializar um volume vazio.
Os prefixos numéricos respeitam as dependências entre as tabelas.

Cada arquivo apresenta a definição da tabela, suas restrições, índices e comentários
de catálogo. Use quatro espaços, uma coluna por linha e restrições nomeadas em blocos
separados. Os comentários `COMMENT ON` também ficam disponíveis nas ferramentas SQL.

## Inicialização e migrações

| Caminho                      | Executado por                        | Finalidade                                    |
| ---------------------------- | ------------------------------------ | --------------------------------------------- |
| `database/scripts/`          | Entrypoint do PostgreSQL no Compose  | Inicializar volume vazio                      |
| `backend/src/db/migrations/` | API, por `backend/src/db/migrate.ts` | Aplicar SQL registrado em `schema_migrations` |

No estado atual, os scripts de inicialização têm restrições adicionais em relação
à migração `001_init.sql`. Esta reorganização preserva os dois esquemas existentes;
ela não atualiza bancos nem resolve essa diferença.

Para evoluir um banco existente, crie uma nova migração incremental. Editar um arquivo
já registrado em `schema_migrations` não faz o executor reaplicá-lo. Editar `scripts/`
também não modifica volumes já inicializados.

Consultas da aplicação: [backend/src/services/](../backend/src/services/).
Modelo e contrato: [docs/04-backend.md](../docs/04-backend.md).
