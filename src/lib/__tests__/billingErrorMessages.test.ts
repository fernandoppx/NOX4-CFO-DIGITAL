import { describe, it, expect } from 'vitest';
import {
  formatBillingErrorMessage,
  formatNullableBillingText,
  BillingAction,
} from '../billingErrorMessages';

describe('formatBillingErrorMessage - UX Sanitization', () => {
  it('1. Sanitiza erro de webhook sem vazar termos técnicos', () => {
    const error = new Error('Webhook failed: invalid signature from Asaas gateway');
    const result = formatBillingErrorMessage(error, 'payment');
    expect(result).toBe('Não foi possível atualizar sua assinatura. Nossa equipe será notificada.');
    expect(result).not.toContain('Webhook');
    expect(result).not.toContain('Asaas');
    expect(result).not.toContain('failed');
  });

  it('2. Sanitiza falha na criação de pagamento no Asaas', () => {
    const error = { message: 'Payment creation failed on Asaas provider' };
    const result = formatBillingErrorMessage(error, 'payment');
    expect(result).toBe('Não foi possível gerar a cobrança. Tente novamente.');
    expect(result).not.toContain('Payment creation');
    expect(result).not.toContain('Asaas');
    expect(result).not.toContain('failed');
  });

  it('3. Sanitiza permission denied e RLS (Row-Level Security)', () => {
    const error = new Error('permission denied for table organization_subscriptions');
    const result = formatBillingErrorMessage(error, 'upgrade');
    expect(result).toBe('Você não possui permissão para esta ação.');
    expect(result).not.toContain('permission denied');
    expect(result).not.toContain('organization_subscriptions');

    const rlsError = { message: 'new row violates row-level security policy for table plans' };
    const rlsResult = formatBillingErrorMessage(rlsError, 'downgrade');
    expect(rlsResult).toBe('Você não possui permissão para esta ação.');
    expect(rlsResult).not.toContain('row-level security');
  });

  it('4. Sanitiza erros de constraint e duplicate key', () => {
    const error = { message: 'duplicate key value violates unique constraint "subscriptions_org_id_key"' };
    const result = formatBillingErrorMessage(error, 'checkout');
    expect(result).toBe('Já existe uma solicitação ou assinatura ativa para esta organização.');
    expect(result).not.toContain('duplicate key');
    expect(result).not.toContain('constraint');
  });

  it('5. Sanitiza erro de RPC do Supabase', () => {
    const error = new Error('Could not find the function public.process_asaas_event in schema cache or RPC execution error');
    const result = formatBillingErrorMessage(error, 'sync');
    expect(result).toBe('Instabilidade temporária nos serviços de cobrança. Tente novamente em instantes.');
    expect(result).not.toContain('RPC');
    expect(result).not.toContain('schema cache');
  });

  it('6. Trata entradas vazias ou objetos vazios graciosamente', () => {
    const resultNull = formatBillingErrorMessage(null, 'cancel_subscription');
    expect(resultNull).toBe('Não foi possível processar o cancelamento da assinatura. Tente novamente ou contate o suporte.');
    expect(resultNull).not.toContain('null');

    const resultUndefined = formatBillingErrorMessage(undefined, 'reactivate_subscription');
    expect(resultUndefined).toBe('Não foi possível reativar sua assinatura. Tente novamente ou contate o suporte.');
    expect(resultUndefined).not.toContain('undefined');
  });

  it('7. Tratamento de cancelamento de assinatura', () => {
    const error = new Error('Cancel subscription failed on provider');
    const result = formatBillingErrorMessage(error, 'cancel_subscription');
    expect(result).toBe('Não foi possível processar o cancelamento da assinatura. Tente novamente ou contate o suporte.');
    expect(result).not.toContain('provider');
    expect(result).not.toContain('failed');
  });

  it('8. Tratamento de reativação de assinatura', () => {
    const error = new Error('Reactivate subscription error code 400');
    const result = formatBillingErrorMessage(error, 'reactivate_subscription');
    expect(result).toBe('Não foi possível reativar sua assinatura. Tente novamente ou contate o suporte.');
    expect(result).not.toContain('error code');
  });

  it('9. Tratamento de alteração de assentos/quantidade de membros', () => {
    const errorLimit = new Error('Max members limit reached for this tier');
    const resultLimit = formatBillingErrorMessage(errorLimit, 'change_users');
    expect(resultLimit).toBe('O limite de membros permitidos pelo seu plano foi atingido. Realize um upgrade para adicionar mais licenças.');

    const errorGeneric = new Error('Failed to update seat count');
    const resultGeneric = formatBillingErrorMessage(errorGeneric, 'change_users');
    expect(resultGeneric).toBe('Não foi possível atualizar a quantidade de membros da organização. Tente novamente.');
  });

  it('10. Tratamento de upgrade e downgrade', () => {
    const upError = new Error('Plan change failed on checkout server');
    const upResult = formatBillingErrorMessage(upError, 'upgrade');
    expect(upResult).toBe('Não foi possível concluir a alteração de plano. Verifique a forma de pagamento e tente novamente.');

    const downError = new Error('Organization has too many members for this plan');
    const downResult = formatBillingErrorMessage(downError, 'downgrade');
    expect(downResult).toBe('A organização possui mais membros ativos do que o permitido no novo plano. Reduza o número de membros antes de mudar de plano.');
  });

  it('11. Tratamento de cartão recusado e dados inválidos', () => {
    const cardDeclined = { message: 'Transação não autorizada / card declined' };
    const result = formatBillingErrorMessage(cardDeclined, 'payment');
    expect(result).toBe('Transação não autorizada pela emissora do cartão. Verifique o limite disponível ou tente outro cartão.');

    const expiredError = { message: 'expired card date' };
    expect(formatBillingErrorMessage(expiredError, 'payment')).toBe('O cartão informado está vencido. Por favor, utilize um cartão válido.');

    const cvvError = { message: 'invalid ccv format' };
    expect(formatBillingErrorMessage(cvvError, 'payment')).toBe('Código de segurança (CVV) incorreto. Verifique os números no verso do cartão.');
  });

  it('12. Tratamento de falhas de rede / timeout', () => {
    const netError = new Error('failed to fetch from billing server');
    const result = formatBillingErrorMessage(netError, 'load');
    expect(result).toBe('Falha de conexão com os serviços de faturamento. Verifique sua internet e tente novamente.');
  });

  it('13. Sanitização de textos nulos ou indefinidos em campos de faturamento', () => {
    expect(formatNullableBillingText(null)).toBe('Não informado');
    expect(formatNullableBillingText(undefined)).toBe('Não informado');
    expect(formatNullableBillingText('null')).toBe('Não informado');
    expect(formatNullableBillingText('undefined')).toBe('Não informado');
    expect(formatNullableBillingText('   ')).toBe('Não informado');
    expect(formatNullableBillingText('Plano Profissional')).toBe('Plano Profissional');
    expect(formatNullableBillingText(150)).toBe('150');
  });
});
