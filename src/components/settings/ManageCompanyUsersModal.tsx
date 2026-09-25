import React, { useState } from 'react';
import {
  Users,
  X,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Building2,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { Company, User, CompanyRole } from '../../types';

interface ManageCompanyUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  allUsers: User[];
  onAddUserToCompany: (
    companyId: string,
    userData: Omit<User, 'id' | 'created_at'>
  ) => void;
  onUpdateUser: (updatedUser: User) => void;
  onRemoveUserFromCompany: (companyId: string, userId: string) => void;
  onLinkExistingUser: (companyId: string, userId: string, role?: CompanyRole) => void;
}

export const ManageCompanyUsersModal: React.FC<ManageCompanyUsersModalProps> = ({
  isOpen,
  onClose,
  company,
  allUsers,
  onAddUserToCompany,
  onUpdateUser,
  onRemoveUserFromCompany,
  onLinkExistingUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [isLinkingExisting, setIsLinkingExisting] = useState(false);
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [existingUserRole, setExistingUserRole] = useState<CompanyRole>('financial_analyst');

  // Editing user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: CompanyRole;
    status: 'active' | 'inactive' | 'pending';
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'financial_analyst',
    status: 'active',
  });

  // New user form state
  const [newUserData, setNewUserData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: CompanyRole;
    status: 'active' | 'inactive' | 'pending';
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'financial_analyst',
    status: 'active',
  });

  if (!isOpen || !company) return null;

  // Filter users belonging to this company
  const companyUsers = allUsers.filter((u) => {
    const ids = u.company_ids || (u.company_id ? [u.company_id] : []);
    return ids.includes(company.id);
  });

  // Users not currently linked to this company
  const availableExistingUsers = allUsers.filter((u) => {
    const ids = u.company_ids || (u.company_id ? [u.company_id] : []);
    return !ids.includes(company.id);
  });

  // Filtered users for display
  const filteredCompanyUsers = companyUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name.trim() || !newUserData.email.trim()) return;

    onAddUserToCompany(company.id, {
      name: newUserData.name.trim(),
      email: newUserData.email.trim().toLowerCase(),
      role: newUserData.role,
      phone: newUserData.phone.trim(),
      status: newUserData.status,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256`,
    });

    setNewUserData({
      name: '',
      email: '',
      phone: '',
      role: 'financial_analyst',
      status: 'active',
    });
    setIsAddingNewUser(false);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExistingUserId) return;
    onLinkExistingUser(company.id, selectedExistingUserId, existingUserRole);
    setSelectedExistingUserId('');
    setIsLinkingExisting(false);
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status || 'active',
    });
  };

  const saveEditUser = (user: User) => {
    onUpdateUser({
      ...user,
      name: editFormData.name.trim(),
      email: editFormData.email.trim().toLowerCase(),
      phone: editFormData.phone.trim(),
      role: editFormData.role,
      status: editFormData.status,
    });
    setEditingUserId(null);
  };

  const getRoleLabel = (role: CompanyRole) => {
    switch (role) {
      case 'admin':
        return { label: 'CFO / Admin Geral', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'financial_analyst':
        return { label: 'Analista Financeiro', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'manager':
        return { label: 'Gestor Operacional', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'viewer':
        return { label: 'Sócio / Leitura', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: role, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  Gestão de Acessos & Usuários Cadastrados
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {companyUsers.length} membros
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">{company.name}</strong>
                {company.cnpj && <span className="font-mono text-slate-400">({company.cnpj})</span>}
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

        {/* Action Controls & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuário por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-blue-500 focus:bg-white font-medium"
            >
              <option value="all">Todos os Cargos</option>
              <option value="admin">CFO / Admin</option>
              <option value="financial_analyst">Analista Financeiro</option>
              <option value="manager">Gestor</option>
              <option value="viewer">Sócio / Leitura</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {availableExistingUsers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsLinkingExisting(!isLinkingExisting);
                  setIsAddingNewUser(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isLinkingExisting
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Vincular Existente ({availableExistingUsers.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsAddingNewUser(!isAddingNewUser);
                setIsLinkingExisting(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-heading shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                isAddingNewUser
                  ? 'bg-slate-800 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNewUser ? 'Cancelar Cadastro' : 'Novo Usuário'}</span>
            </button>
          </div>
        </div>

        {/* Link Existing User Section */}
        {isLinkingExisting && availableExistingUsers.length > 0 && (
          <form
            onSubmit={handleLinkSubmit}
            className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs font-heading">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span>Conceder Acesso a Usuário já Cadastrado no Sistema</span>
            </div>
            <p className="text-[11px] text-indigo-700">
              Selecione um profissional já cadastrado em outra filial/empresa para atribuir permissões nesta empresa:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <select
                  required
                  value={selectedExistingUserId}
                  onChange={(e) => setSelectedExistingUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">-- Selecione o usuário --</option>
                  {availableExistingUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — Perfil base: {getRoleLabel(u.role).label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={existingUserRole}
                  onChange={(e) => setExistingUserRole(e.target.value as CompanyRole)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="admin">CFO / Admin Geral</option>
                  <option value="financial_analyst">Analista Financeiro</option>
                  <option value="manager">Gestor Operacional</option>
                  <option value="viewer">Sócio / Leitura</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLinkingExisting(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-indigo-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!selectedExistingUserId}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Vincular Acesso à Empresa</span>
              </button>
            </div>
          </form>
        )}

        {/* Add New User Form Section */}
        {isAddingNewUser && (
          <form
            onSubmit={handleCreateUserSubmit}
            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs font-heading">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Cadastrar Novo Usuário e Vincular a {company.name}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  placeholder="Ex: Matheus Oliveira"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                  E-mail Corporativo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="matheus@empresa.com.br"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  placeholder="(11) 98888-7777"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                  Perfil de Acesso (Cargo) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as CompanyRole })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
                >
                  <option value="admin">CFO / Administrador Geral (Total)</option>
                  <option value="financial_analyst">Analista Financeiro (Lançamentos & DRE)</option>
                  <option value="manager">Gestor Operacional (Centros de Custo)</option>
                  <option value="viewer">Sócio / Conselho (Visualização)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNewUser(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar e Conceder Acesso</span>
              </button>
            </div>
          </form>
        )}

        {/* Users List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[220px]">
          {filteredCompanyUsers.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Nenhum usuário encontrado com os filtros selecionados
              </p>
              <p className="text-[11px] text-slate-400">
                Clique em "+ Novo Usuário" ou "Vincular Existente" para adicionar membros a esta empresa.
              </p>
            </div>
          ) : (
            filteredCompanyUsers.map((user) => {
              const isEditingThisUser = editingUserId === user.id;
              const roleBadge = getRoleLabel(user.role);

              if (isEditingThisUser) {
                return (
                  <div
                    key={user.id}
                    className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3 animate-in fade-in"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Nome</label>
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">E-mail</label>
                        <input
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cargo / Perfil</label>
                        <select
                          value={editFormData.role}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, role: e.target.value as CompanyRole })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          <option value="admin">CFO / Admin</option>
                          <option value="financial_analyst">Analista Financeiro</option>
                          <option value="manager">Gestor</option>
                          <option value="viewer">Sócio / Leitura</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Status</label>
                        <select
                          value={editFormData.status}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              status: e.target.value as 'active' | 'inactive' | 'pending',
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="pending">Pendente</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-blue-100">
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEditUser(user)}
                        className="px-3.5 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Salvar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={user.id}
                  className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{user.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleBadge.color}`}
                        >
                          {roleBadge.label}
                        </span>
                        {user.status === 'inactive' ? (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            Inativo
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Ativo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 truncate">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Quick Role Switcher */}
                    <select
                      value={user.role}
                      onChange={(e) =>
                        onUpdateUser({
                          ...user,
                          role: e.target.value as CompanyRole,
                        })
                      }
                      title="Alterar Cargo / Permissão"
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="admin">CFO / Admin</option>
                      <option value="financial_analyst">Analista</option>
                      <option value="manager">Gestor</option>
                      <option value="viewer">Sócio / Leitura</option>
                    </select>

                    {/* Edit user modal */}
                    <button
                      type="button"
                      onClick={() => startEditUser(user)}
                      title="Editar Informações do Usuário"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove from this company */}
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Deseja remover o acesso de "${user.name}" da empresa "${company.name}"?`
                          )
                        ) {
                          onRemoveUserFromCompany(company.id, user.id);
                        }
                      }}
                      title="Remover Acesso desta Empresa"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info banner */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Controle de acesso seguro e individual para a empresa <strong>{company.name}</strong>.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
