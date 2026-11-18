# VaultZero: Requisitos (versão beta)

> Gerenciador de senhas *zero-knowledge* para fins didáticos, disciplina de Segurança Computacional.

## 1. Visão geral

O VaultZero permite que um usuário crie uma conta, guarde credenciais de vários serviços, gere senhas fortes e acesse tudo por meio de uma **senha mestra**. Toda credencial é cifrada **no navegador** antes de ser enviada. O servidor só armazena dados que não consegue ler.

**Propriedade central (zero-knowledge):** o servidor nunca recebe a senha mestra, a chave de criptografia nem qualquer credencial em texto claro.

## 2. Modelo de ameaça

| Adversário | Capacidade | Defesa principal |
|---|---|---|
| **Atacante com acesso ao banco** (vazamento, SQL injection, admin malicioso) | Lê e altera qualquer linha | Criptografia no cliente, AEAD, KDF custoso |
| **Usuário autenticado malicioso** | Tenta acessar dados de outro usuário | Autorização por recurso (anti-IDOR) |
| **Atacante de rede** | Intercepta ou altera requisições | TLS, HSTS, cookies seguros |
| **Força bruta online** | Tenta muitas senhas no login | Rate limiting, bloqueio temporário |

**Fora do escopo:** malware ou keylogger na máquina do usuário, servidor entregando JavaScript malicioso, ataques de canal lateral, comprometimento do navegador.

## 3. Requisitos funcionais

| ID | Requisito | Conceito |
|---|---|---|
| **RF01** | Criar conta com e-mail e senha mestra. | Autenticação, derivação de chaves |
| **RF02** | Fazer login com e-mail e senha mestra. | Autenticação |
| **RF03** | Fazer logout, invalidando a sessão no servidor e descartando chaves no cliente. | Gestão de sessão |
| **RF04** | Criar credencial (título, URL, usuário, senha, notas). | Criptografia no cliente |
| **RF05** | Listar e visualizar credenciais, decifradas no navegador. | Confidencialidade |
| **RF06** | Editar e excluir credenciais. | Integridade, autorização |
| **RF07** | Gerar senhas fortes configuráveis (tamanho, maiúsculas, minúsculas, números, símbolos) com CSPRNG. | Aleatoriedade segura |
| **RF08** | Exibir a força da senha mestra no cadastro e rejeitar senhas fracas. | Política de senhas |
| **RF09** | Bloquear o cofre automaticamente após inatividade, descartando a chave da memória. | Gestão de chaves |
| **RF10** | Copiar senha para a área de transferência, com limpeza após ~15 s. | Redução de exposição |
| **RF11** | Alterar a senha mestra sem perder as credenciais. | Key wrapping |
| **RF12** | Detectar credenciais adulteradas e avisar o usuário, sem exibir dado corrompido. | Integridade |
| **RF13** | Buscar credenciais por título/URL (busca local, após decifrar). | Privacidade dos metadados |
| **RF14** | Usar um cofre visitante sem cadastro, com itens cifrados apenas em memória e descarte ao sair, recarregar ou ficar inativo. | Uso temporário local |

## 4. Requisitos não funcionais

### 4.1 Segurança

| ID | Requisito |
|---|---|
| **RNF01** | **Criptografia no cliente:** credenciais cifradas com **AES-256-GCM** (Web Crypto API) antes do envio. O servidor nunca recebe texto claro. |
| **RNF02** | **Derivação de chave:** PBKDF2-HMAC-SHA256 com **≥ 600.000 iterações** e salt único por usuário (alternativa: Argon2id via WASM). |
| **RNF03** | **Separação de chaves:** da senha mestra derivam-se duas saídas independentes via HKDF: uma chave de criptografia (nunca sai do navegador) e um *auth key* (enviado ao servidor). |
| **RNF04** | **Hash no servidor:** o auth key é tratado como senha e armazenado com **Argon2id** e salt próprio. |
| **RNF05** | **Integridade:** GCM é AEAD. IV aleatório de 96 bits por operação, nunca reutilizado. O identificador do item e do usuário entram como *AAD*, impedindo que o servidor troque blobs entre registros. |
| **RNF06** | **Autorização:** toda rota valida a sessão e confere que o recurso pertence ao usuário. |
| **RNF07** | **Sessão:** token opaco aleatório, curta duração, cookie `HttpOnly; Secure; SameSite=Strict`, invalidação no logout. |
| **RNF08** | **Transporte:** HTTPS/TLS com HSTS. Em desenvolvimento, certificado local. |
| **RNF09** | **Força bruta:** rate limiting por IP e por conta, bloqueio temporário e mensagens genéricas (sem enumeração de usuários). |
| **RNF10** | **Proteção web:** consultas parametrizadas, validação de entrada com schema, CSP restritiva, cabeçalhos de segurança, CORS restrito. |
| **RNF11** | **Segredos fora do código:** configuração via variáveis de ambiente. |
| **RNF18** | **Sem vazamento em logs:** nenhum corpo de requisição de auth ou de cofre é registrado em log. |

### 4.2 Qualidade geral

| ID | Requisito |
|---|---|
| **RNF12** | **Desempenho:** login e decifragem do cofre em até ~2 s para ~100 credenciais. O custo do KDF é proposital. |
| **RNF13** | **Usabilidade:** cadastro, adicionar credencial e gerar senha em até 3 telas/cliques. |
| **RNF14** | **Portabilidade:** `docker compose up` sobe front, API e PostgreSQL. |
| **RNF15** | **Compatibilidade:** navegadores modernos com Web Crypto API (contexto seguro). |
| **RNF16** | **Testabilidade:** testes automatizados das funções criptográficas e das regras de autorização. |
| **RNF17** | **Documentação:** README com arquitetura, modelo de ameaça e justificativa das decisões criptográficas. |

## 5. Fora do escopo do beta

Compartilhamento de cofres, recuperação de conta (em zero-knowledge, perder a senha mestra significa perder o cofre, o que vale demonstrar), 2FA/TOTP (trabalho futuro), extensão de navegador, importação/exportação, app mobile, auditoria avançada.

## 6. Casos de uso principais

1. **Cadastro:** usuário informa e-mail e senha mestra; o navegador deriva chaves, gera a chave do cofre, a embrulha e envia ao servidor.
2. **Login:** o navegador obtém os parâmetros do KDF, deriva as chaves, autentica e desembrulha a chave do cofre.
3. **Gerenciar credenciais:** CRUD cifrado, com busca local.
4. **Bloqueio/desbloqueio:** após inatividade a chave é descartada; para voltar, basta redigitar a senha mestra (a sessão pode continuar válida).
5. **Troca de senha mestra:** reembrulha a chave do cofre sem recifrar os itens.

## 7. Critérios de aceitação por demonstração

| Demonstração | Resultado esperado | Requisitos |
|---|---|---|
| Vazamento do banco (`SELECT * FROM vault_items`) | Apenas bytes cifrados e hashes; nada legível | RNF01, 03, 04 |
| Alterar um byte do texto cifrado no banco | Decifragem falha; interface mostra alerta | RNF05, RF12 |
| Trocar o blob de dois itens no banco | Decifragem falha (AAD não confere) | RNF05 |
| Usuário A requisita item do usuário B | 404 | RNF06 |
| Muitas tentativas de login | 429 e bloqueio temporário | RNF09 |
| Ataque offline ao hash de autenticação | Custo alto por tentativa (KDF + Argon2id) | RNF02, 04 |
| Perda da senha mestra | Cofre irrecuperável (por projeto) | Zero-knowledge |

## 8. Glossário

- **KDF:** função de derivação de chave a partir de uma senha.
- **AEAD:** criptografia autenticada que garante confidencialidade e integridade.
- **AAD:** dados associados, autenticados mas não cifrados.
- **Key wrapping:** cifrar uma chave com outra chave.
- **IDOR:** acesso indevido a recurso por manipulação de identificador.
