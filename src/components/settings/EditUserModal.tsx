import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  X,
  Check,
  Mail,
  Phone,
  Shield,
  Building2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { User, Company, CompanyRole } from '../../types';
import { AvatarUpload, PRESET_AVATARS } from '../common/AvatarUpload';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  companies: Company[];
  onSave: (userData: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    role: CompanyRole;
    status: 'active' | 'inactive' | 'pending';
    avatar: string;
    company_ids: string[];
  }) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  companies,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<CompanyRole>('financial_analyst');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.role || 'financial_analyst');
      setStatus(user.status || 'active');
      setAvatar(user.avatar || PRESET_AVATARS[0]);
      const initialIds =
        user.company_ids && user.company_ids.length > 0
          ? user.company_ids
          : user.company_id
          ? [user.company_id]
          : companies.map((c) => c.id);
      setSelectedCompanyIds(initialIds);
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setRole('financial_analyst');
      setStatus('active');
      setAvatar(PRESET_AVATARS[0]);
      // By default select all active companies for new user or first one
      setSelectedCompanyIds(companies.length > 0 ? [companies[0].id] : []);
    }
  }, [user, isOpen, companies]);

  if (!isOpen) return null;

  const isEditing = !!user;

  const toggleCompany = (compId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(compId) ? prev.filter((id) => id !== compId) : [...prev, compId]
    );
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanyIds.length === companies.length) {
      setSelectedCompanyIds([]);
    } else {
      setSelectedCompanyIds(companies.map((c) => c.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onSave({
      id: user?.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      status,
      avatar,
      company_ids:
        selectedCompanyIds.length > 0
          ? selectedCompanyIds
          : companies.length > 0
          ? [companies[0].id]
          : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                {isEditing ? 'Editar Usuário do Sistema' : 'Incluir Novo Usuário'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Atualize dados de contato, cargo, empresas de acesso e status da conta'
                  : 'Cadastre um novo colaborador e defina suas permissões no sistema'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {/* Avatar upload / selector */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">
              Foto de Perfil / Avatar do Usuário
            </label>
            <AvatarUpload
              value={avatar}
              onChange={(url) => setAvatar(url)}
              userName={name || 'Usuário'}
            />
          </div>

          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Matheus Oliveira"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                E-mail Corporativo <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="matheus@nox4.com.br"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Phone & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98888-7777"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status da Conta</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'pending')}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
              >
                <option value="active">Ativo (Acesso Liberado)</option>
                <option value="inactive">Inativo (Acesso Bloqueado)</option>
                <option value="pending">Pendente (Aguardando Ativação)</option>
              </select>
            </div>
          </div>

          {/* Role / Access Level */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Perfil de Acesso (Cargo & Permissões) <span className="text-rose-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyRole)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
            >
              <option value="admin">CFO / Administrador Geral (Acesso total a relatórios, configurações e gestão)</option>
              <option value="financial_analyst">Analista Financeiro (Lançamentos de receitas, despesas e DRE)</option>
              <option value="manager">Gestor Operacional (Acompanhamento de centros de custo e metas)</option>
              <option value="viewer">Sócio / Conselho Consultivo (Visualização executiva e relatórios)</option>
            </select>
          </div>

          {/* Companies Multi-Select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-700 font-semibold">
                Empresas com Acesso Autorizado ({selectedCompanyIds.length}/{companies.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAllCompanies}
                className="text-blue-600 hover:underline text-[11px] font-medium"
              >
                {selectedCompanyIds.length === companies.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-36 overflow-y-auto">
              {companies.map((c) => {
                const isSelected = selectedCompanyIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCompany(c.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-200 text-blue-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="text-xs truncate">{c.name}</span>
                      {c.cnpj && <span className="text-[10px] text-slate-400 font-mono">({c.cnpj})</span>}
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Salvar Novo Usuário'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
