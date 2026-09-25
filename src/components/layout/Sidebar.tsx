import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  FileSpreadsheet,
  Users,
  Package,
  Layers,
  PiggyBank,
  UserCheck,
  LineChart,
  Settings,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  Building2,
  ChevronDown,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { User, Company } from '../../types';

export type NavTab =
  | 'dashboard'
  | 'revenues'
  | 'expenses'
  | 'receivables'
  | 'payables'
  | 'cashflow'
  | 'dre'
  | 'clients'
  | 'products'
  | 'cost_centers'
  | 'budget'
  | 'partners'
  | 'team'
  | 'settings'
  | 'billing'
  | 'admin_panel';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUser?: User;
  isSystemAdmin?: boolean;
  currentUserRole?: string;
  userOrganizations?: Company[];
  activeOrganizationId?: string;
  onSelectCompany?: (companyId: string) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  isSystemAdmin = false,
  currentUserRole = 'owner',
  userOrganizations = [],
  activeOrganizationId,
  onSelectCompany,
  onLogout,
}) => {
  const navSections = [
    ...(isSystemAdmin
      ? [
          {
            title: 'SISTEMA GLOBAL',
            items: [
              {
                id: 'admin_panel' as NavTab,
                label: 'Painel System Admin',
                icon: ShieldCheck,
                badge: 'Global Root',
              },
            ],
          },
        ]
      : []),
    {
      title: 'VISÃO GERAL',
      items: [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, badge: 'Executivo' },
      ],
    },
    {
      title: 'FINANCEIRO',
      items: [
        { id: 'revenues' as NavTab, label: 'Receitas', icon: TrendingUp },
        { id: 'expenses' as NavTab, label: 'Despesas', icon: TrendingDown },
        { id: 'receivables' as NavTab, label: 'Contas a Receber', icon: ArrowDownLeft },
        { id: 'payables' as NavTab, label: 'Contas a Pagar', icon: ArrowUpRight },
        { id: 'cashflow' as NavTab, label: 'Fluxo de Caixa', icon: Calculator },
        { id: 'dre' as NavTab, label: 'DRE Gerencial', icon: FileSpreadsheet, highlight: true },
      ],
    },
    {
      title: 'GESTÃO & OPERAÇÃO',
      items: [
        { id: 'clients' as NavTab, label: 'Clientes', icon: Users },
        { id: 'products' as NavTab, label: 'Produtos & Serviços', icon: Package },
        { id: 'cost_centers' as NavTab, label: 'Centros de Resultado', icon: Layers },
        { id: 'budget' as NavTab, label: 'Orçamento', icon: PiggyBank },
        { id: 'partners' as NavTab, label: 'Sócios & Patrimônio', icon: UserCheck },
        { id: 'team' as NavTab, label: 'Equipe', icon: UserPlus },
      ],
    },
    {
      title: 'CONFIGURAÇÕES',
      items: [
        { id: 'settings' as NavTab, label: 'Configurações', icon: Settings },
        ...(currentUserRole === 'owner'
          ? [
              {
                id: 'billing' as NavTab,
                label: 'Plano e Cobrança',
                icon: CreditCard,
              },
            ]
          : []),
      ],
    },
  ];

  const currentCompanyName = userOrganizations.find((c) => c.id === activeOrganizationId)?.name ||
    userOrganizations[0]?.name || 'Empresa';

  return (
    <aside className="w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col h-screen select-none shrink-0 text-slate-300">
      {/* Brand Header */}
      <div
        id="sidebar-brand-header"
        onClick={() => onSelectTab('dashboard')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectTab('dashboard');
          }
        }}
        title="Clique para ir ao Dashboard Executivo"
        className="p-5 border-t border-slate-800/80 bg-slate-950/30 cursor-pointer hover:bg-slate-900/80 transition-all group flex items-center"
      >
      <NoxLogo
        size="sm"
        showSubtitle={true}
        onClick={() => onSelectTab('dashboard')}
        className="transition-transform group-hover:scale-[1.02] max-w-full"
  />
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-bold font-heading">
              {sec.title}
            </div>
            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      ) : (
                        <Icon
                          className={`w-4 h-4 transition-transform group-hover:scale-110 shrink-0 ${
                            isActive
                              ? 'text-blue-400'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400 opacity-80" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* CIA Selector / Current Organization Display */}
      {userOrganizations.length >= 2 ? (
        <div
          id="sidebar-company-selector-container"
          className="px-4 py-3 border-t border-slate-800 bg-slate-900/60"
        >
          <label
            htmlFor="sidebar-company-selector"
            className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              Empresa atual
            </span>

            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 font-mono">
              {userOrganizations.length} CIAs
            </span>
          </label>

          <div className="relative">
            <select
              id="sidebar-company-selector"
              value={activeOrganizationId}
              onChange={(e) => onSelectCompany?.(e.target.value)}
              className="w-full appearance-none bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 pr-8 cursor-pointer shadow-inner"
            >
              {userOrganizations.map((comp) => (
                <option
                  key={comp.id}
                  value={comp.id}
                  className="bg-slate-900 text-white"
                >
                  {comp.name}
                </option>
              ))}
            </select>

            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      ) : userOrganizations.length === 1 ? (
        <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/40">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-blue-400" />
            <span>Empresa atual</span>
          </p>

          <p className="text-xs font-semibold text-slate-200 truncate">
            {currentCompanyName}
          </p>
        </div>
      ) : null}
      
      {/* Footer / User Profile & Security Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 mt-auto space-y-2.5">
        <div className="flex items-center justify-center px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ambiente seguro</span>
          </div>
        </div>

        {/* Dynamic User Profile & Logout */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 border border-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'GT'}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.name || 'Usuário'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {isSystemAdmin
                  ? 'System Admin'
                  : currentUserRole === 'owner'
                  ? 'Proprietário'
                  : currentUserRole === 'finance'
                  ? 'Financeiro'
                  : currentUserRole === 'viewer'
                  ? 'Visualizador'
                  : 'Membro'} • NOX4
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sair da Conta (Logout)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

