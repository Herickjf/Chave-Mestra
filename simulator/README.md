# Simulador de arquitetura do VaultZero

Simulador didático no terminal, com menu e roteiro automático. Mostra o que acontece
no cliente, o que atravessa a rede e o que fica armazenado no servidor.

**A criptografia é real:** os módulos em `frontend/src/crypto/` são importados
diretamente. PBKDF2 usa 600.000 iterações, HKDF separa KEK e authKey e AES-256-GCM
protege a chave do cofre e os itens. O hash Argon2id também é calculado de verdade.

**API, transporte, cookie, relógio e banco são modelos em memória.** Não é necessário
Docker, PostgreSQL, frontend aberto ou `.env`. Cada cenário começa com dados fictícios
novos e não persiste contas, credenciais ou chaves em disco.

## Executar

Requer Node.js 20 ou superior. Partindo da raiz do repositório:

```sh
cd simulator
npm ci
npm start
```

No menu, digite o número ou identificador do cenário. `a` executa todos; `0` encerra.
Se a entrada estiver redirecionada, `npm start` executa o roteiro completo. Para
forçar o menu, use `npm start -- --interactive`.

```sh
# Roteiro completo, sem interação
npm run demo

# Apenas adulteração de dados
npm start -- --scenario tamper

# Identificadores disponíveis e ajuda
npm start -- --list
npm start -- --help

# Guardar a saída de uma demonstração, se desejado
npm run demo > demonstracao.txt
```

O simulador já tem suas dependências instaladas neste workspace. Em outro checkout,
execute `npm ci` antes de iniciar. Mantenha a pasta junto do frontend, pois os módulos
criptográficos são compartilhados por importação relativa.

## Cenários

| ID           | Demonstração                                                                        | Requisitos ilustrados              |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `auth`       | Cadastro, prelogin, login, Argon2id e hash do token                                 | RF01, RF02; RNF01–04, RNF07        |
| `vault`      | Criar, ler, buscar localmente, editar e excluir; conflito de versão; visão do banco | RF04–06, RF13; RNF01, RNF05, RNF06 |
| `tamper`     | Inverter um bit e trocar blobs entre itens: falhas de GCM/AAD                       | RF12; RNF05                        |
| `password`   | Trocar senha, preservar ciphertext e invalidar senha/sessões antigas                | RF11; RNF03, RNF07                 |
| `idor`       | Usuário B tenta ler, editar e excluir item de A: 404                                | RNF06                              |
| `session`    | Bloqueio local, desbloqueio, expiração por inatividade e logout                     | RF03, RF09; RNF07                  |
| `bruteforce` | Cinco falhas, bloqueio temporário e limite de 20 chamadas por IP                    | RNF09                              |
| `guest`      | Chave e itens temporários sem API, descartados ao encerrar                          | RF14                               |
| `generator`  | Gerador real com CSPRNG, rejeição e classes configuradas                            | RF07                               |

Cada `[OK]` corresponde a uma condição verificada durante a execução. Uma condição
inesperada interrompe o roteiro com código de saída diferente de zero. Valores de
salt, IV, chaves e ciphertext variam a cada execução porque usam aleatoriedade real.

O relógio é avançado manualmente para demonstrar minutos de inatividade sem esperar.
O teste de prazo absoluto também comprova que atividade recorrente não prolonga a
sessão além das oito horas do modelo.

## Onde encontrar o código

```text
src/
├── cli.ts                    # Argumentos, menu e entrada/saída
├── reporter.ts               # Passos numerados, inspeções e verificações
├── client.ts                 # Papel do navegador; usa a criptografia real
├── server.ts                 # Modelo da API e armazenamento em memória
├── sessions.ts               # Tokens, relógio, expiração e revogação
├── types.ts                  # Contratos e erros HTTP simulados
├── scenarios/
│   ├── index.ts              # Catálogo e executor dos cenários
│   ├── fixtures.ts           # Dados fictícios e preparação de cada cenário
│   ├── auth.ts               # Cadastro e login
│   ├── vault.ts              # CRUD e visão do banco
│   ├── security.ts           # Adulteração, autorização e força bruta
│   ├── session.ts            # Troca de senha e ciclo da sessão
│   └── local.ts              # Visitante e gerador
└── simulator.test.ts         # Cenários completos e limites do relógio
```

## Verificações e limites

```sh
npm test
npm run typecheck
npm run format:check
```

Os serviços Express e as consultas SQL do backend não são executados aqui. O modelo
de servidor reproduz seus fluxos essenciais, mas não exercita constraints do
PostgreSQL, concorrência de transações, TLS, proxies, CSP, CORS ou flags reais de
cookies. Os campos de armazenamento têm nomes simplificados em camelCase.

O bloqueio e o descarte do modo visitante são transições comandadas pelo cenário;
os temporizadores e eventos reais do React não são executados. Clipboard, política
visual de senha, usabilidade e compatibilidade entre navegadores ficam fora deste
simulador. O tempo da demonstração também não substitui o benchmark da aplicação.

Portanto, as verificações demonstram propriedades do modelo e da criptografia
compartilhada; não encerram automaticamente os requisitos pendentes de integração
e validação do produto.
