// Gera o PDF do contrato a partir do ContractDocument.
// Recebe o módulo pdf-lib como parâmetro para funcionar no Deno (esm.sh) e no Node (npm).
import type { ContractDocument } from './contractTemplate.ts';

// deno-lint-ignore no-explicit-any
type PdfLib = any;

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const WIDTH = PAGE_W - MARGIN * 2;

// Fontes padrão do PDF usam WinAnsi: troca caracteres fora dele
const sanitize = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—€]/g, '');

export async function renderContractPdf(doc: ContractDocument, PDFLib: PdfLib): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitize(doc.title));
  pdf.setAuthor('NOX4 ASSESSORIA E CONSULTORIA MARKETING LTDA');
  pdf.setSubject(sanitize(doc.subtitle));
  pdf.setCreationDate(new Date());

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.28, 0.33, 0.41);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  // deno-lint-ignore no-explicit-any
  const wrap = (text: string, font: any, size: number): string[] => {
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > WIDTH && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // deno-lint-ignore no-explicit-any
  const write = (text: string, font: any, size: number, color = ink, gapAfter = 6) => {
    const lh = size * 1.45;
    for (const l of wrap(text, font, size)) {
      if (y - lh < MARGIN) newPage();
      page.drawText(l, { x: MARGIN, y: y - size, size, font, color });
      y -= lh;
    }
    y -= gapAfter;
  };

  write(doc.title, bold, 17, ink, 2);
  write(doc.subtitle, regular, 10, muted, 14);

  for (const s of doc.sections) {
    if (s.heading) {
      if (y - 40 < MARGIN) newPage();
      y -= 6;
      write(s.heading, bold, 11.5, ink, 4);
    }
    for (const p of s.paragraphs) write(p, regular, 10, ink, 6);
  }

  // Rodapé com numeração
  const pages = pdf.getPages();
  pages.forEach((pg: { drawText: (t: string, o: unknown) => void }, i: number) => {
    pg.drawText(sanitize(`NOX4 · Contrato de Licença de Uso · página ${i + 1} de ${pages.length}`), {
      x: MARGIN,
      y: 28,
      size: 8,
      font: regular,
      color: muted,
    });
  });

  return await pdf.save();
}
