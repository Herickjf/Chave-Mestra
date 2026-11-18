# VaultZero: Arquitetura criptográfica

Este documento é o contrato entre front e back. O frontend implementa tudo o que é criptografia; o backend só armazena e autentica.

## 1. Hierarquia de chaves

```
Senha mestra + salt (por usuário)
        │  PBKDF2-HMAC-SHA256, ≥ 600.000 iterações
        ▼
   masterKey (256 bits, não exportável)
        │  HKDF-SHA256
        ├── info = "vaultzero/enc"  ──► KEK (Key Encryption Key, AES-GCM)
        └── info = "vaultzero/auth" ──► authKey (256 bits, enviado ao servidor)

vaultKey (256 bits aleatórios, gerado no cadastro)
        │  cifrado com a KEK (AES-256-GCM)
        ▼
wrappedVaultKey + wrappedIv  ──► armazenado no servidor

Cada item do cofre = JSON cifrado com vaultKey (AES-256-GCM)
```

**Por que duas saídas independentes (KEK e authKey)?** O servidor recebe o `authKey` no login. Como ele vem de um ramo diferente do HKDF, não permite calcular a KEK. Assim, nem o login revela a chave de criptografia.

**Por que uma `vaultKey` aleatória?** Trocar a senha mestra exige apenas rederivar a KEK e reembrulhar a `vaultKey`. Os itens não precisam ser recifrados.

## 2. Parâmetros

| Item | Valor |
|---|---|
| KDF | PBKDF2-HMAC-SHA256, 600.000 iterações (armazenadas por usuário para permitir aumento futuro) |
| Salt do KDF | 16 bytes aleatórios (CSPRNG), único por usuário |
| Separação de chaves | HKDF-SHA256, saída de 256 bits cada |
| Cifra | AES-256-GCM, tag de 128 bits |
| IV | 12 bytes aleatórios por operação de cifragem |
| AAD dos itens | `"vaultzero/item/v1" \| userId \| itemId` |
| AAD da chave embrulhada | `"vaultzero/vaultkey/v1" \| userId` |
| Hash no servidor | Argon2id (ex.: m=19 MiB, t=2, p=1 como ponto de partida; ajustar por medição) |
| Codificação | Base64url para trafegar bytes em JSON |

## 3. Fluxos

### 3.1 Cadastro

1. Cliente gera `salt` (16 B) e valida a senha mestra (RF08).
2. Deriva `masterKey`, depois `KEK` e `authKey`.
3. Gera `vaultKey` aleatória e a cifra com a `KEK` → `wrappedVaultKey`, `wrappedIv`.
4. Envia: `email`, `authKey`, `salt`, `kdfIterations`, `wrappedVaultKey`, `wrappedIv`.
5. Servidor aplica Argon2id ao `authKey` e grava.

> Como o AAD inclui `userId`, o id do usuário precisa ser conhecido antes de embrulhar. Solução: o **cliente gera o UUID do usuário** e o envia no cadastro (o servidor valida o formato e a unicidade).

### 3.2 Login

1. `POST /auth/prelogin {email}` → servidor devolve `salt` e `kdfIterations`. Para e-mails inexistentes, devolve valores **falsos determinísticos** (HMAC do e-mail com segredo do servidor), evitando enumeração de usuários.
2. Cliente deriva `masterKey`, `KEK`, `authKey`.
3. `POST /auth/login {email, authKey}` → servidor compara com Argon2id; se válido, cria sessão e devolve `userId`, `wrappedVaultKey`, `wrappedIv`.
4. Cliente decifra a `vaultKey` com a `KEK`. Se falhar, algo está errado (dado corrompido) e o login é abortado no cliente.
5. `vaultKey` fica em memória como `CryptoKey` **não exportável**.

### 3.3 Criar/editar item

1. Cliente gera `itemId` (UUID v4) na criação.
2. Serializa o conteúdo `{title, url, username, password, notes}` em JSON.
3. Gera IV novo, cifra com `vaultKey` e AAD (`userId`, `itemId`).
4. Envia `{id, iv, ciphertext, version}`.

### 3.4 Troca da senha mestra

1. Cliente deriva chaves antigas, comprova a senha atual (authKey antigo).
2. Gera novo `salt`, deriva novas chaves.
3. Reembrulha a **mesma** `vaultKey` com a nova KEK.
4. Envia `{currentAuthKey, newAuthKey, newSalt, newIterations, newWrappedVaultKey, newWrappedIv}`.
5. Servidor atualiza tudo em uma transação e revoga as outras sessões.

## 4. O que cada lado enxerga

| Dado | Navegador | Servidor / BD |
|---|---|---|
| Senha mestra | Memória, só durante a derivação | Nunca |
| masterKey / KEK | Memória, não exportável | Nunca |
| authKey | Calculado e enviado | Recebe, armazena só o hash Argon2id |
| vaultKey | Memória, não exportável | Apenas embrulhada |
| Conteúdo dos itens | Texto claro após decifrar | Apenas `iv` + `ciphertext` |
| Tamanho do blob, datas, nº de itens | Sim | Sim (metadado inevitável) |

## 5. Limitações conhecidas (para discutir na apresentação)

- Se o servidor for comprometido a ponto de servir JavaScript malicioso, o modelo falha. Sem mitigação no beta (SRI e CSP ajudam apenas parcialmente).
- Tamanho dos blobs e nº de itens vazam. Padding é um possível trabalho futuro.
- Um servidor malicioso pode **apagar ou reverter** itens a versões antigas (rollback), pois o AEAD protege contra alteração, não contra remoção. O campo `version` e o AAD reduzem, mas não eliminam, esse risco.
- Perda da senha mestra implica perda do cofre.
- PBKDF2 é resistente a CPU, mas não a GPU/ASIC tanto quanto Argon2id. É a escolha do beta por estar disponível na Web Crypto API.
