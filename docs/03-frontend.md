# VaultZero: Especificação do Frontend

## 1. Responsabilidades

O frontend é a **única camada que toca em texto claro**. Ele executa a derivação de chaves, cifra/decifra os itens, gera senhas, avalia força de senha e gerencia o bloqueio do cofre. Detalhes criptográficos em `02-criptografia.md`.

## 2. Stack

| Tecnologia | Uso |
|---|---|
| React 18 + TypeScript | Interface |
| Vite | Build e servidor de desenvolvimento |
| React Router | Rotas |
| Web Crypto API (`crypto.subtle`) | PBKDF2, HKDF, AES-GCM |
| `crypto.getRandomValues` | Aleatoriedade (CSPRNG) |
| `@zxcvbn-ts/core` | Estimativa de força da senha |
| Vitest + Testing Library | Testes |
| Tailwind CSS (opcional) | Estilo |

Sem bibliotecas criptográficas de terceiros no beta: a Web Crypto API cobre tudo, e isso torna a explicação em sala mais limpa.

## 3. Estrutura de pastas

```
frontend/
├── src/
│   ├── crypto/
│   │   ├── kdf.ts            # PBKDF2 + HKDF
│   │   ├── vault.ts          # gerar/embrulhar/desembrulhar vaultKey
│   │   ├── items.ts          # cifrar/decifrar itens
│   │   ├── encoding.ts       # base64url, utf8
│   │   ├── generator.ts      # gerador de senhas
│   │   └── __tests__/
│   ├── api/
│   │   └── client.ts         # fetch com credentials, tratamento de erros
│   ├── state/
│   │   ├── SessionContext.tsx  # usuário, vaultKey (em memória), estado de bloqueio
│   │   └── useAutoLock.ts
│   ├── pages/
│   │   ├── Register.tsx
│   │   ├── Login.tsx
│   │   ├── Vault.tsx
│   │   ├── Generator.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── ItemList.tsx
│   │   ├── ItemForm.tsx
│   │   ├── ItemDetail.tsx
│   │   ├── PasswordField.tsx
│   │   ├── StrengthMeter.tsx
│   │   ├── LockScreen.tsx
│   │   └── TamperAlert.tsx
│   └── main.tsx
```

## 4. Módulo de criptografia (interfaces)

```ts
// kdf.ts
deriveKeys(password: string, salt: Uint8Array, iterations: number):
  Promise<{ kek: CryptoKey; authKey: Uint8Array }>

// vault.ts
generateVaultKey(): Promise<CryptoKey>   // extractable: true apenas para o embrulho
wrapVaultKey(vaultKey: CryptoKey, kek: CryptoKey, userId: string):
  Promise<{ wrapped: Uint8Array; iv: Uint8Array }>
unwrapVaultKey(wrapped: Uint8Array, iv: Uint8Array, kek: CryptoKey, userId: string):
  Promise<CryptoKey>                      // extractable: false

// items.ts
encryptItem(item: ItemPlain, vaultKey: CryptoKey, userId: string, itemId: string):
  Promise<{ iv: Uint8Array; ciphertext: Uint8Array }>
decryptItem(blob: {iv; ciphertext}, vaultKey: CryptoKey, userId: string, itemId: string):
  Promise<ItemPlain>                      // lança TamperError se a tag GCM falhar
```

Regras de implementação:

- `masterKey` e `KEK` importadas com `extractable: false`; `authKey` é a única saída exportada (via `deriveBits`).
- IV gerado com `crypto.getRandomValues(new Uint8Array(12))` a **cada** cifragem.
- Qualquer exceção de decifragem vira `TamperError`, tratada na interface (RF12).
- Nada de `localStorage`/`sessionStorage` para chaves. A `vaultKey` vive apenas na memória do contexto React.

## 5. Telas e fluxos

### 5.1 Cadastro (`/register`) · RF01, RF08
- Campos: e-mail, senha mestra, confirmação.
- `StrengthMeter` em tempo real (zxcvbn). **Bloqueia** envio se score < 3 ou tamanho < 12.
- Aviso explícito e checkbox: *"Se eu perder a senha mestra, meus dados não podem ser recuperados."*
- Mostra indicador de progresso durante o KDF (leva cerca de 0,5 a 1 s).

### 5.2 Login (`/login`) · RF02
- E-mail + senha mestra.
- Sequência: `prelogin` → derivar → `login` → desembrulhar `vaultKey`.
- Erros sempre genéricos: *"E-mail ou senha incorretos."*
- Trata `429` exibindo tempo de espera.

### 5.3 Cofre (`/vault`) · RF04–RF06, RF10, RF12, RF13
- Lista com busca local por título/URL. Itens são decifrados em lote após o login.
- Botões: adicionar, editar, excluir (com confirmação), copiar usuário/senha, mostrar/ocultar senha.
- Item que falha na decifragem aparece com selo **"Adulterado"** (`TamperAlert`) e **não** exibe conteúdo.
- Cópia: `navigator.clipboard.writeText(...)` e, após 15 s, `writeText("")`. Há um aviso na UI de que a limpeza é "melhor esforço".

### 5.4 Gerador (`/generator` e modal dentro do formulário) · RF07
- Opções: tamanho (8–128), minúsculas, maiúsculas, números, símbolos, excluir caracteres ambíguos.
- **Sem viés de módulo:** usar rejeição.

```ts
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}
```

- Garantir ao menos um caractere de cada classe selecionada e embaralhar com Fisher-Yates usando `randomIndex`.
- Exibir entropia estimada: `tamanho × log2(alfabeto)`.

### 5.5 Bloqueio automático · RF09
- `useAutoLock(minutes = 5)`: reinicia o timer em `mousemove`, `keydown`, `click`, `touchstart`.
- Ao expirar (ou ao clicar em "Bloquear"): descarta `vaultKey` e itens decifrados do estado, mostra `LockScreen`.
- Desbloqueio: usuário redigita a senha mestra; refaz a derivação e desembrulha a `vaultKey` (a sessão HTTP pode continuar).
- Se a sessão HTTP também tiver expirado, redireciona ao login.

### 5.6 Configurações (`/settings`) · RF03, RF11
- Trocar senha mestra (senha atual, nova, confirmação) conforme fluxo 3.4 do documento de criptografia.
- Ajustar tempo de bloqueio (1/5/15 min).
- Logout.

## 6. Estado e sessão

```ts
type SessionState =
  | { status: "anonymous" }
  | { status: "locked"; userId: string; email: string }
  | { status: "unlocked"; userId: string; email: string; vaultKey: CryptoKey };
```

- Itens decifrados ficam em estado local do `Vault`, descartados ao bloquear.
- Em `visibilitychange` (aba oculta por muito tempo) é possível bloquear antecipadamente (opcional).

## 7. Segurança no frontend

- **CSP** (entregue pelo servidor que serve o build): `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'`.
- Nunca usar `dangerouslySetInnerHTML`; o React escapa por padrão (defesa contra XSS armazenado via campos de notas/URL).
- Validar URLs ao exibir como link (`https?://` apenas) e usar `rel="noopener noreferrer"`.
- Campos de senha com `autocomplete="off"`/`new-password` conforme o caso.
- Dependências fixadas (lockfile) e `npm audit` no CI.
- Sem `console.log` de dados sensíveis.

## 8. Tratamento de erros

| Situação | Comportamento |
|---|---|
| 401 | Limpa estado e vai ao login |
| 403/404 em item | Mensagem genérica, atualiza lista |
| 409 (conflito de versão) | Pergunta se recarrega o item |
| 429 | Mostra tempo de espera |
| `TamperError` | Selo de adulteração, item bloqueado |
| Falha de rede | Mensagem e opção de tentar de novo |

## 9. Testes

- **Unitários (crypto):** cifrar/decifrar ida e volta; alterar 1 byte do `ciphertext` → falha; alterar IV → falha; AAD com `itemId` errado → falha; KEK errada → falha ao desembrulhar; `authKey` ≠ KEK; determinismo do KDF para mesmo salt.
- **Gerador:** respeita tamanho e classes; distribuição aproximadamente uniforme.
- **Componentes:** bloqueio por inatividade (fake timers); limpeza do clipboard; bloqueio de cadastro com senha fraca.

## 10. Entregáveis do frontend

- [ ] Módulo `crypto/` com testes
- [ ] Páginas de cadastro, login, cofre, gerador, configurações
- [ ] Bloqueio automático e limpeza de clipboard
- [ ] Alerta de adulteração
- [ ] Build servido com CSP
- [ ] Modo "demo" opcional: botão que exibe o blob cifrado de um item (apoio à apresentação)
