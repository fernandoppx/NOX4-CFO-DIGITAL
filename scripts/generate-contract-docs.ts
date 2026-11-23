// Gera a versão pública do contrato a partir do modelo único.
// Uso: npx tsx scripts/generate-contract-docs.ts
import { writeFileSync } from 'node:fs';
import {
  buildContract,
  contractToHtmlBody,
  contractToMarkdown,
} from '../supabase/functions/_shared/contractTemplate';

const doc = buildContract();

writeFileSync('docs/contrato-licenca-nox4.md', contractToMarkdown(doc));

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contrato de Licença de Uso — NOX4</title>
<link rel="icon" href="/favicon.svg">
<style>
:root{--bg:#F8FAFC;--fg:#0F172A;--muted:#475569;--line:#E2E8F0;--accent:#2563EB}
@media (prefers-color-scheme: dark){:root{--bg:#050A1A;--fg:#E2E8F0;--muted:#94A3B8;--line:#1E293B;--accent:#60A5FA}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:28px;line-height:1.25;margin:0 0 8px}
h2{font-size:19px;margin:32px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
p{margin:0 0 12px}
a{color:var(--accent)}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:24px;font-size:14px;color:var(--muted)}
@media print{.top{display:none} body{background:#fff;color:#000}}
</style>
</head>
<body>
<main>
<div class="top"><strong>NOX4</strong><a href="javascript:window.print()">Imprimir ou salvar em PDF</a></div>
<p style="color:var(--muted);font-size:14px">Modelo público. Na contratação, o cliente recebe por e-mail este contrato em PDF, preenchido com os dados da empresa dele, o plano escolhido e o registro do aceite.</p>
${contractToHtmlBody(doc)}
</main>
</body>
</html>
`;
writeFileSync('public/contrato.html', html);
console.log('docs/contrato-licenca-nox4.md e public/contrato.html atualizados');
