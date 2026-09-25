import React, { useState } from 'react';
import {
  Building2,
  Database,
  ShieldCheck,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Edit2,
  Users,
  Check,
  Globe,
  UserCheck,
  Mail,
  Phone,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  CreditCard,
} from 'lucide-react';
import {
  Company,
  Category,
  CostCenter,
  User,
  CompanyRole,
  CategoryType,
  Plan,
  Subscription,
  OrganizationMember,
  OrganizationInvitation,
} from '../../types';
import { EditCompanyModal } from './EditCompanyModal';
import { ManageCompanyUsersModal } from './ManageCompanyUsersModal';
import { EditUserModal } from './EditUserModal';
import { EditCategoryModal } from './EditCategoryModal';
import { TeamManagementTab } from './TeamManagementTab';
import { PlanAndBillingView } from './PlanAndBillingView';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';

interface SettingsViewProps {
  companies: Company[];
  categories: Category[];
  costCenters: CostCenter[];
  currentCompanyId: string;
  users: User[];
  currentUserRole?: 'owner' | 'finance' | 'system_admin' | string;
  currentUserId?: string;
  initialSubTab?: 'team' | 'companies' | 'users' | 'categories' | 'import' | 'database' | 'billing';
  onSelectCompany?: (companyId: string) => void;
  onAddCompany: (comp: Omit<Company, 'id' | 'created_at'>) => void;
  onUpdateCompany: (comp: Company) => void;
  onDeleteCompany: (companyId: string) => void;
  onAddUser?: (user: Omit<User, 'id' | 'created_at'>) => void;
  onAddUserToCompany: (companyId: string, user: Omit<User, 'id' | 'created_at'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser?: (userId: string) => void;
  onRemoveUserFromCompany: (companyId: string, userId: string) => void;
  onLinkExistingUser: (companyId: string, userId: string, role?: CompanyRole) => void;
  onAddCategory?: (cat: Omit<Category, 'id'>) => void;
  onUpdateCategory?: (cat: Category) => void;
  onDeleteCategory?: (catId: string) => void;
  onResetDatabase: () => void;
  onImportCSV: (type: 'revenues' | 'expenses', csvContent: string) => void;
  isPreviewMode?: boolean;
  billingPreviewData?: {
    subscription: Subscription;
    plan: Plan;
    activeUsersCount: number;
  };
  previewMembers?: OrganizationMember[];
  previewInvitations?: OrganizationInvitation[];
  onActionIntercepted?: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  companies,
  categories,
  costCenters,
  currentCompanyId,
  users = [],
  currentUserRole = 'owner',
  currentUserId = '',
  initialSubTab,
  onSelectCompany,
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  onAddUser,
  onAddUserToCompany,
  onUpdateUser,
  onDeleteUser,
  onRemoveUserFromCompany,
  onLinkExistingUser,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetDatabase,
  onImportCSV,
  isPreviewMode = false,
  billingPreviewData,
  previewMembers = [],
  previewInvitations = [],
  onActionIntercepted,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'team' | 'companies' | 'users' | 'categories' | 'import' | 'database' | 'billing'
  >(initialSubTab || 'team');

  // Company Modals state
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // Manage Company Users Modal
  const [isManageUsersModalOpen, setIsManageUsersModalOpen] = useState(false);
  const [selectedCompanyForUsers, setSelectedCompanyForUsers] = useState<Company | null>(null);

  // User Modals state
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Category Modals state
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // CSV Import State
  const [importType, setImportType] = useState<'revenues' | 'expenses'>('revenues');
  const [csvText, setCsvText] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // Quick user search in global tab
  const [globalUserSearch, setGlobalUserSearch] = useState('');

  // Handle open create company modal
  const handleOpenCreateCompany = () => {
    setEditingCompany(null);
    setIsEditCompanyModalOpen(true);
  };

  // Handle open edit company modal
  const handleOpenEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsEditCompanyModalOpen(true);
  };

  // Save company (create or update)
  const handleSaveCompany = (data: {
    name: string;
    cnpj: string;
    segment: string;
    currency: string;
  }) => {
    if (editingCompany) {
      onUpdateCompany({
        ...editingCompany,
        name: data.name,
        document: data.cnpj,
        cnpj: data.cnpj,
        segment: data.segment,
        currency: data.currency,
      });
    } else {
      onAddCompany({
        name: data.name,
        document: data.cnpj,
        cnpj: data.cnpj,
        segment: data.segment,
        currency: data.currency,
      });
    }
  };

  // Handle manage users for a company
  const handleOpenManageUsers = (company: Company) => {
    setSelectedCompanyForUsers(company);
    setIsManageUsersModalOpen(true);
  };

  // Delete company confirmed
  const handleConfirmDeleteCompany = () => {
    if (!companyToDelete) return;
    if (companies.length <= 1) {
      setDeleteModalError('Não é permitido excluir a única empresa cadastrada no sistema.');
      return;
    }
    setDeleteModalError(null);
    onDeleteCompany(companyToDelete.id);
    setCompanyToDelete(null);
  };

  // User Handlers
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setIsEditUserModalOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditUserModalOpen(true);
  };

  const handleSaveUser = (data: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    role: CompanyRole;
    status: 'active' | 'inactive' | 'pending';
    avatar: string;
    company_ids: string[];
  }) => {
    if (data.id) {
      // Update existing user
      const existing = users.find((u) => u.id === data.id);
      if (existing) {
        onUpdateUser({
          ...existing,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          status: data.status,
          avatar: data.avatar,
          company_ids: data.company_ids,
          company_id: data.company_ids[0] || existing.company_id,
        });
      }
    } else {
      // Add new user
      if (onAddUser) {
        onAddUser({
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          status: data.status,
          avatar: data.avatar,
          company_ids: data.company_ids,
          company_id: data.company_ids[0] || currentCompanyId,
        });
      } else {
        onAddUserToCompany(data.company_ids[0] || currentCompanyId, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          status: data.status,
          avatar: data.avatar,
          company_ids: data.company_ids,
          company_id: data.company_ids[0] || currentCompanyId,
        });
      }
    }
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    if (users.length <= 1) {
      setDeleteModalError('Não é permitido apagar o único usuário do sistema.');
      return;
    }
    setDeleteModalError(null);
    if (onDeleteUser) {
      onDeleteUser(userToDelete.id);
    }
    setUserToDelete(null);
  };

  // Category Handlers
  const handleOpenCreateCategory = () => {
    setCategoryError(null);
    setEditingCategory(null);
    setIsEditCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setCategoryError(null);
    setEditingCategory(cat);
    setIsEditCategoryModalOpen(true);
  };

  const handleSaveCategory = (data: {
    id?: string;
    name: string;
    code: string;
    type: CategoryType;
    description?: string;
  }) => {
    setCategoryError(null);
    try {
      if (data.id && onUpdateCategory) {
        const existing = categories.find((c) => c.id === data.id);
        if (existing) {
          onUpdateCategory({
            ...existing,
            name: data.name,
            code: data.code,
            type: data.type,
            description: data.description,
          });
        }
      } else if (onAddCategory) {
        onAddCategory({
          name: data.name,
          code: data.code,
          type: data.type,
          description: data.description,
        });
      }
    } catch (err) {
      setCategoryError(formatFinancialErrorMessage(err, data.id ? 'update' : 'create', 'category'));
    }
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    setCategoryError(null);
    try {
      if (onDeleteCategory) {
        onDeleteCategory(categoryToDelete.id);
      }
      setCategoryToDelete(null);
    } catch (err) {
      setCategoryError(formatFinancialErrorMessage(err, 'delete', 'category'));
    }
  };

  // CSV Import Submit
  const handleProcessImport = () => {
    if (!csvText.trim()) return;
    onImportCSV(importType, csvText);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      setCsvText('');
    }, 3000);
  };

  const getRoleBadge = (role: CompanyRole) => {
    switch (role) {
      case 'admin':
        return { label: 'CFO / Admin', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'financial_analyst':
        return { label: 'Analista', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'manager':
        return { label: 'Gestor', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'viewer':
        return { label: 'Sócio / Leitura', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: role, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Configurações & Governança
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                Gestão de Acessos
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Gestão Completa de Usuários, Empresas & Contas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inclua, edite, salve e exclua usuários, empresas, plano de contas e permissões do grupo NOX4
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Tem certeza que deseja restaurar os dados de demonstração originais?')) {
                  onResetDatabase();
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Base Oficial</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 overflow-x-auto">
          <button
            id="tab-btn-team"
            onClick={() => setActiveSubTab('team')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'team'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Equipe & Convites</span>
          </button>
          <button
            onClick={() => setActiveSubTab('companies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'companies'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            Empresas Cadastradas ({companies.length})
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'users'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            Usuários Globais ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'categories'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            Plano de Contas DRE ({categories.length})
          </button>
          <button
            onClick={() => setActiveSubTab('import')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'import'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            Importar Lançamentos (CSV)
          </button>
          <button
            onClick={() => setActiveSubTab('database')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'database'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
            }`}
          >
            Segurança & Proteção de Dados
          </button>
          {currentUserRole === 'owner' && (
            <button
              id="tab-btn-billing"
              onClick={() => setActiveSubTab('billing')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'billing'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Plano e Cobrança</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab 0: Team Management with invitations */}
      {activeSubTab === 'team' && (
        <div>
          {companies.find((c) => c.id === currentCompanyId) ? (
            <TeamManagementTab
              currentCompany={companies.find((c) => c.id === currentCompanyId)!}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              isPreviewMode={isPreviewMode}
              previewMembers={previewMembers}
              previewInvitations={previewInvitations}
              onActionIntercepted={onActionIntercepted}
            />
          ) : (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              Selecione uma empresa para gerenciar sua equipe e convites.
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 1: Registered Companies */}
      {activeSubTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading uppercase tracking-wide">
                Empresas & Filiais Cadastradas
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie os dados cadastrais, exclua entidades ou controle os membros com acesso a cada empresa
              </p>
            </div>

            <button
              onClick={handleOpenCreateCompany}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold font-heading shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Empresa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => {
              const isActive = c.id === currentCompanyId;
              const companyUsers = users.filter((u) => {
                const ids = u.company_ids || (u.company_id ? [u.company_id] : []);
                return ids.includes(c.id);
              });

              return (
                <div
                  key={c.id}
                  className={`bg-white border rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-4 relative ${
                    isActive
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            isActive
                              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-slate-800 font-heading truncate">
                              {c.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            CNPJ: {c.cnpj || c.document || 'Não informado'}
                          </p>
                        </div>
                      </div>

                      {/* Header Actions: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCompany(c)}
                          title="Editar Dados da Empresa"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyToDelete(c)}
                          title={
                            companies.length <= 1
                              ? 'Não é possível apagar a única empresa'
                              : 'Apagar / Excluir Empresa'
                          }
                          disabled={companies.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Status & Segment */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Segmento: <strong className="text-slate-700">{c.segment}</strong>
                      </span>
                      {isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                          Em Uso
                        </span>
                      ) : (
                        onSelectCompany && (
                          <button
                            type="button"
                            onClick={() => onSelectCompany(c.id)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Alternar para esta</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Registered Users Section inside the card */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Usuários Cadastrados</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {companyUsers.length} {companyUsers.length === 1 ? 'membro' : 'membros'}
                      </span>
                    </div>

                    {/* Member Avatars Preview */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center -space-x-2 overflow-hidden">
                        {companyUsers.slice(0, 4).map((u, i) =>
                          u.avatar ? (
                            <img
                              key={u.id}
                              src={u.avatar}
                              alt={u.name}
                              title={`${u.name} (${getRoleBadge(u.role).label})`}
                              className="w-7 h-7 rounded-full object-cover border-2 border-white ring-1 ring-slate-200"
                            />
                          ) : (
                            <div
                              key={u.id}
                              title={`${u.name} (${getRoleBadge(u.role).label})`}
                              className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white"
                            >
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                          )
                        )}
                        {companyUsers.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold border-2 border-white">
                            +{companyUsers.length - 4}
                          </div>
                        )}
                      </div>

                      {/* Prominent Manage Users Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenManageUsers(c)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Gerenciar Usuários</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Global System Users Directory with Full Add/Edit/Delete/Save */}
      {activeSubTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading uppercase tracking-wide">
                Usuários & Colaboradores Cadastrados no Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Inclua, edite dados, altere cargos, atribua filiais e gerencie acessos de cada colaborador
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={globalUserSearch}
                onChange={(e) => setGlobalUserSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
              />

              <button
                type="button"
                onClick={handleOpenCreateUser}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {users
              .filter(
                (u) =>
                  u.name.toLowerCase().includes(globalUserSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(globalUserSearch.toLowerCase())
              )
              .map((u) => {
                const roleBadge = getRoleBadge(u.role);
                const userCompanyNames = companies
                  .filter((c) => {
                    const ids = u.company_ids || (u.company_id ? [u.company_id] : []);
                    return ids.includes(c.id);
                  })
                  .map((c) => c.name);

                return (
                  <div
                    key={u.id}
                    className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-slate-800 truncate">{u.name}</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </p>
                            {u.phone && (
                              <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{u.phone}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons: Edit & Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            title="Editar Usuário"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            title={
                              users.length <= 1
                                ? 'Não é permitido apagar o único usuário'
                                : 'Apagar Usuário'
                            }
                            disabled={users.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white disabled:opacity-30 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.bg}`}
                        >
                          {roleBadge.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'inactive'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {u.status === 'inactive' ? 'Inativo' : 'Ativo'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>Empresas com acesso:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {userCompanyNames.length > 0 ? (
                          userCompanyNames.map((name, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-medium text-slate-700 truncate max-w-[200px]"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[10px]">Nenhuma empresa vinculada</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Sub-tab 3: DRE Accounts (Editable & Creatable) */}
      {activeSubTab === 'categories' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          {categoryError && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{categoryError}</div>
              <button
                onClick={() => setCategoryError(null)}
                className="text-rose-500 hover:text-rose-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Plano de Contas DRE Gerencial
              </h3>
              <p className="text-xs text-slate-500">
                Estrutura oficial de classificação de receitas, custos e despesas operacionais
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Conta DRE</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="font-semibold text-slate-800">{cat.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Código DRE: {cat.code}</div>
                  {cat.description && (
                    <div className="text-[11px] text-slate-500 mt-1">{cat.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {cat.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditCategory(cat)}
                    title="Editar Categoria"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(cat)}
                    title="Apagar Categoria"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 4: CSV Import */}
      {activeSubTab === 'import' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 font-heading">
            Importação de Lançamentos via CSV / Texto
          </h3>
          <p className="text-xs text-slate-500">
            Cole as linhas no formato: <code className="text-blue-600 font-mono">Descrição; Valor; Competência (AAAA-MM-DD); Vencimento (AAAA-MM-DD)</code>
          </p>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="importType"
                checked={importType === 'revenues'}
                onChange={() => setImportType('revenues')}
                className="text-blue-600 focus:ring-0"
              />
              <span>Importar como Receitas</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="importType"
                checked={importType === 'expenses'}
                onChange={() => setImportType('expenses')}
                className="text-blue-600 focus:ring-0"
              />
              <span>Importar como Despesas</span>
            </label>
          </div>

          <textarea
            rows={6}
            placeholder={`Exemplo:\nConsultoria Estratégica Setembro; 8500.00; 2026-09-01; 2026-09-10\nLicença Softwares Tech; 1200.00; 2026-09-01; 2026-09-05`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono outline-none focus:border-blue-500 focus:bg-white"
          />

          <div className="flex items-center justify-between">
            {importSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Lançamentos importados e recalculados com sucesso!
              </span>
            )}
            <button
              onClick={handleProcessImport}
              disabled={!csvText.trim()}
              className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Processar e Atualizar DRE</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab 5: Segurança & Proteção de Dados */}
      {activeSubTab === 'database' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 font-heading">
              Segurança & Proteção de Dados
            </h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            O sistema opera com isolamento rigoroso de informações financeiras. Cada organização possui um ambiente de dados segregado e protegido. Nenhuma visualização ou relatório cruza dados entre diferentes empresas sem autorização explícita dos gestores.
          </p>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Proteção e Isolamento Contínuo de Dados Ativado</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Todos os registros contábeis, categorias, centros de custo e lançamentos bancários são restritos estritamente aos membros autorizados de cada empresa.
            </p>
          </div>
        </div>
      )}

      {/* Sub-tab 6: Plano e Cobrança (apenas para role owner) */}
      {activeSubTab === 'billing' && (
        <PlanAndBillingView
          activeOrganizationId={currentCompanyId}
          currentUserRole={currentUserRole}
          isPreviewMode={isPreviewMode}
          previewData={billingPreviewData}
        />
      )}

      {/* Edit / Create Company Modal */}
      <EditCompanyModal
        isOpen={isEditCompanyModalOpen}
        onClose={() => {
          setIsEditCompanyModalOpen(false);
          setEditingCompany(null);
        }}
        company={editingCompany}
        onSave={handleSaveCompany}
      />

      {/* Manage Company Users Modal */}
      <ManageCompanyUsersModal
        isOpen={isManageUsersModalOpen}
        onClose={() => {
          setIsManageUsersModalOpen(false);
          setSelectedCompanyForUsers(null);
        }}
        company={selectedCompanyForUsers}
        allUsers={users}
        onAddUserToCompany={onAddUserToCompany}
        onUpdateUser={onUpdateUser}
        onRemoveUserFromCompany={onRemoveUserFromCompany}
        onLinkExistingUser={onLinkExistingUser}
      />

      {/* Edit / Create User Modal */}
      <EditUserModal
        isOpen={isEditUserModalOpen}
        onClose={() => {
          setIsEditUserModalOpen(false);
          setEditingUser(null);
        }}
        user={editingUser}
        companies={companies}
        onSave={handleSaveUser}
      />

      {/* Edit / Create Category Modal */}
      <EditCategoryModal
        isOpen={isEditCategoryModalOpen}
        onClose={() => {
          setIsEditCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

      {/* Delete Company Confirmation Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Empresa / Filial?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar a empresa{' '}
                <strong className="text-slate-800">{companyToDelete.name}</strong>?
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> Esta ação removerá a empresa e desconectará os membros e lançamentos
              associados a ela. Esta operação é irreversível.
            </div>

            {deleteModalError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                {deleteModalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalError(null);
                  setCompanyToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Empresa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Usuário do Sistema?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar o usuário{' '}
                <strong className="text-slate-800">{userToDelete.name}</strong> ({userToDelete.email})?
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> O usuário perderá o acesso a todas as empresas do grupo.
            </div>

            {deleteModalError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                {deleteModalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalError(null);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Usuário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Conta DRE?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar a conta{' '}
                <strong className="text-slate-800">{categoryToDelete.name}</strong> ({categoryToDelete.code})?
              </p>
            </div>

            {categoryError && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{categoryError}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryToDelete(null);
                  setCategoryError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
