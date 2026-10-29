import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, Loader2 } from 'lucide-react';
import { Client, Product, CostCenter, Category, Revenue, Expense, TransactionStatus } from '../../types';
import {
  formatCurrency,
  getTodayISO,
  addDaysISO,
  getGroupLabel,
  parseDecimalInput,
} from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';
import { useEscapeKey } from '../../lib/hooks';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  products: Product[];
  costCenters: CostCenter[];
  categories: Category[];
  currentCompanyId: string;
  selectedCompanyId?: string;
  initialType?: 'revenue' | 'expense';
  defaultStatus?: TransactionStatus | string;
  onAddRevenue: (rev: Omit<Revenue, 'id' | 'created_at'>) => Promise<boolean | void> | boolean | void;
  onAddExpense: (exp: Omit<Expense, 'id' | 'created_at'>) => Promise<boolean | void> | boolean | void;
  /** Leva o usuário ao Plano de Contas (Configurações) */
  onManageCategories?: () => void;
}

const inputBase =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white';

const emptyRevForm = (today: string) => ({
  description: '',
  client_id: '',
  product_id: '',
  cost_center_id: '',
  category_id: '',
  gross_amount: '',
  tax_percent: '',
  commission_percent: '',
  other_deductions: '',
  competence_date: today,
  due_date: addDaysISO(today, 15),
  received_date: today,
  status: 'received' as TransactionStatus,
  notes: '',
});

const emptyExpForm = (today: string) => ({
  description: '',
  supplier: '',
  category_id: '',
  cost_center_id: '',
  amount: '',
  cost_nature: 'FIXED' as 'FIXED' | 'VARIABLE',
  competence_date: today,
  due_date: addDaysISO(today, 15),
  paid_date: today,
  status: 'paid' as TransactionStatus,
  is_equity_movement: false,
  notes: '',
});

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  clients,
  products,
  costCenters,
  categories,
  currentCompanyId,
  selectedCompanyId,
  initialType = 'revenue',
  defaultStatus,
  onAddRevenue,
  onAddExpense,
  onManageCategories,
}) => {
  const activeCompanyId = selectedCompanyId || currentCompanyId;
  const today = getTodayISO();
  const [transactionType, setTransactionType] = useState<'revenue' | 'expense'>('revenue');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [revForm, setRevForm] = useState(() => emptyRevForm(today));
  const [expForm, setExpForm] = useState(() => emptyExpForm(today));

  const revCategories = useMemo(
    () => categories.filter((c) => (c.type === 'REVENUE' || c.group === 'revenue') && c.active !== false),
    [categories]
  );
  const expCategories = useMemo(
    () => categories.filter((c) => c.type !== 'REVENUE' && c.group !== 'revenue' && c.active !== false),
    [categories]
  );
  const activeCostCenters = useMemo(() => costCenters.filter((c) => c.active !== false), [costCenters]);

  const handleClose = useCallback(() => {
    if (!isSaving) onClose();
  }, [isSaving, onClose]);
  useEscapeKey(isOpen, handleClose);

  // Ao abrir: limpa o formulário, aplica tipo/status e escolhe os padrões disponíveis
  useEffect(() => {
    if (!isOpen) return;
    const t = getTodayISO();
    const normalized = defaultStatus ? normalizeTransactionStatus(defaultStatus) : undefined;
    setTransactionType(initialType || 'revenue');
    setRevForm({
      ...emptyRevForm(t),
      status: normalized ? (normalized === 'paid' ? 'received' : normalized) : 'received',
    });
    setExpForm({
      ...emptyExpForm(t),
      status: normalized ? (normalized === 'received' ? 'paid' : normalized) : 'paid',
    });
    setErrorMessage(null);
    setIsSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialType, defaultStatus]);

  // Preenche categoria e centro padrão assim que as listas estiverem carregadas
  useEffect(() => {
    if (!isOpen) return;
    setRevForm((prev) => ({
      ...prev,
      category_id: revCategories.some((c) => c.id === prev.category_id) ? prev.category_id : revCategories[0]?.id || '',
      cost_center_id: activeCostCenters.some((c) => c.id === prev.cost_center_id)
        ? prev.cost_center_id
        : activeCostCenters[0]?.id || '',
    }));
    setExpForm((prev) => {
      const nonEquity = expCategories.find((c) => c.group !== 'equity' && c.group !== 'deductions');
      return {
        ...prev,
        category_id: expCategories.some((c) => c.id === prev.category_id) ? prev.category_id : nonEquity?.id || expCategories[0]?.id || '',
        cost_center_id: activeCostCenters.some((c) => c.id === prev.cost_center_id)
          ? prev.cost_center_id
          : activeCostCenters[0]?.id || '',
      };
    });
  }, [isOpen, revCategories, expCategories, activeCostCenters]);

  if (!isOpen) return null;

  // Apuração da receita
  const gross = parseDecimalInput(revForm.gross_amount);
  const taxPct = parseDecimalInput(revForm.tax_percent);
  const commPct = parseDecimalInput(revForm.commission_percent);
  const otherDed = parseDecimalInput(revForm.other_deductions);
  const taxAmount = Math.round(gross * taxPct) / 100;
  const commissionAmount = Math.round(gross * commPct) / 100;
  const totalDeductions = taxAmount + commissionAmount + otherDed;
  const netAmount = gross - totalDeductions;
  const pctOutOfRange = (v: number) => v < 0 || v > 100;

  const handleRevenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!revForm.description.trim()) return setErrorMessage('Informe a descrição da receita.');
    if (gross <= 0) return setErrorMessage('O faturamento bruto deve ser maior que zero.');
    if (pctOutOfRange(taxPct) || pctOutOfRange(commPct))
      return setErrorMessage('Imposto e comissão precisam estar entre 0% e 100%.');
    if (otherDed < 0) return setErrorMessage('Outras deduções não podem ser negativas.');
    if (netAmount < 0)
      return setErrorMessage(
        `As deduções (${formatCurrency(totalDeductions)}) são maiores que o faturamento (${formatCurrency(gross)}). Confira os valores.`
      );
    const category = revCategories.find((c) => c.id === revForm.category_id);
    if (!category) return setErrorMessage('Escolha uma categoria de receita.');

    const normStatus = normalizeTransactionStatus(revForm.status);
    const receivedDate = normStatus === 'received' ? revForm.received_date || revForm.competence_date || today : undefined;

    setIsSaving(true);
    try {
      const ok = await onAddRevenue({
        company_id: activeCompanyId,
        description: revForm.description.trim(),
        client_id: revForm.client_id || undefined,
        product_id: revForm.product_id || undefined,
        cost_center_id: revForm.cost_center_id || undefined,
        category_id: category.id,
        gross_amount: gross,
        tax_amount: taxAmount,
        commission_amount: commissionAmount,
        other_deductions: otherDed,
        net_amount: netAmount,
        competence_date: revForm.competence_date,
        due_date: revForm.due_date || revForm.competence_date,
        received_date: receivedDate,
        payment_date: receivedDate,
        status: normStatus,
        notes: revForm.notes,
      });
      if (ok === false) {
        setErrorMessage('Não foi possível salvar a receita. Confira os dados e tente de novo.');
        return;
      }
      onClose();
    } catch (err) {
      setErrorMessage(formatFinancialErrorMessage(err, 'create', 'revenue'));
    } finally {
      setIsSaving(false);
    }
  };

  const expAmount = parseDecimalInput(expForm.amount);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!expForm.description.trim()) return setErrorMessage('Informe a descrição da despesa.');
    if (expAmount <= 0) return setErrorMessage('O valor da despesa deve ser maior que zero.');
    const category = expCategories.find((c) => c.id === expForm.category_id);
    if (!category) return setErrorMessage('Escolha uma categoria de despesa.');

    const normStatus = normalizeTransactionStatus(expForm.status);
    const paidDate = normStatus === 'paid' ? expForm.paid_date || expForm.competence_date || today : undefined;

    setIsSaving(true);
    try {
      const ok = await onAddExpense({
        company_id: activeCompanyId,
        description: expForm.description.trim(),
        supplier: expForm.supplier.trim(),
        category_id: category.id,
        cost_center_id: expForm.cost_center_id || undefined,
        amount: expAmount,
        cost_nature: expForm.cost_nature,
        competence_date: expForm.competence_date,
        due_date: expForm.due_date || expForm.competence_date,
        paid_date: paidDate,
        payment_date: paidDate,
        status: normStatus,
        is_equity_movement: expForm.is_equity_movement || category.group === 'equity',
        notes: expForm.notes,
      });
      if (ok === false) {
        setErrorMessage('Não foi possível salvar a despesa. Confira os dados e tente de novo.');
        return;
      }
      onClose();
    } catch (err) {
      setErrorMessage(formatFinancialErrorMessage(err, 'create', 'expense'));
    } finally {
      setIsSaving(false);
    }
  };

  // Agrupa as categorias de despesa por grupo do DRE
  const expCategoryGroups = expCategories.reduce<Record<string, Category[]>>((acc, c) => {
    const g = String(c.group || 'operational');
    (acc[g] = acc[g] || []).push(c);
    return acc;
  }, {});

  const noCategories = transactionType === 'revenue' ? revCategories.length === 0 : expCategories.length === 0;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-transaction-title"
    >
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                transactionType === 'revenue'
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}
            >
              {transactionType === 'revenue' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="new-transaction-title" className="text-base font-bold text-slate-800 font-heading">
                Novo Lançamento Financeiro
              </h3>
              <p className="text-xs text-slate-500">Entra na DRE e no Fluxo de Caixa assim que for salvo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receita x Despesa */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {(['revenue', 'expense'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTransactionType(t);
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold font-heading rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                transactionType === t
                  ? t === 'revenue'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t === 'revenue' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{t === 'revenue' ? '(+) Nova Receita' : '(-) Nova Despesa'}</span>
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {noCategories && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Nenhuma categoria de {transactionType === 'revenue' ? 'receita' : 'despesa'} ativa no plano de contas.{' '}
              {onManageCategories && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageCategories();
                  }}
                  className="underline font-semibold"
                >
                  Abrir o Plano de Contas
                </button>
              )}
            </span>
          </div>
        )}

        {transactionType === 'revenue' ? (
          <form onSubmit={handleRevenueSubmit} className="space-y-4 text-xs" noValidate>
            <div>
              <label htmlFor="rev-desc" className="block text-slate-700 font-semibold mb-1">Descrição da Receita *</label>
              <input
                id="rev-desc"
                type="text"
                required
                autoFocus
                placeholder="Ex: Mensalidade consultoria - cliente X"
                value={revForm.description}
                onChange={(e) => setRevForm({ ...revForm, description: e.target.value })}
                className={`${inputBase} focus:border-blue-500`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cliente</label>
                <select
                  value={revForm.client_id}
                  onChange={(e) => setRevForm({ ...revForm, client_id: e.target.value })}
                  className={`${inputBase} cursor-pointer`}
                >
                  <option value="">Cliente avulso</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Produto / Serviço</label>
                <select
                  value={revForm.product_id}
                  onChange={(e) => setRevForm({ ...revForm, product_id: e.target.value })}
                  className={`${inputBase} cursor-pointer`}
                >
                  <option value="">Serviço avulso</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria (Plano de Contas) *</label>
                <select
                  value={revForm.category_id}
                  onChange={(e) => setRevForm({ ...revForm, category_id: e.target.value })}
                  className={`${inputBase} cursor-pointer`}
                  disabled={revCategories.length === 0}
                >
                  {revCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Centro de Resultado</label>
                <select
                  value={revForm.cost_center_id}
                  onChange={(e) => setRevForm({ ...revForm, cost_center_id: e.target.value })}
                  className={`${inputBase} cursor-pointer`}
                >
                  <option value="">Sem centro de resultado</option>
                  {activeCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                      {cc.code ? ` (${cc.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="rev-gross" className="block text-slate-600 font-semibold mb-1">Faturamento bruto (R$) *</label>
                  <input
                    id="rev-gross"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5.000,00"
                    value={revForm.gross_amount}
                    onChange={(e) => setRevForm({ ...revForm, gross_amount: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="rev-tax" className="block text-slate-600 font-semibold mb-1">Imposto (%)</label>
                  <input
                    id="rev-tax"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 6"
                    value={revForm.tax_percent}
                    onChange={(e) => setRevForm({ ...revForm, tax_percent: e.target.value })}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500 ${
                      pctOutOfRange(taxPct) ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="rev-comm" className="block text-slate-600 font-semibold mb-1">Comissão (%)</label>
                  <input
                    id="rev-comm"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5"
                    value={revForm.commission_percent}
                    onChange={(e) => setRevForm({ ...revForm, commission_percent: e.target.value })}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500 ${
                      pctOutOfRange(commPct) ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rev-other" className="block text-slate-600 font-semibold mb-1">Outras deduções diretas (R$)</label>
                <input
                  id="rev-other"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 0,00"
                  value={revForm.other_deductions}
                  onChange={(e) => setRevForm({ ...revForm, other_deductions: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs gap-2">
                <span className="text-slate-500">Deduções: {formatCurrency(totalDeductions)}</span>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Receita líquida na DRE</span>
                  <span className={`font-mono font-bold text-sm ${netAmount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(netAmount)}
                  </span>
                </div>
              </div>
              {netAmount < 0 && (
                <p className="text-[11px] text-rose-600 font-medium">
                  As deduções passam do faturamento. Corrija antes de salvar.
                </p>
              )}
            </div>

            <div className={`grid gap-2 grid-cols-2 ${revForm.status === 'received' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Competência (DRE)</label>
                <input
                  type="date"
                  required
                  value={revForm.competence_date}
                  onChange={(e) => setRevForm({ ...revForm, competence_date: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 focus:border-blue-500`}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vencimento</label>
                <input
                  type="date"
                  value={revForm.due_date}
                  onChange={(e) => setRevForm({ ...revForm, due_date: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 focus:border-blue-500`}
                />
              </div>
              {revForm.status === 'received' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Recebido em *</label>
                  <input
                    type="date"
                    required
                    value={revForm.received_date}
                    onChange={(e) => setRevForm({ ...revForm, received_date: e.target.value })}
                    className={`${inputBase} px-2.5 py-1.5 focus:border-blue-500`}
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={revForm.status}
                  onChange={(e) => setRevForm({ ...revForm, status: e.target.value as TransactionStatus })}
                  className={`${inputBase} px-2.5 py-1.5 cursor-pointer`}
                >
                  <option value="received">Recebido</option>
                  <option value="pending">A receber</option>
                  <option value="overdue">Atrasado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || revCategories.length === 0 || netAmount < 0}
                className="px-5 py-2 rounded-lg text-white font-bold font-heading shadow-xs transition-all bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Salvando...' : 'Salvar Receita'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs" noValidate>
            <div>
              <label htmlFor="exp-desc" className="block text-slate-700 font-semibold mb-1">Descrição da Despesa / Custo *</label>
              <input
                id="exp-desc"
                type="text"
                required
                autoFocus
                placeholder="Ex: Aluguel do escritório"
                value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                className={`${inputBase} focus:border-rose-500`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fornecedor / Credor</label>
                <input
                  type="text"
                  placeholder="Ex: Imobiliária, AWS, Meta Ads"
                  value={expForm.supplier}
                  onChange={(e) => setExpForm({ ...expForm, supplier: e.target.value })}
                  className={`${inputBase} focus:border-rose-500`}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria (Plano de Contas) *</label>
                <select
                  value={expForm.category_id}
                  onChange={(e) => {
                    const cat = expCategories.find((c) => c.id === e.target.value);
                    setExpForm({
                      ...expForm,
                      category_id: e.target.value,
                      is_equity_movement: cat?.group === 'equity' ? true : expForm.is_equity_movement && cat?.group === 'equity',
                    });
                  }}
                  className={`${inputBase} cursor-pointer`}
                  disabled={expCategories.length === 0}
                >
                  {Object.entries(expCategoryGroups).map(([group, cats]) => (
                    <optgroup key={group} label={getGroupLabel(group)}>
                      {cats.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label htmlFor="exp-amount" className="block text-slate-700 font-semibold mb-1">Valor (R$) *</label>
                <input
                  id="exp-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 1.200,00"
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 text-rose-600 font-mono font-bold focus:border-rose-500`}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Natureza do custo</label>
                <select
                  value={expForm.cost_nature}
                  onChange={(e) => setExpForm({ ...expForm, cost_nature: e.target.value as any })}
                  className={`${inputBase} px-2.5 py-1.5 cursor-pointer`}
                >
                  <option value="FIXED">Fixo</option>
                  <option value="VARIABLE">Variável</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Centro de Resultado</label>
                <select
                  value={expForm.cost_center_id}
                  onChange={(e) => setExpForm({ ...expForm, cost_center_id: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 cursor-pointer`}
                >
                  <option value="">Sem centro de resultado</option>
                  {activeCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expForm.is_equity_movement}
                  onChange={(e) => setExpForm({ ...expForm, is_equity_movement: e.target.checked })}
                  className="mt-0.5 rounded bg-white border-purple-300 text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="text-purple-800 font-bold block">Movimentação de sócios (fora da DRE operacional)</span>
                  <span className="text-[10px] text-slate-500 block">
                    Distribuição de lucros, retirada ou empréstimo de sócios. Sai do caixa, mas não entra como despesa na DRE.
                  </span>
                </div>
              </label>
            </div>

            <div className={`grid gap-2 grid-cols-2 ${expForm.status === 'paid' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Competência (DRE)</label>
                <input
                  type="date"
                  required
                  value={expForm.competence_date}
                  onChange={(e) => setExpForm({ ...expForm, competence_date: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 focus:border-rose-500`}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vencimento</label>
                <input
                  type="date"
                  value={expForm.due_date}
                  onChange={(e) => setExpForm({ ...expForm, due_date: e.target.value })}
                  className={`${inputBase} px-2.5 py-1.5 focus:border-rose-500`}
                />
              </div>
              {expForm.status === 'paid' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pago em *</label>
                  <input
                    type="date"
                    required
                    value={expForm.paid_date}
                    onChange={(e) => setExpForm({ ...expForm, paid_date: e.target.value })}
                    className={`${inputBase} px-2.5 py-1.5 focus:border-rose-500`}
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={expForm.status}
                  onChange={(e) => setExpForm({ ...expForm, status: e.target.value as TransactionStatus })}
                  className={`${inputBase} px-2.5 py-1.5 cursor-pointer`}
                >
                  <option value="paid">Pago</option>
                  <option value="pending">A pagar</option>
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || expCategories.length === 0}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold font-heading shadow-xs transition-all cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Salvando...' : 'Salvar Despesa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
