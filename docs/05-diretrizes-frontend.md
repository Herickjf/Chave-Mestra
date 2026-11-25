# Diretrizes visuais e de implementação do frontend

Referência: estudo de componentes **Soft / System** anexado ao pedido. Este documento orienta alterações manuais no `frontend/` e complementa `03-frontend.md` e `02-criptografia.md`.

## Identidade visual

| Papel | Cor usada | Regra |
|---|---|---|
| Cobalt | `#0755d5` a `#197fff` | Ação primária, seleção e progresso |
| Sky | `#d8e9ff` a `#72a8ff` | Fundos de ícones, foco e realce leve |
| Mist | `#e4e5e8` | Trilhas, divisórias e campos |
| Ivory | `#f7f5f1` | Fundo de página e cartões quentes |
| Charcoal | `#222b39` | Texto principal |

Os tokens ficam em `:root` de `src/styles/base.css` (`--cobalt`, `--cobalt-light`, `--sky`, `--mist`, `--ivory`, `--charcoal`). Use azul somente para ações e estados ativos. Informações secundárias usam cinza azulado; erros usam vermelho suave e nunca dependem só de cor. O fundo é marfim claro. Cartões têm cantos arredondados (18–26 px), borda quase branca, sombra externa difusa e leve realce interno. Evite sombras fortes em conteúdo crítico: texto e campos devem manter contraste.

## Tipografia e composição

- Títulos: **Manrope** 700/800, espaçamento levemente fechado. Texto e controles: **DM Sans** 400/500/700. Fontes são servidas localmente pelo build.
- Cabeçalhos de seção em caixa alta com espaçamento aberto; usar somente como sinalização curta.
- Espaçamento base de 8 px, com grupos de 16/24/32 px. Máximo de duas colunas de conteúdo no desktop.
- Botões primários usam gradiente cobalt e texto branco. Secundários são claros, com sombra suave. Ambos exigem estado de foco visível, hover e disabled.
- Campos de busca e formulário têm fundo claro, raio 13–16 px e foco azul. Rótulo permanece visível, não depender só de placeholder.
- A barra lateral organiza cofre, gerador e ajustes no desktop. Em telas pequenas, navegação inferior com rótulo e ícone. Não ocultar ação de bloqueio e saída.
- Alerta de adulteração deve ser explícito, com rótulo **Adulterado**, e jamais mostrar conteúdo quando AES-GCM falhar.

## Componentes e estados

Use os componentes em `src/components/`, as telas em `src/pages/` e os estilos em `src/styles/` como ponto de partida: `Brand`, `Alert`, `StrengthMeter`, `PasswordInput`, cartões, botões, lista, formulário, detalhe e navegação. Em novos componentes, preservar os tokens e comportamento responsivo. Cobrir sempre estados vazio, carregando, erro, sucesso, bloqueado e conflito de versão.

O painel do cofre prioriza busca local, lista e detalhe. Não enviar título, URL, usuário, senha ou notas à API em texto claro. O gerador mostra opções, senha e entropia. A configuração de bloqueio deve ser fácil de encontrar. A senha copiada é limpa da área de transferência em aproximadamente 15 segundos, com aviso de que isso é melhor esforço.

No modo visitante, manter o aviso de sessão temporária nas telas de entrada e no cofre. Itens visitantes são cifrados, mas ficam apenas em memória. Sair, recarregar, fechar a aba ou atingir o tempo de inatividade elimina o conteúdo; a interface deve anunciar esse efeito antes de encerrar a visita. Não exibir controles de troca da senha mestra nessa sessão.

## Conformidade técnica e acessibilidade

- `src/crypto/` é a única camada que cifra/decifra; nenhum componente chama `fetch` diretamente, use `src/api/client.ts`.
- Nunca persistir `CryptoKey`, senha mestra ou itens decifrados em storage, URL, logs ou analytics. Apenas o tempo de bloqueio pode ir ao `localStorage`.
- `vaultKey` e itens decifrados saem do estado ao bloquear ou sair. Não usar `dangerouslySetInnerHTML`.
- URL fornecida pelo usuário só vira link após validar `http:` ou `https:` e usa `rel="noopener noreferrer"`.
- Controles devem ter rótulos acessíveis, foco visível, alvos de toque de pelo menos ~40 px e texto legível em 320 px. Mensagens dinâmicas usam `role="status"`.
- Manter CSP restritiva e fontes locais. Qualquer domínio externo novo exige revisão explícita da CSP e da privacidade.
- Antes de aceitar mudança visual, conferir em 320 px, 768 px e desktop, com teclado e fluxo de cadastro, cofre vazio, item adulterado e bloqueio.
