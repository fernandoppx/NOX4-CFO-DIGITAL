import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  TrendingUp,
  DollarSign,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Client, Revenue } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import {
  formatFinancialErrorMessage,
  formatNullableText,
} from '../../lib/financialErrorMessages';

const maskCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
};

const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : '';
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

interface ClientsViewProps {
  clients: Client[];
  revenues: Revenue[];
  onAddClient: (client: Omit<Client, 'id' | 'created_at'>) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  revenues,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    contract_start_date: '2026-01-01',
    contract_value: 5000,
    mrr: 5000,
    status: 'active' as 'active' | 'churned' | 'prospect',
  });

  const handleOpenModal = (client?: Client) => {
    setModalError(null);
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        document: client.document ? maskCpfCnpj(client.document) : '',
        email: client.email || '',
        phone: client.phone ? maskPhone(client.phone) : '',
        contract_start_date: client.contract_start_date || '2026-01-01',
        contract_value: client.contract_value || 0,
        mrr: client.mrr || 0,
        status: client.status,
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        document: '',
        email: '',
        phone: '',
        contract_start_date: '2026-08-01',
        contract_value: 6000,
        mrr: 6000,
        status: 'active',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setModalError('Por favor, informe o nome da empresa ou cliente.');
      return;
    }

    if (formData.mrr < 0) {
      setModalError('O valor da mensalidade (MRR) não pode ser negativo.');
      return;
    }

    try {
      if (editingClient) {
        onUpdateClient({
          ...editingClient,
          name: trimmedName,
          document: formData.document.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          contract_start_date: formData.contract_start_date,
          contract_value: formData.contract_value,
          mrr: formData.mrr,
          status: formData.status,
        });
      } else {
        onAddClient({
          name: trimmedName,
          document: formData.document.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          contract_start_date: formData.contract_start_date,
          contract_value: formData.contract_value,
          mrr: formData.mrr,
          status: formData.status,
          company_id: 'comp_nox4',
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setModalError(
        formatFinancialErrorMessage(
          err,
          editingClient ? 'update' : 'create',
          'client'
        )
      );
    }
  };

  const handleConfirmDelete = () => {
    if (!clientToDelete) return;
    setFeedbackError(null);

    const linkedRevenues = revenues.filter((r) => r.client_id === clientToDelete.id);
    if (linkedRevenues.length > 0) {
      setFeedbackError(
        `Não é possível excluir o cliente "${clientToDelete.name}" porque existem ${linkedRevenues.length} faturamento(s) / contas a receber vinculadas a ele. Reatribua ou cancele esses lançamentos antes de excluir.`
      );
      setClientToDelete(null);
      return;
    }

    try {
      onDeleteClient(clientToDelete.id);
      setClientToDelete(null);
    } catch (err) {
      setFeedbackError(
        formatFinancialErrorMessage(err, 'delete', 'client')
      );
      setClientToDelete(null);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalMRR = clients
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + (c.mrr || 0), 0);

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
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Gestão da Carteira
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                MRR, LTV & Lucratividade por Conta
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Clientes & Contratos Recorrentes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Controle de mensalidades, contratos ativos, churn e faturamento por parceiro
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clientes Ativos</div>
            <div className="text-xl font-bold text-slate-800 font-heading mt-0.5">
              {clients.filter((c) => c.status === 'active').length} / {clients.length}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MRR Total da Carteira</div>
            <div className="text-xl font-bold text-emerald-600 font-heading mt-0.5">
              {formatCurrency(totalMRR)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ticket Médio por Cliente</div>
            <div className="text-xl font-bold text-blue-600 font-heading mt-0.5">
              {formatCurrency(
                clients.filter((c) => c.status === 'active').length > 0
                  ? totalMRR / clients.filter((c) => c.status === 'active').length
                  : 0
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do cliente ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-heading">Nenhum cliente cadastrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Cadastre seus clientes e contratos para vincular lançamentos de receitas e acompanhar a rentabilidade.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Primeiro Cliente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const clientRevenues = revenues.filter((r) => r.client_id === client.id);
            const totalPaidRevenue = clientRevenues
              .filter((r) => normalizeTransactionStatus(r.status) === 'received')
              .reduce((sum, r) => sum + r.net_amount, 0);

            return (
              <div
                key={client.id}
                className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 font-heading">{client.name}</h3>
                      {client.document && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          CNPJ/CPF: {client.document}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        client.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {client.status === 'active' ? 'Ativo' : 'Cancelado'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    {client.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Mensalidade (MRR)</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {formatCurrency(client.mrr || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Faturado Histórico</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatCurrency(totalPaidRevenue)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenModal(client)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-slate-500" /> Editar
                  </button>
                  <button
                    onClick={() => setClientToDelete(client)}
                    title="Excluir Cliente"
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add/Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
            </h3>

            {/* Modal Error */}
            {modalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{modalError}</div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome da Empresa / Cliente *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  placeholder="Ex: Matrix Fitness Unidade Jardins"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: maskCpfCnpj(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    maxLength={18}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="active">Ativo</option>
                    <option value="churned">Cancelado</option>
                    <option value="prospect">prospect</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor Mensal (MRR) R$</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mrr}
                    onChange={(e) => setFormData({ ...formData, mrr: parseFloat(e.target.value) || 0, contract_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Início do Contrato</label>
                  <input
                    type="date"
                    value={formData.contract_start_date}
                    onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Cliente?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja remover o cliente{' '}
                <strong className="text-slate-800">{clientToDelete.name}</strong>?
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> A remoção deste cliente cancelará o cadastro no CRM de receitas. Verifique se não há notas pendentes.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
