// Modelo único do Contrato de Licença de Uso do NOX4.
//
// Usado por:
//  - supabase/functions/generate-contract (PDF personalizado enviado ao cliente)
//  - scripts/generate-contract-docs.ts (página pública /contrato.html e docs/contrato-licenca-nox4.md)
//
// TypeScript puro, sem dependências: roda no Deno (Edge Functions), no Node e nos testes (vitest).
// Ao mudar o texto, suba CONTRACT_VERSION e rode `npx tsx scripts/generate-contract-docs.ts`.

export const CONTRACT_VERSION = '1.0';
export const CONTRACT_DATE = '23 de novembro de 2026';

/** Dados da CONTRATADA (Receita Federal, consulta em 23/11/2026) */
export const CONTRATADA = {
  razaoSocial: 'NOX4 ASSESSORIA E CONSULTORIA MARKETING LTDA',
  cnpj: '67.262.346/0001-39',
  endereco: 'Rua Doutor Gregório Costa, 237, Sala 806, Centro, Pindamonhangaba/SP, CEP 12400-430',
  telefone: '(12) 3550-2204',
  foro: 'Pindamonhangaba/SP',
};

export interface ContractCustomer {
  /** Razão social ou nome completo */
  name: string;
  /** CPF ou CNPJ, com ou sem máscara */
  document: string;
  email: string;
  phone?: string | null;
  /** Endereço completo (preenchido a partir do CNPJ quando disponível) */
  address?: string | null;
}

export interface ContractPurchase {
  planName: string;
  cycle: 'monthly' | 'yearly';
  /** Preço cheio por ciclo (mês ou ano) */
  regularPrice: number;
  maxCompanies: number;
  includedUsers: number;
  extraUserPrice: number;
  extraCompanyPrice?: number | null;
  promo?: { label: string; price: number; cycles: number } | null;
}

export interface ContractAcceptance {
  /** ISO 8601 */
  acceptedAt: string;
  ip?: string | null;
  /** Identificador da assinatura / pedido */
  reference?: string | null;
}

export interface ContractInput {
  customer?: ContractCustomer | null;
  purchase?: ContractPurchase | null;
  acceptance?: ContractAcceptance | null;
}

export interface ContractSection {
  heading?: string;
  paragraphs: string[];
}

export interface ContractDocument {
  title: string;
  subtitle: string;
  sections: ContractSection[];
}

export const formatBRL = (v: number) =>
  'R$ ' +
  v
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function formatDocument(doc: string): string {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

const formatDateTimeBR = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' }) + ' (horário de Brasília)';
};

export function buildContract(input: ContractInput = {}): ContractDocument {
  const { customer, purchase, acceptance } = input;
  const c = CONTRATADA;
  const sections: ContractSection[] = [];

  // Partes
  const contratante = customer
    ? `${customer.name}, inscrita no ${customer.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'} sob o nº ${formatDocument(customer.document)}` +
      (customer.address ? `, com endereço em ${customer.address}` : '') +
      `, e-mail ${customer.email}` +
      (customer.phone ? `, telefone ${customer.phone}` : '') +
      ', doravante "CONTRATANTE".'
    : 'a pessoa jurídica ou física identificada pelos dados informados no cadastro e no checkout do NOX4 (razão social ou nome, CNPJ ou CPF, endereço e e-mail de cobrança), doravante "CONTRATANTE".';

  sections.push({
    heading: 'Partes',
    paragraphs: [
      `CONTRATADA: ${c.razaoSocial}, inscrita no CNPJ sob o nº ${c.cnpj}, com sede na ${c.endereco}, telefone ${c.telefone}, titular da plataforma NOX4, doravante "CONTRATADA".`,
      `CONTRATANTE: ${contratante}`,
      'O aceite eletrônico no checkout, registrado com data, hora, endereço IP, e-mail e versão deste contrato, tem a mesma validade da assinatura física, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001.',
    ],
  });

  // Quadro resumo (só no contrato personalizado)
  if (purchase) {
    const ciclo = purchase.cycle === 'yearly' ? 'Anual' : 'Mensal';
    const unidade = purchase.cycle === 'yearly' ? 'por ano' : 'por mês';
    const linhas = [
      `Plano contratado: ${purchase.planName}, ciclo ${ciclo}.`,
      `Inclui: ${purchase.maxCompanies} ${purchase.maxCompanies === 1 ? 'empresa' : 'empresas'} e ${purchase.includedUsers} ${purchase.includedUsers === 1 ? 'usuário' : 'usuários'}.`,
    ];
    if (purchase.promo) {
      const periodo =
        purchase.cycle === 'yearly'
          ? purchase.promo.cycles === 1
            ? 'no primeiro ano'
            : `nos ${purchase.promo.cycles} primeiros anos`
          : `nos ${purchase.promo.cycles} primeiros meses`;
      linhas.push(
        `Valor promocional (${purchase.promo.label}): ${formatBRL(purchase.promo.price)} ${unidade} ${periodo}. Depois desse período, ${formatBRL(purchase.regularPrice)} ${unidade}, conforme a cláusula 2.`
      );
    } else {
      linhas.push(`Valor: ${formatBRL(purchase.regularPrice)} ${unidade}.`);
    }
    linhas.push(
      `Usuário adicional: ${formatBRL(purchase.extraUserPrice)} por mês.` +
        (purchase.extraCompanyPrice ? ` Empresa adicional: ${formatBRL(purchase.extraCompanyPrice)} por mês.` : '')
    );
    sections.push({ heading: 'Quadro resumo da contratação', paragraphs: linhas });
  }

  sections.push(
    {
      heading: '1. Objeto',
      paragraphs: [
        '1.1. Este contrato concede à CONTRATANTE uma licença de uso, não exclusiva, intransferível e temporária, do software NOX4, plataforma online de gestão financeira (DRE gerencial, fluxo de caixa, contas a pagar e a receber, orçamento, centros de resultado, indicadores e funcionalidades correlatas), acessada pela internet no modelo de software como serviço (SaaS).',
        '1.2. A licença não transfere a propriedade do software, do código-fonte, da marca ou de qualquer direito de propriedade intelectual da CONTRATADA.',
        '1.3. O NOX4 é uma ferramenta de gestão. Ele não substitui a contabilidade, a escrituração fiscal nem o trabalho de contador, e não emite documentos fiscais.',
      ],
    },
    {
      heading: '2. Planos, limites e preço',
      paragraphs: [
        '2.1. A CONTRATANTE escolhe no checkout um dos planos vigentes e o ciclo de pagamento (mensal ou anual). Cada plano define o número de empresas (CNPJs) e de usuários incluídos.',
        '2.2. Usuários e empresas acima do limite do plano são cobrados à parte, pelos valores do quadro resumo ou, na falta dele, pelos valores da página de planos no momento da inclusão.',
        '2.3. O preço, o ciclo, as condições promocionais e o valor que passa a vigorar ao fim da promoção são os do quadro resumo, exibidos no checkout e enviados à CONTRATANTE por e-mail junto com este contrato.',
        '2.4. Os preços podem ser reajustados uma vez a cada 12 meses pelo IPCA/IBGE acumulado no período, ou por outro índice que o substitua, com aviso por e-mail com no mínimo 30 dias de antecedência.',
      ],
    },
    {
      heading: '3. Pagamento',
      paragraphs: [
        '3.1. Os pagamentos são processados pelo Asaas Gestão Financeira Instituição de Pagamento S.A., por Pix, boleto ou cartão de crédito. A CONTRATADA não armazena dados completos de cartão.',
        '3.2. No ciclo mensal, a cobrança é recorrente a cada mês. No ciclo anual, a cobrança é feita uma vez por ano, no valor total do período.',
        '3.3. Em caso de atraso superior a 10 (dez) dias, a CONTRATADA pode suspender o acesso até a regularização, após aviso por e-mail. Os dados da CONTRATANTE não são apagados durante a suspensão.',
      ],
    },
    {
      heading: '4. Vigência, renovação e cancelamento',
      paragraphs: [
        '4.1. O contrato vigora pelo ciclo contratado (mensal ou anual) e se renova automaticamente por períodos iguais, salvo cancelamento.',
        '4.2. A CONTRATANTE pode cancelar a renovação a qualquer momento pela área Plano e Cobrança do sistema ou pelos canais de atendimento da CONTRATADA. O acesso continua até o fim do ciclo já pago.',
        '4.3. Direito de arrependimento: a CONTRATANTE pode desistir em até 7 (sete) dias corridos da primeira contratação, com devolução integral do valor pago.',
        '4.4. Após o prazo do item 4.3, não há devolução proporcional de ciclos já iniciados, salvo falha da CONTRATADA que impeça o uso do sistema por mais de 5 (cinco) dias úteis consecutivos.',
      ],
    },
    {
      heading: '5. Obrigações da CONTRATADA',
      paragraphs: [
        '5.1. Manter o NOX4 disponível pela internet, empregando esforços comercialmente razoáveis para evitar interrupções, ressalvadas manutenções programadas (avisadas com antecedência sempre que possível), falhas de terceiros (provedores de nuvem, internet, meios de pagamento) e casos fortuitos ou de força maior.',
        '5.2. Manter cópias de segurança (backup) periódicas dos dados.',
        '5.3. Prestar suporte pelos canais de atendimento informados no sistema e no site, em dias úteis e horário comercial (horário de Brasília).',
        '5.4. Corrigir falhas do software reportadas pela CONTRATANTE em prazo razoável, conforme a gravidade.',
      ],
    },
    {
      heading: '6. Obrigações da CONTRATANTE',
      paragraphs: [
        '6.1. Manter seus dados cadastrais e de cobrança atualizados.',
        '6.2. Guardar o sigilo de logins e senhas e responder pelos acessos feitos com suas credenciais e pelos usuários que convidar.',
        '6.3. Inserir no sistema apenas dados que tenha o direito de tratar, e responder pela exatidão dos lançamentos.',
        '6.4. Não copiar, revender, sublicenciar, fazer engenharia reversa ou usar o NOX4 para fins ilícitos.',
      ],
    },
    {
      heading: '7. Dados e LGPD',
      paragraphs: [
        '7.1. A CONTRATANTE é a controladora dos dados que insere no NOX4. A CONTRATADA atua como operadora, tratando esses dados apenas para prestar o serviço, nos termos da Lei nº 13.709/2018 (LGPD).',
        '7.2. Os dados de cada empresa ficam isolados e acessíveis apenas aos usuários vinculados a ela.',
        '7.3. A CONTRATADA pode usar subcontratados para hospedagem, banco de dados, envio de e-mail e pagamentos (como Supabase, Vercel, Resend e Asaas), que seguem obrigações de proteção de dados compatíveis com a LGPD.',
        '7.4. Ao fim do contrato, a CONTRATANTE pode exportar seus dados por até 30 dias. Depois desse prazo, a CONTRATADA pode excluí-los, salvo obrigação legal de guarda.',
        '7.5. Incidentes de segurança que possam gerar risco ou dano relevante serão comunicados à CONTRATANTE em prazo razoável.',
      ],
    },
    {
      heading: '8. Limitação de responsabilidade',
      paragraphs: [
        '8.1. Os relatórios e indicadores do NOX4 são calculados a partir dos dados inseridos pela CONTRATANTE. As decisões de negócio tomadas com base neles são de responsabilidade da CONTRATANTE.',
        '8.2. A responsabilidade total da CONTRATADA por danos diretos decorrentes deste contrato fica limitada ao valor pago pela CONTRATANTE nos 12 meses anteriores ao evento. A CONTRATADA não responde por lucros cessantes ou danos indiretos, salvo dolo ou culpa grave.',
      ],
    },
    {
      heading: '9. Alterações',
      paragraphs: [
        '9.1. A CONTRATADA pode atualizar este contrato. Alterações relevantes serão avisadas por e-mail com no mínimo 30 dias de antecedência. Se não concordar, a CONTRATANTE pode cancelar sem multa antes da entrada em vigor.',
      ],
    },
    {
      heading: '10. Disposições gerais',
      paragraphs: [
        '10.1. Comunicações entre as partes são feitas por e-mail, nos endereços cadastrados.',
        '10.2. A tolerância a qualquer descumprimento não significa renúncia de direito.',
        `10.3. Fica eleito o foro da comarca de ${c.foro} para dirimir questões deste contrato, com renúncia a qualquer outro, ressalvado o foro do domicílio da CONTRATANTE quando ela for consumidora.`,
      ],
    }
  );

  if (acceptance) {
    sections.push({
      heading: 'Registro do aceite eletrônico',
      paragraphs: [
        `Aceito por ${customer?.name || 'CONTRATANTE'} (${customer?.email || ''}) em ${formatDateTimeBR(acceptance.acceptedAt)}` +
          (acceptance.ip ? `, a partir do IP ${acceptance.ip}` : '') +
          `, versão ${CONTRACT_VERSION} deste contrato.` +
          (acceptance.reference ? ` Referência da assinatura: ${acceptance.reference}.` : ''),
      ],
    });
  }

  return {
    title: 'Contrato de Licença de Uso do Software NOX4',
    subtitle: `Versão ${CONTRACT_VERSION}, de ${CONTRACT_DATE}`,
    sections,
  };
}

/** Texto em Markdown (docs e Google Docs) */
export function contractToMarkdown(doc: ContractDocument): string {
  const out = [`# ${doc.title}`, '', `**${doc.subtitle}**`, ''];
  for (const s of doc.sections) {
    if (s.heading) out.push(`## ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
  }
  return out.join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

/** Corpo HTML (página pública e e-mail) */
export function contractToHtmlBody(doc: ContractDocument): string {
  const out = [`<h1>${esc(doc.title)}</h1>`, `<p><strong>${esc(doc.subtitle)}</strong></p>`];
  for (const s of doc.sections) {
    if (s.heading) out.push(`<h2>${esc(s.heading)}</h2>`);
    for (const p of s.paragraphs) out.push(`<p>${esc(p)}</p>`);
  }
  return out.join('\n');
}
