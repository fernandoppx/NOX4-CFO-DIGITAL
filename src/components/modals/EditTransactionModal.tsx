import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  Package,
  Layers,
  Check,
  Percent,
  DollarSign,
  Tag,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { Revenue, Expense, Client, Product, CostCenter, Category, TransactionStatus } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  revenue?: Revenue | null;
  expense?: Expense | null;
  clients: Client[];
  products: Product[];
  costCenters: CostCenter[];
  categories: Category[];
  currentCompanyId: string;
  onSaveRevenue?: (updatedRevenue: Revenue) => void;
  onSaveExpense?: (updatedExpense: Expense) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  revenue,
  expense,
  clients,
  products,
  costCenters,
  categories,
  currentCompanyId,
  onSaveRevenue,
  onSaveExpense,
}) => {
  const isRevenue = !!revenue;
  const isExpense = !!expense;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter categories strictly by type
  const revCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.type === 'REVENUE' ||
          c.group === 'revenue' ||
          c.id.startsWith('rc_') ||
          (c as any).type === 'services' ||
          (c as any).type === 'recurring' ||
          (c as any).type === 'non_recurring' ||
          (c as any).type === 'products' ||
          (c as any).type === 'financial' ||
          (c as any).type === 'other_operational'
      ),
    [categories]
  );

  const expCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.type !== 'REVENUE' &&
          c.group !== 'revenue' &&
          !c.id.startsWith('rc_') &&
          (c as any).type !== 'services' &&
          (c as any).type !== 'recurring' &&
          (c as any).type !== 'products'
      ),
    [categories]
  );

  const availableRevCategories = revCategories.length > 0 ? revCategories : categories;
  const availableExpCategories = expCategories.length > 0 ? expCategories : categories;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Revenue form state
  const [revForm, setRevForm] = useState({
    description: '',
    client_id: '',
    product_id: '',
    cost_center_id: '',
    category_id: '',
    gross_amount: 0,
    tax_percent: 6.0,
    commission_percent: 5.0,
    other_deductions: 0,
    competence_date: '',
    due_date: '',
    received_date: todayStr,
    status: 'received' as TransactionStatus,
    notes: '',
  });

  // Expense form state
  const [expForm, setExpForm] = useState({
    description: '',
    supplier: '',
    category_id: '',
    cost_center_id: '',
    amount: 0,
    cost_nature: 'FIXED' as 'FIXED' | 'VARIABLE',
    competence_date: '',
    due_date: '',
    paid_date: todayStr,
    status: 'paid' as TransactionStatus,
    is_equity_movement: false,
    notes: '',
  });

  useEffect(() => {
    if (revenue) {
      const gross = revenue.gross_amount || 0;
      const taxPct = gross > 0 ? (revenue.tax_amount / gross) * 100 : 6.0;
      const commPct = gross > 0 ? (revenue.commission_amount / gross) * 100 : 5.0;
      const normStatus = normalizeTransactionStatus(revenue.status);

      // ensure category exists in availableRevCategories or fallback to first available
      const existingCat = availableRevCategories.find((c) => c.id === revenue.category_id);
      const catId = existingCat ? existingCat.id : availableRevCategories[0]?.id || revenue.category_id;

      setRevForm({
        description: revenue.description || '',
        client_id: revenue.client_id || '',
        product_id: revenue.product_id || '',
        cost_center_id: revenue.cost_center_id || costCenters[0]?.id || '',
        category_id: catId,
        gross_amount: revenue.gross_amount || 0,
        tax_percent: Number(taxPct.toFixed(2)),
        commission_percent: Number(commPct.toFixed(2)),
        other_deductions: revenue.other_deductions || 0,
        competence_date: revenue.competence_date || '',
        due_date: revenue.due_date || '',
        received_date: revenue.received_date || revenue.payment_date || revenue.competence_date || todayStr,
        status: normStatus,
        notes: revenue.notes || '',
      });
    } else if (expense) {
      const normStatus = normalizeTransactionStatus(expense.status);

      // ensure category exists in availableExpCategories or fallback to first available
      const existingCat = availableExpCategories.find((c) => c.id === expense.category_id);
      const catId = existingCat ? existingCat.id : availableExpCategories[0]?.id || expense.category_id;

      setExpForm({
        description: expense.description || '',
        supplier: expense.supplier || '',
        category_id: catId,
        cost_center_id: expense.cost_center_id || costCenters[0]?.id || '',
        amount: expense.amount || 0,
        cost_nature: expense.cost_nature || 'FIXED',
        competence_date: expense.competence_date || '',
        due_date: expense.due_date || '',
        paid_date: expense.paid_date || expense.payment_date || expense.competence_date || todayStr,
        status: normStatus,
        is_equity_movement: !!expense.is_equity_movement,
        notes: expense.notes || '',
      });
    }
    setErrorMessage(null);
  }, [revenue, expense, isOpen, costCenters, availableRevCategories, availableExpCategories, todayStr]);

  if (!isOpen || (!revenue && !expense)) return null;

  // Revenue calculations - without Math.max
  const taxAmount = (revForm.gross_amount * revForm.tax_percent) / 100;
  const commissionAmount = (revForm.gross_amount * revForm.commission_percent) / 100;
  const netAmount = revForm.gross_amount - taxAmount - commissionAmount - revForm.other_deductions;

  const handleRevenueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!revenue || !onSaveRevenue) return;

    if (!revForm.description.trim()) {
      setErrorMessage('Por favor, informe a descrição da receita.');
      return;
    }

    if (revForm.gross_amount <= 0) {
      setErrorMessage('O valor da receita deve ser maior que zero.');
      return;
    }

    // Validate category
    const validCategory = availableRevCategories.find((c) => c.id === revForm.category_id) || availableRevCategories[0];
    const categoryId = validCategory ? validCategory.id : revForm.category_id;

    const normStatus = normalizeTransactionStatus(revForm.status);
    const effectiveReceivedDate =
      normStatus === 'received' ? (revForm.received_date || revForm.competence_date || todayStr) : undefined;

    const updatedRevenue: Revenue = {
      ...revenue,
      description: revForm.description.trim(),
      client_id: revForm.client_id || undefined,
      product_id: revForm.product_id || undefined,
      cost_center_id: revForm.cost_center_id,
      category_id: categoryId,
      gross_amount: revForm.gross_amount,
      tax_amount: taxAmount,
      commission_amount: commissionAmount,
      other_deductions: revForm.other_deductions,
      net_amount: netAmount,
      competence_date: revForm.competence_date,
      due_date: revForm.due_date,
      received_date: effectiveReceivedDate,
      payment_date: effectiveReceivedDate,
      status: normStatus,
      notes: revForm.notes,
    };

    try {
      onSaveRevenue(updatedRevenue);
      onClose();
    } catch (err) {
      setErrorMessage(formatFinancialErrorMessage(err, 'update', 'revenue'));
    }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!expense || !onSaveExpense) return;

    if (!expForm.description.trim()) {
      setErrorMessage('Por favor, informe a descrição da despesa.');
      return;
    }

    if (expForm.amount <= 0) {
      setErrorMessage('O valor da despesa deve ser maior que zero.');
      return;
    }

    // Validate category
    const validCategory = availableExpCategories.find((c) => c.id === expForm.category_id) || availableExpCategories[0];
    const categoryId = validCategory ? validCategory.id : expForm.category_id;

    const normStatus = normalizeTransactionStatus(expForm.status);
    const effectivePaidDate =
      normStatus === 'paid' ? (expForm.paid_date || expForm.competence_date || todayStr) : undefined;

    const updatedExpense: Expense = {
      ...expense,
      description: expForm.description.trim(),
      supplier: expForm.supplier.trim() || undefined,
      category_id: categoryId,
      cost_center_id: expForm.cost_center_id,
      amount: expForm.amount,
      cost_nature: expForm.cost_nature,
      competence_date: expForm.competence_date,
      due_date: expForm.due_date,
      paid_date: effectivePaidDate,
      payment_date: effectivePaidDate,
      status: normStatus,
      is_equity_movement: expForm.is_equity_movement,
      notes: expForm.notes,
    };

    try {
      onSaveExpense(updatedExpense);
      onClose();
    } catch (err) {
      setErrorMessage(formatFinancialErrorMessage(err, 'update', 'expense'));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isRevenue
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}
            >
              {isRevenue ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                {isRevenue ? 'Editar Receita / Título a Receber' : 'Editar Despesa / Conta a Pagar'}
              </h3>
              <p className="text-xs text-slate-500">
                Altere valores, vencimentos, centro de custo e alocação contábil
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Feedback Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* EDIT REVENUE FORM */}
        {isRevenue && (
          <form onSubmit={handleRevenueSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Descrição da Receita *</label>
              <input
                type="text"
                required
                value={revForm.description}
                onChange={(e) => setRevForm({ ...revForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cliente</label>
                <select
                  value={revForm.client_id}
                  onChange={(e) => setRevForm({ ...revForm, client_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">Cliente Avulso</option>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">Serviço Avulso</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Centro de Resultado *</label>
                <select
                  value={revForm.cost_center_id}
                  onChange={(e) => setRevForm({ ...revForm, cost_center_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name} ({cc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria DRE (Receitas) *</label>
                <select
                  value={revForm.category_id}
                  onChange={(e) => setRevForm({ ...revForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  {availableRevCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Financial Amounts & Deductions */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Faturamento Bruto (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={revForm.gross_amount}
                    onChange={(e) => setRevForm({ ...revForm, gross_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Imposto Simples (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={revForm.tax_percent}
                    onChange={(e) => setRevForm({ ...revForm, tax_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Comissão (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={revForm.commission_percent}
                    onChange={(e) => setRevForm({ ...revForm, commission_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Outras Deduções Diretas (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={revForm.other_deductions}
                  onChange={(e) => setRevForm({ ...revForm, other_deductions: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono outline-none focus:border-blue-500"
                />
              </div>

              {/* Calculated Summary */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Total Deduções: {formatCurrency(taxAmount + commissionAmount + revForm.other_deductions)}
                </span>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Receita Líquida DRE:</span>
                  <span className={`font-mono font-bold text-sm ${netAmount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(netAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates & Status */}
            <div className={`grid gap-2 ${revForm.status === 'received' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Competência (DRE)</label>
                <input
                  type="date"
                  required
                  value={revForm.competence_date}
                  onChange={(e) => setRevForm({ ...revForm, competence_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vencimento</label>
                <input
                  type="date"
                  required
                  value={revForm.due_date}
                  onChange={(e) => setRevForm({ ...revForm, due_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {revForm.status === 'received' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data Recebimento *</label>
                  <input
                    type="date"
                    required
                    value={revForm.received_date}
                    onChange={(e) => setRevForm({ ...revForm, received_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={revForm.status}
                  onChange={(e) => setRevForm({ ...revForm, status: e.target.value as TransactionStatus })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="received">Recebido (Liquidado)</option>
                  <option value="pending">A Receber (Pendente)</option>
                  <option value="overdue">Atrasado / Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold font-heading shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </form>
        )}

        {/* EDIT EXPENSE FORM */}
        {isExpense && (
          <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Descrição da Despesa / Custo *</label>
              <input
                type="text"
                required
                value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fornecedor / Credor</label>
                <input
                  type="text"
                  placeholder="Ex: Meta Ads, Fornecedor, AWS"
                  value={expForm.supplier}
                  onChange={(e) => setExpForm({ ...expForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria DRE (Despesas/Custos) *</label>
                <select
                  value={expForm.category_id}
                  onChange={(e) => setExpForm({ ...expForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  {availableExpCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type || cat.group})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-rose-600 font-mono font-bold outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Natureza do Custo</label>
                <select
                  value={expForm.cost_nature}
                  onChange={(e) => setExpForm({ ...expForm, cost_nature: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="FIXED">Fixo (Estrutural)</option>
                  <option value="VARIABLE">Variável (Escala com Vendas)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Centro de Resultado</label>
                <select
                  value={expForm.cost_center_id}
                  onChange={(e) => setExpForm({ ...expForm, cost_center_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Segregação Patrimonial Switch */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expForm.is_equity_movement}
                  onChange={(e) => setExpForm({ ...expForm, is_equity_movement: e.target.checked })}
                  className="rounded bg-white border-purple-300 text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="text-purple-800 font-bold block">
                    Movimentação Patrimonial / Sócios (Fora da DRE Operacional)
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Marque se for Distribuição de Lucros/Dividendos, Aporte de Capital ou Empréstimo de Sócios.
                  </span>
                </div>
              </label>
            </div>

            {/* Dates & Status */}
            <div className={`grid gap-2 ${expForm.status === 'paid' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Competência (DRE)</label>
                <input
                  type="date"
                  required
                  value={expForm.competence_date}
                  onChange={(e) => setExpForm({ ...expForm, competence_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vencimento</label>
                <input
                  type="date"
                  required
                  value={expForm.due_date}
                  onChange={(e) => setExpForm({ ...expForm, due_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-rose-500"
                />
              </div>

              {expForm.status === 'paid' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data Pagamento *</label>
                  <input
                    type="date"
                    required
                    value={expForm.paid_date}
                    onChange={(e) => setExpForm({ ...expForm, paid_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={expForm.status}
                  onChange={(e) => setExpForm({ ...expForm, status: e.target.value as TransactionStatus })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="paid">Pago (Liquidado)</option>
                  <option value="pending">A Pagar (Pendente)</option>
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold font-heading shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
