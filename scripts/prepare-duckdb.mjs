import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const bytes = await readFile(new URL('../node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url));
const directory = new URL('../public/duckdb/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('duckdb-eh-1.32.0.wasm.gz', directory), gzipSync(bytes, { level: 9 }));

const worker = await readFile(new URL('../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url), 'utf8');
await writeFile(new URL('duckdb-browser-eh-1.32.0.worker.js', directory), worker.replace(/\/\/# sourceMappingURL=.*$/gm, ''));

const pdfDirectory = new URL('../public/pdfjs/', import.meta.url);
await mkdir(pdfDirectory, { recursive: true });
await writeFile(new URL('pdf.worker.min.mjs', pdfDirectory), await readFile(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)));
