import { cp } from 'node:fs/promises';

// O executor usa o mesmo caminho relativo em src/ (desenvolvimento) e dist/ (build).
const source = new URL('../src/db/migrations/', import.meta.url);
const destination = new URL('../dist/db/migrations/', import.meta.url);

await cp(source, destination, { recursive: true });
