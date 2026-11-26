/** Formas de pagamento das despesas (valor gravado no banco → rótulo em português). */
export const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'wire_transfer', label: 'Transferência / TED' },
  { value: 'debit_auto', label: 'Débito automático' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outra' },
];

/** Valor usado nos filtros para lançamentos antigos, sem forma de pagamento. */
export const PAYMENT_METHOD_NONE = '__none__';

export function getPaymentMethodLabel(value?: string | null): string {
  if (!value) return 'Não informada';
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label || value;
}
