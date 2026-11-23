import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  buildContract,
  contractToMarkdown,
  CONTRATADA,
  formatDocument,
} from '../../../supabase/functions/_shared/contractTemplate';
import { renderContractPdf } from '../../../supabase/functions/_shared/contractPdf';

const customer = {
  name: 'Padaria Exemplo LTDA',
  document: '12345678000190',
  email: 'financeiro@padaria.com.br',
  phone: '(12) 99999-0000',
  address: 'Rua das Flores, 10, Centro, Taubaté/SP, CEP 12000-000',
};

const purchase = {
  planName: 'NOX4 Profissional',
  cycle: 'yearly' as const,
  regularPrice: 2490,
  maxCompanies: 1,
  includedUsers: 5,
  extraUserPrice: 29.9,
  extraCompanyPrice: 99,
  promo: { label: 'Black Friday', price: 1494, cycles: 1 },
};

describe('contrato NOX4', () => {
  it('modelo público traz a contratada e nenhum campo em branco', () => {
    const md = contractToMarkdown(buildContract());
    expect(md).toContain(CONTRATADA.razaoSocial);
    expect(md).toContain('67.262.346/0001-39');
    expect(md).toContain('Pindamonhangaba/SP');
    expect(md).not.toMatch(/\[[A-ZÇÃÉ /]+\]/);
    expect(md).not.toContain('Quadro resumo');
  });

  it('contrato personalizado traz cliente, plano, promoção e aceite', () => {
    const md = contractToMarkdown(
      buildContract({
        customer,
        purchase,
        acceptance: { acceptedAt: '2026-11-27T13:30:00Z', ip: '200.1.2.3', reference: 'sub_1' },
      })
    );
    expect(md).toContain('Padaria Exemplo LTDA, inscrita no CNPJ sob o nº 12.345.678/0001-90');
    expect(md).toContain('Taubaté/SP');
    expect(md).toContain('NOX4 Profissional, ciclo Anual');
    expect(md).toContain('R$ 1.494,00 por ano no primeiro ano');
    expect(md).toContain('R$ 2.490,00 por ano');
    expect(md).toContain('IP 200.1.2.3');
    expect(md).toContain('27 de novembro de 2026');
  });

  it('identifica CPF', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01');
    const md = contractToMarkdown(buildContract({ customer: { ...customer, document: '12345678901', address: null } }));
    expect(md).toContain('inscrita no CPF sob o nº 123.456.789-01');
  });

  it('gera um PDF válido', async () => {
    const doc = buildContract({ customer, purchase, acceptance: { acceptedAt: '2026-11-27T13:30:00Z' } });
    const bytes = await renderContractPdf(doc, { PDFDocument, StandardFonts, rgb });
    expect(bytes.length).toBeGreaterThan(3000);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
