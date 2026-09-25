import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  ShieldCheck,
  Building2,
  Wallet,
  AlertCircle,
  Users,
  Edit2,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { Partner, Expense } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import {
  formatFinancialErrorMessage,
  formatNullableText,
} from '../../lib/financialErrorMessages';

const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};

interface PartnersViewProps {
  partners: Partner[];
  expenses: Expense[];
  onAddPartner: (partner: Omit<Partner, 'id' | 'company_id' | 'created_at'>) => Promise<boolean | void> | void;
  onUpdatePartner?: (partner: Partner) => Promise<boolean | void> | void;
  onDeletePartner?: (partnerId: string) => Promise<boolean | void> | void;
  onRecordProfitDistribution: (partnerId: string, amount: number, date: string) => void;
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  partners,
  expenses,
  onAddPartner,
  onUpdatePartner,
  onDeletePartner,
  onRecordProfitDistribution,
}) => {
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [isDistModalOpen, setIsDistModalOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [partnerModalError, setPartnerModalError] = useState<string | null>(null);
  const [distModalError, setDistModalError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id || '');
  const [distAmount, setDistAmount] = useState(10000);
  const [distDate, setDistDate] = useState('2026-08-15');

  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    equity_percentage: 10,
    prolabore_amount: 5000,
    role: 'Sócio Diretor',
    document: '',
  });

  const totalEquity = partners.reduce((sum, p) => sum + p.equity_percentage, 0);
  const totalProlabore = partners.reduce((sum, p) => sum + (p.prolabore_amount || 0), 0);

  // Filter equity movements (profit distributions)
  const equityDistributions = expenses.filter((e) => e.is_equity_movement);
  const totalDistributed = equityDistributions.reduce((sum, e) => sum + e.amount, 0);

  const handleOpenAddPartner = () => {
    setPartnerModalError(null);
    setEditingPartner(null);
    setPartnerFormData({
      name: '',
      equity_percentage: 10,
      prolabore_amount: 5000,
      role: 'Sócio Diretor',
      document: '',
    });
    setIsPartnerModalOpen(true);
  };

  const handleOpenEditPartner = (partner: Partner) => {
    setPartnerModalError(null);
    setEditingPartner(partner);
    setPartnerFormData({
      name: partner.name,
      equity_percentage: partner.equity_percentage,
      prolabore_amount: partner.prolabore_amount || 0,
      role: partner.role || 'Sócio Diretor',
      document: partner.document ? formatCPF(partner.document) : '',
    });
    setIsPartnerModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerModalError(null);

    const trimmedName = partnerFormData.name.trim();
    if (!trimmedName) {
      setPartnerModalError('Por favor, informe o nome completo do sócio.');
      return;
    }

    if (
      partnerFormData.equity_percentage <= 0 ||
      partnerFormData.equity_percentage > 100
    ) {
      setPartnerModalError(
        'A participação societária deve ser maior que 0% e menor ou igual a 100%.'
      );
      return;
    }

    // Check equity sum
    const otherPartnersEquity = partners
      .filter((p) => p.id !== editingPartner?.id)
      .reduce((sum, p) => sum + p.equity_percentage, 0);

    if (otherPartnersEquity + partnerFormData.equity_percentage > 100) {
      setPartnerModalError(
        `A soma das participações não pode ultrapassar 100%. Os demais sócios já possuem ${otherPartnersEquity}% (disponível: ${Math.max(
          0,
          100 - otherPartnersEquity
        )}%).`
      );
      return;
    }

    if (partnerFormData.prolabore_amount < 0) {
      setPartnerModalError('O valor do pró-labore não pode ser negativo.');
      return;
    }

    try {
      if (editingPartner && onUpdatePartner) {
        const result = await onUpdatePartner({
          ...editingPartner,
          name: trimmedName,
          equity_percentage: partnerFormData.equity_percentage,
          prolabore_amount: partnerFormData.prolabore_amount,
          role: partnerFormData.role.trim() || 'Sócio',
          document: partnerFormData.document.trim(),
        });
        if (result === false) return;
      } else {
        const result = await onAddPartner({
          name: trimmedName,
          equity_percentage: partnerFormData.equity_percentage,
          prolabore_amount: partnerFormData.prolabore_amount,
          role: partnerFormData.role.trim() || 'Sócio',
          document: partnerFormData.document.trim(),
        });
        if (result === false) return;
      }
      setIsPartnerModalOpen(false);
    } catch (err) {
      setPartnerModalError(
        formatFinancialErrorMessage(
          err,
          editingPartner ? 'update' : 'create',
          'partner'
        )
      );
    }
  };

  const handleConfirmDeletePartner = async () => {
    if (!partnerToDelete) return;
    setDeleteError(null);
    try {
      if (onDeletePartner) {
        const result = await onDeletePartner(partnerToDelete.id);
        if (result === false) return;
      }
      setPartnerToDelete(null);
    } catch (err) {
      setDeleteError(
        formatFinancialErrorMessage(err, 'delete', 'partner')
      );
    }
  };

  const handleSaveDistribution = (e: React.FormEvent) => {
    e.preventDefault();
    setDistModalError(null);

    if (!selectedPartnerId) {
      setDistModalError('Por favor, selecione o sócio para a retirada.');
      return;
    }

    if (distAmount <= 0) {
      setDistModalError('O valor da retirada de lucros deve ser maior que zero.');
      return;
    }

    if (!distDate) {
      setDistModalError('Por favor, informe a data da retirada.');
      return;
    }

    try {
      onRecordProfitDistribution(selectedPartnerId, distAmount, distDate);
      setIsDistModalOpen(false);
    } catch (err) {
      setDistModalError(
        formatFinancialErrorMessage(err, 'create', 'transaction')
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feedback Error Banner */}
      {feedbackError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{feedbackError}</div>
          <button
            onClick={() => setFeedbackError(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 font-heading">
                Governança & Quadro Societário
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-medium">
                Princípio da Entidade (Segregação Patrimonial)
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Sócios, Pró-labore & Distribuição de Lucros
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestão de quotas societárias, pró-labore operacional (DRE) e distribuição de dividendos (Patrimônio)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsDistModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>Registrar Distribuição de Lucros</span>
            </button>
            <button
              onClick={handleOpenAddPartner}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Adicionar Sócio</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cap Table Consolidado</div>
            <div className="text-xl font-bold text-slate-800 font-heading mt-0.5">
              {totalEquity.toFixed(1)}% Quotas Ativas
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pró-labore Mensal (DRE)</div>
            <div className="text-xl font-bold text-blue-600 font-heading mt-0.5">
              {formatCurrency(totalProlabore)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distribuição de Lucros Acumulada</div>
            <div className="text-xl font-bold text-purple-600 font-heading mt-0.5">
              {formatCurrency(totalDistributed)}
            </div>
          </div>
        </div>
      </div>

      {/* Partners Grid */}
      {partners.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-heading">Nenhum sócio cadastrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Cadastre o quadro societário, percentuais de participação e pró-labore para gestão patrimonial e DRE.
          </p>
          <button
            onClick={handleOpenAddPartner}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Primeiro Sócio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((partner) => {
            const partnerDistributions = equityDistributions.filter(
              (e) => e.description.toLowerCase().includes(partner.name.toLowerCase())
            );
            const partnerTotalDist = partnerDistributions.reduce((s, e) => s + e.amount, 0);

            return (
              <div
                key={partner.id}
                className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center font-bold text-purple-700">
                        {partner.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 font-heading">{partner.name}</h3>
                        <span className="text-[10px] text-slate-500">{partner.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {partner.equity_percentage}% Equity
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditPartner(partner)}
                        title="Editar Sócio"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartnerToDelete(partner)}
                        title="Apagar Sócio"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pró-labore Operacional:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(partner.prolabore_amount || 0)}/mês
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Distribuição de Dividendos:</span>
                      <span className="font-mono font-bold text-purple-600">
                        {formatCurrency(partnerTotalDist)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{formatNullableText(partner.document, 'Documento não informado')}</span>
                  <span className="text-emerald-600 font-semibold">Ativo no Contrato Social</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Distribution History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 font-heading">
            Histórico de Movimentações Patrimoniais & Dividendos
          </h3>
          <span className="text-xs text-purple-700 font-semibold">
            Segregado da DRE Operacional
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3 px-4">Descrição do Lançamento</th>
                <th className="py-3 px-4">Data do Pagamento</th>
                <th className="py-3 px-4 text-right">Valor Retirado</th>
                <th className="py-3 px-4 text-center">Natureza Contábil</th>
              </tr>
            </thead>
            <tbody>
              {equityDistributions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                    Nenhuma distribuição de lucros registrada no período.
                  </td>
                </tr>
              ) : (
                equityDistributions.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {e.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {e.competence_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-600">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        Patrimonial / Financiamento
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Partner */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              {editingPartner ? 'Editar Dados do Sócio' : 'Adicionar Sócio ao Quadro'}
            </h3>

            {/* Partner Modal Error */}
            {partnerModalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{partnerModalError}</div>
              </div>
            )}

            <form onSubmit={handleSavePartner} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo do Sócio *</label>
                <input
                  type="text"
                  required
                  value={partnerFormData.name}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  placeholder="Ex: Gabriel Turíbia"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    value={partnerFormData.role}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CPF</label>
                  <input
                    type="text"
                    value={partnerFormData.document}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, document: formatCPF(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">% Quotas (Equity)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={partnerFormData.equity_percentage}
                    onChange={(e) =>
                      setPartnerFormData({
                        ...partnerFormData,
                        equity_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pró-labore Mensal (R$)</label>
                  <input
                    type="number"
                    step="100"
                    value={partnerFormData.prolabore_amount}
                    onChange={(e) =>
                      setPartnerFormData({
                        ...partnerFormData,
                        prolabore_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  {editingPartner ? 'Salvar Alterações' : 'Cadastrar Sócio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Partner Confirmation Modal */}
      {partnerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Sócio do Quadro?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar o sócio{' '}
                <strong className="text-slate-800">{partnerToDelete.name}</strong>?
              </p>
            </div>

            {deleteError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{deleteError}</div>
              </div>
            )}

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> As movimentações e quotas associadas a este sócio serão desvinculadas.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setPartnerToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePartner}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Sócio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Distribution */}
      {isDistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              Registrar Distribuição de Dividendos
            </h3>
            <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 p-2.5 rounded-lg">
              ℹ️ Lançamento patrimonial: este valor reduzirá o saldo de caixa sem distorcer o resultado operacional na DRE.
            </p>

            {distModalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{distModalError}</div>
              </div>
            )}

            <form onSubmit={handleSaveDistribution} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Selecione o Sócio *</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.equity_percentage}% Equity)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor da Retirada (R$)</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={distAmount}
                    onChange={(e) => setDistAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data da Retirada</label>
                  <input
                    type="date"
                    required
                    value={distDate}
                    onChange={(e) => setDistDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDistModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  Confirmar Retirada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
