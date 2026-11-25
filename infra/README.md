# Infraestrutura — mapa de execução

| Arquivo                             | Responsabilidade                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `Caddyfile.dev`                     | HTTPS local com certificado interno; entrada em `https://localhost:8443` pelo Compose |
| `Caddyfile.prod`                    | HTTPS público para o domínio informado em `DOMAIN`                                    |
| `deploy.sh`                         | Imagens, atualização dos serviços, saúde e tentativa de retorno à tag anterior        |
| `../compose.yml`                    | Serviços e volumes do ambiente local                                                  |
| `../backend/Dockerfile`             | Compilação da API, migrações e imagem de execução                                     |
| `../frontend/Dockerfile`            | Build do React e imagem Nginx                                                         |
| `../frontend/infra/nginx.conf`      | Assets, fallback do React Router, CSP e proxy para a API                              |
| `../.github/workflows/pipeline.yml` | Verificações, publicação de imagens e deploy                                          |

Fluxo: **navegador → Caddy → Nginx → API → PostgreSQL**. O Nginx fica no frontend
para que o Dockerfile possa copiá-lo dentro do próprio contexto de build.

## Script de deploy

Execute `deploy.sh` no diretório de implantação, com `.env`, `compose.prod.yml`
e as variáveis `IMAGE_REPOSITORY` e `IMAGE_TAG` disponíveis.

1. Lê a última tag aprovada em `.release-tag`, quando houver.
2. Baixa as imagens e inicia a atualização pelo Compose.
3. Verifica API e web, até 30 vezes, com intervalo de 2 segundos.
4. Registra a nova tag se ambos responderem; em caso de falha, tenta restaurar a anterior.

As funções `check_api`, `check_web` e `restore_previous` concentram essas etapas.
O retorno de versão atua sobre imagens e containers; não desfaz migrações do banco.

## Pendências anteriores à reorganização

O repositório atualmente não contém `compose.prod.yml`, ainda referenciado pelo
pipeline e por `deploy.sh`. Também falta o `.env.example` da raiz citado pelo README.
Esses arquivos precisam ser restabelecidos ou substituídos para concluir os fluxos
documentados. A organização dos arquivos não ativa nem executa um deploy.
