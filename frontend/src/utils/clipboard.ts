export function copySecret(text: string, notify: (message: string) => void) {
  void navigator.clipboard
    .writeText(text)
    .then(() => {
      notify('Copiado. A área de transferência será limpa em cerca de 15 s (melhor esforço).');
      window.setTimeout(() => {
        void navigator.clipboard
          .readText()
          .then((current) => {
            if (current === text) return navigator.clipboard.writeText('');
          })
          .catch(() => undefined);
      }, 15_000);
    })
    .catch(() =>
      notify('Não foi possível copiar. Verifique a permissão da área de transferência.'),
    );
}
