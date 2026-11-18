export type GeneratorOptions = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};
export const defaultGenerator: GeneratorOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: true,
};
const alphabets = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%&*+-=?',
};
const ambiguous = { lower: 'ilo', upper: 'ILO', digits: '01', symbols: '|`\'"' };
export function randomIndex(max: number) {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error('Intervalo inválido');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}
export function generatePassword(options: GeneratorOptions) {
  if (!Number.isInteger(options.length) || options.length < 8 || options.length > 128)
    throw new Error('Tamanho entre 8 e 128');
  const groups = (Object.keys(alphabets) as (keyof typeof alphabets)[])
    .filter((k) => options[k])
    .map((k) => (options.excludeAmbiguous ? alphabets[k] : alphabets[k] + ambiguous[k]));
  if (!groups.length) throw new Error('Selecione ao menos uma classe');
  const all = groups.join('');
  const result = groups.map((group) => group[randomIndex(group.length)]);
  while (result.length < options.length) result.push(all[randomIndex(all.length)]);
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { password: result.join(''), entropy: Math.round(options.length * Math.log2(all.length)) };
}
