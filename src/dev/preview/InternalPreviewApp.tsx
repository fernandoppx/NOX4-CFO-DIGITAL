import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  X,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { Sidebar, NavTab } from '../../components/layout/Sidebar';
import { Header } from '../../components/layout/Header';
import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard';
import { DREView } from '../../components/dre/DREView';
import { CashFlowView } from '../../components/cashflow/CashFlowView';
import { RevenuesView } from '../../components/transactions/RevenuesView';
import { ExpensesView } from '../../components/transactions/ExpensesView';
import { ReceivablesPayablesView } from '../../components/transactions/ReceivablesPayablesView';
import { ClientsView } from '../../components/management/ClientsView';
import { ProductsView } from '../../components/management/ProductsView';
import { CostCentersView } from '../../components/management/CostCentersView';
import { BudgetView } from '../../components/management/BudgetView';
import { PartnersView } from '../../components/management/PartnersView';
import { SettingsView } from '../../components/settings/SettingsView';
import { PlanAndBillingView } from '../../components/settings/PlanAndBillingView';
import { TeamView } from '../../components/team/TeamView';
import { NewTransactionModal } from '../../components/modals/NewTransactionModal';
import { EditTransactionModal } from '../../components/modals/EditTransactionModal';
import { EditCompanyModal } from '../../components/settings/EditCompanyModal';

import {
  PREVIEW_USER,
  PREVIEW_COMPANY,
  PREVIEW_PLAN,
  PREVIEW_SUBSCRIPTION,
  PREVIEW_MEMBERS,
  PREVIEW_INVITATIONS,
  PREVIEW_COST_CENTERS,
  PREVIEW_CATEGORIES,
  PREVIEW_REVENUE_CATEGORIES,
  PREVIEW_EXPENSE_CATEGORIES,
  PREVIEW_CLIENTS,
  PREVIEW_PRODUCTS,
  PREVIEW_REVENUES,
  PREVIEW_EXPENSES,
  PREVIEW_PARTNERS,
  PREVIEW_BANK_ACCOUNTS,
  PREVIEW_BUDGETS,
  PREVIEW_CURRENT_MONTH,
} from './previewFixtures';

import {
  calculateDRE,
  calculateCashFlow,
  calculateIndicators,
  calculateClientProfitability,
  generateProactiveAlerts,
} from '../../lib/financialEngine';

import { Revenue, Expense, Client, Product, CostCenter, Category, Partner, Budget } from '../../types';

interface InternalPreviewAppProps {
  onExitPreview?: () => void;
}

export const InternalPreviewApp: React.FC<InternalPreviewAppProps> = ({ onExitPreview }) => {
  // Navegação do Preview
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(PREVIEW_CURRENT_MONTH);
  const [cashFlowViewMode, setCashFlowViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Estado local em memória (NUNCA gravado no Supabase)
  const [revenues, setRevenues] = useState<Revenue[]>(PREVIEW_REVENUES);
  const [expenses, setExpenses] = useState<Expense[]>(PREVIEW_EXPENSES);
  const [clients, setClients] = useState<Client[]>(PREVIEW_CLIENTS);
  const [products, setProducts] = useState<Product[]>(PREVIEW_PRODUCTS);
  const [costCenters, setCostCenters] = useState<CostCenter[]>(PREVIEW_COST_CENTERS);
  const [categories, setCategories] = useState<Category[]>(PREVIEW_CATEGORIES);
  const [partners, setPartners] = useState<Partner[]>(PREVIEW_PARTNERS);
  const [budgets, setBudgets] = useState<Budget[]>(PREVIEW_BUDGETS);

  // Modais de transações e formulários
  const [isNewTransactionModalOpen, setIsNewTransactionModalOpen] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<'revenue' | 'expense'>('revenue');
  const [newTransactionDefaultStatus, setNewTransactionDefaultStatus] = useState<'pending' | 'received' | 'paid'>('received');
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);

  // Toast de interceptação de persistência (Regra Estrita 8)
  const [interceptedMessage, setInterceptedMessage] = useState<string | null>(null);

  const notifyInterception = (actionName?: string) => {
    setInterceptedMessage('Modo de pré-visualização: nenhuma alteração foi gravada.');
    setTimeout(() => {
      setInterceptedMessage(null);
    }, 4000);
  };

  // Títulos das abas
  const tabTitles: Partial<Record<NavTab, string>> = {
    dashboard: 'Painel Geral',
    dre: 'DRE - Demonstração do Resultado',
    cashflow: 'Fluxo de Caixa',
    revenues: 'Receitas Operacionais',
    expenses: 'Despesas & Custos',
    receivables: 'Contas a Receber',
    payables: 'Contas a Pagar',
    clients: 'Gestão de Clientes',
    products: 'Produtos & Serviços',
    cost_centers: 'Centros de Resultado',
    budget: 'Planejamento Orçamentário',
    partners: 'Sócios & Pró-labore',
    team: 'Gestão de Equipe',
    settings: 'Configurações',
    billing: 'Plano e Cobrança',
  };

  // Cálculos financeiros em tempo real com os dados de demonstração
  const currentDRE = useMemo(() => {
    return calculateDRE(
      revenues,
      expenses,
      PREVIEW_REVENUE_CATEGORIES,
      PREVIEW_EXPENSE_CATEGORIES,
      selectedMonth,
      {
        costCenterId: selectedCostCenterId || undefined,
        clientId: selectedClientId || undefined,
      },
      budgets
    );
  }, [revenues, expenses, selectedMonth, selectedCostCenterId, selectedClientId, budgets]);

  const previousDRE = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let prevMonth = parseInt(monthStr, 10) - 1;
    let prevYear = parseInt(yearStr, 10);
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthFormatted = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    return calculateDRE(
      revenues,
      expenses,
      PREVIEW_REVENUE_CATEGORIES,
      PREVIEW_EXPENSE_CATEGORIES,
      prevMonthFormatted,
      {
        costCenterId: selectedCostCenterId || undefined,
        clientId: selectedClientId || undefined,
      },
      budgets
    );
  }, [revenues, expenses, selectedMonth, selectedCostCenterId, selectedClientId, budgets]);

  const cashFlowPeriods = useMemo(() => {
    return calculateCashFlow(
      revenues,
      expenses,
      [],
      PREVIEW_BANK_ACCOUNTS,
      cashFlowViewMode,
      selectedMonth
    );
  }, [revenues, expenses, cashFlowViewMode, selectedMonth]);

  const indicators = useMemo(() => {
    return calculateIndicators(
      currentDRE,
      previousDRE,
      clients,
      revenues,
      expenses,
      [],
      [],
      PREVIEW_BANK_ACCOUNTS,
      PREVIEW_EXPENSE_CATEGORIES
    );
  }, [currentDRE, previousDRE, clients, revenues, expenses]);

  const clientsProfitability = useMemo(() => {
    return calculateClientProfitability(clients, revenues, expenses, selectedMonth);
  }, [clients, revenues, expenses, selectedMonth]);

  const proactiveAlerts = useMemo(() => {
    return generateProactiveAlerts(currentDRE, previousDRE, indicators, clientsProfitability);
  }, [currentDRE, previousDRE, indicators, clientsProfitability]);

  // Handlers que interceptam ações reais sem gravar no Supabase
  const handleOpenNewTransactionModal = (type: 'revenue' | 'expense', defaultStatus: 'pending' | 'received' | 'paid' = 'received') => {
    setNewTransactionType(type);
    setNewTransactionDefaultStatus(defaultStatus);
    setIsNewTransactionModalOpen(true);
  };

  const handleSaveTransaction = (transactionData: any) => {
    setIsNewTransactionModalOpen(false);
    notifyInterception('Salvar transação');
  };

  const handleUpdateTransaction = (transactionData: any) => {
    setEditingRevenue(null);
    setEditingExpense(null);
    notifyInterception('Atualizar transação');
  };

  const handleDeleteTransaction = (id: string) => {
    notifyInterception('Excluir transação');
  };

  const handleMarkStatus = (id: string) => {
    notifyInterception('Alterar status');
  };

  // Dados do plano estritos para o preview (Req. 9)
  const billingPreviewData = {
    plan: PREVIEW_PLAN,
    subscription: PREVIEW_SUBSCRIPTION,
    activeUsersCount: 5, // Usuários ativos: 5 (3 incluídos + 2 adicionais)
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F1F5F9] text-slate-900 overflow-hidden font-sans antialiased">
      {/* 1. BANNER DE SEGURANÇA PERMANENTE NO TOPO (Req. 7) */}
      <aside
        id="preview-security-banner"
        aria-label="Aviso de Modo de Pré-Visualização"
        className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 shadow-md flex items-center justify-between z-50 shrink-0 border-b border-amber-600/30 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/15 p-1 rounded-md">
            <AlertTriangle className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wide uppercase text-xs sm:text-sm text-slate-950">
                MODO DE PRÉ-VISUALIZAÇÃO
              </span>
              <span className="bg-slate-950 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider">
                DEV ONLY
              </span>
            </div>
            <p className="text-xs text-slate-900 font-medium">
              Dados de demonstração. Nenhuma alteração será gravada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-exit-preview"
            onClick={() => {
              if (onExitPreview) {
                onExitPreview();
              } else {
                window.location.href = '/login';
              }
            }}
            className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sair do Preview</span>
          </button>
        </div>
      </aside>

      {/* 2. Toast de Intercepção de Ações (Req. 8) */}
      {interceptedMessage && (
        <div
          id="preview-action-notification"
          role="alert"
          className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white border-2 border-amber-500 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-amber-400 font-bold text-xs uppercase tracking-wide">
              Ação Bloqueada com Segurança
            </div>
            <div className="text-slate-200">{interceptedMessage}</div>
          </div>
          <button
            onClick={() => setInterceptedMessage(null)}
            className="ml-2 text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. LAYOUT COMPLETO REUTILIZANDO COMPONENTES REAIS (Req. 6) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Real com dados de preview */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          currentUser={PREVIEW_USER}
          isSystemAdmin={false}
          currentUserRole="owner"
          userOrganizations={[PREVIEW_COMPANY]}
          activeOrganizationId={PREVIEW_COMPANY.id}
          onSelectCompany={() => {}}
          onLogout={() => {
            if (onExitPreview) onExitPreview();
            else window.location.href = '/login';
          }}
        />

        {/* Header e Área de Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header
            companies={[PREVIEW_COMPANY]}
            currentCompanyId={PREVIEW_COMPANY.id}
            onSelectCompany={() => {}}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => setSelectedMonth(m)}
            onOpenNewTransactionModal={() => handleOpenNewTransactionModal('revenue')}
            activeTabTitle={tabTitles[currentTab] || 'NOX4 CFO'}
            currentUser={PREVIEW_USER}
            onLogout={() => {
              if (onExitPreview) onExitPreview();
              else window.location.href = '/login';
            }}
            onNavigateSettings={() => setCurrentTab('settings')}
            onUpdateAvatar={() => notifyInterception('Atualizar avatar')}
            onOpenCreateCompany={() => notifyInterception('Criar empresa')}
          />

          {/* Router de visualização das telas internas */}
          <main className="flex-1 overflow-y-auto p-6 bg-[#F1F5F9]">
            {/* Dashboard Executivo */}
            {currentTab === 'dashboard' && (
              <ExecutiveDashboard
                currentDRE={currentDRE}
                previousDRE={previousDRE}
                indicators={indicators}
                cashFlowPeriods={cashFlowPeriods}
                alerts={proactiveAlerts}
                clientsProfitability={clientsProfitability}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {/* DRE */}
            {currentTab === 'dre' && (
              <DREView
                currentDRE={currentDRE}
                previousDRE={previousDRE}
                costCenters={costCenters}
                clients={clients}
                products={products}
                selectedCostCenterId={selectedCostCenterId}
                onSelectCostCenter={(id) => setSelectedCostCenterId(id)}
                selectedClientId={selectedClientId}
                onSelectClient={(id) => setSelectedClientId(id)}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
              />
            )}

            {/* Fluxo de Caixa */}
            {currentTab === 'cashflow' && (
              <CashFlowView
                cashFlowPeriods={cashFlowPeriods}
                bankAccounts={PREVIEW_BANK_ACCOUNTS}
                viewMode={cashFlowViewMode}
                onChangeViewMode={(mode) => setCashFlowViewMode(mode)}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
              />
            )}

            {/* Receitas */}
            {currentTab === 'revenues' && (
              <RevenuesView
                revenues={revenues}
                clients={clients}
                products={products}
                costCenters={costCenters}
                categories={categories}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onOpenNewRevenueModal={() => handleOpenNewTransactionModal('revenue')}
                onEditRevenue={(rev) => setEditingRevenue(rev)}
                onDeleteRevenue={(id) => handleDeleteTransaction(id)}
                onMarkAsReceived={(id) => handleMarkStatus(id)}
              />
            )}

            {/* Despesas */}
            {currentTab === 'expenses' && (
              <ExpensesView
                expenses={expenses}
                costCenters={costCenters}
                categories={categories}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onOpenNewExpenseModal={() => handleOpenNewTransactionModal('expense')}
                onEditExpense={(exp) => setEditingExpense(exp)}
                onDeleteExpense={(id) => handleDeleteTransaction(id)}
                onMarkAsPaid={(id) => handleMarkStatus(id)}
              />
            )}

            {/* Contas a Receber */}
            {currentTab === 'receivables' && (
              <ReceivablesPayablesView
                type="receivables"
                revenues={revenues}
                expenses={expenses}
                clients={clients}
                costCenters={costCenters}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onMarkAsReceived={(id) => handleMarkStatus(id)}
                onMarkAsPaid={(id) => handleMarkStatus(id)}
                onOpenNewTransaction={() => handleOpenNewTransactionModal('revenue', 'pending')}
                onEditReceivable={(rev) => setEditingRevenue(rev)}
                onEditPayable={(exp) => setEditingExpense(exp)}
              />
            )}

            {/* Contas a Pagar */}
            {currentTab === 'payables' && (
              <ReceivablesPayablesView
                type="payables"
                revenues={revenues}
                expenses={expenses}
                clients={clients}
                costCenters={costCenters}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onMarkAsReceived={(id) => handleMarkStatus(id)}
                onMarkAsPaid={(id) => handleMarkStatus(id)}
                onOpenNewTransaction={() => handleOpenNewTransactionModal('expense', 'pending')}
                onEditReceivable={(rev) => setEditingRevenue(rev)}
                onEditPayable={(exp) => setEditingExpense(exp)}
              />
            )}

            {/* Clientes */}
            {currentTab === 'clients' && (
              <ClientsView
                clients={clients}
                revenues={revenues}
                onAddClient={(c) => notifyInterception('Criar cliente')}
                onUpdateClient={(c) => notifyInterception('Atualizar cliente')}
                onDeleteClient={(id) => notifyInterception('Excluir cliente')}
              />
            )}

            {/* Produtos & Serviços */}
            {currentTab === 'products' && (
              <ProductsView
                products={products}
                onAddProduct={(p) => notifyInterception('Criar produto')}
                onUpdateProduct={(p) => notifyInterception('Atualizar produto')}
                onDeleteProduct={(id) => notifyInterception('Excluir produto')}
              />
            )}

            {/* Centros de Resultado */}
            {currentTab === 'cost_centers' && (
              <CostCentersView
                costCenters={costCenters}
                revenues={revenues}
                expenses={expenses}
                onAddCostCenter={(cc) => notifyInterception('Criar centro de custo')}
                onUpdateCostCenter={(cc) => notifyInterception('Atualizar centro de custo')}
                onDeleteCostCenter={(id) => notifyInterception('Excluir centro de custo')}
              />
            )}

            {/* Orçamento */}
            {currentTab === 'budget' && (
              <BudgetView
                budgets={budgets}
                categories={categories}
                costCenters={costCenters}
                expenses={expenses}
                revenues={revenues}
                selectedMonth={selectedMonth}
                onSelectMonth={(m) => setSelectedMonth(m)}
                onSaveBudget={(b) => notifyInterception('Salvar orçamento')}
              />
            )}

            {/* Sócios & Governança */}
            {currentTab === 'partners' && (
              <PartnersView
                partners={partners}
                expenses={expenses}
                onAddPartner={(p) => notifyInterception('Adicionar sócio')}
                onUpdatePartner={(p) => notifyInterception('Atualizar sócio')}
                onDeletePartner={(id) => notifyInterception('Excluir sócio')}
                onRecordProfitDistribution={(data) => notifyInterception('Distribuir lucros')}
              />
            )}

            {/* Gestão de Equipe (Req. 6) */}
            {currentTab === 'team' && (
              <TeamView
                currentCompany={PREVIEW_COMPANY}
                currentUserRole="owner"
                currentUserId={PREVIEW_USER.id}
                isPreviewMode={true}
                previewMembers={PREVIEW_MEMBERS}
                previewInvitations={PREVIEW_INVITATIONS}
                onActionIntercepted={notifyInterception}
              />
            )}

            {/* Configurações (com suporte às subabas de Equipe e Plano e Cobrança) */}
            {currentTab === 'settings' && (
              <SettingsView
                companies={[PREVIEW_COMPANY]}
                categories={categories}
                costCenters={costCenters}
                currentCompanyId={PREVIEW_COMPANY.id}
                users={[PREVIEW_USER]}
                currentUserRole="owner"
                currentUserId={PREVIEW_USER.id}
                onSelectCompany={() => {}}
                onAddCompany={(c) => notifyInterception('Criar empresa')}
                onUpdateCompany={(c) => notifyInterception('Atualizar empresa')}
                onDeleteCompany={(id) => notifyInterception('Excluir empresa')}
                onAddUserToCompany={() => notifyInterception('Adicionar usuário')}
                onUpdateUser={() => notifyInterception('Atualizar usuário')}
                onRemoveUserFromCompany={() => notifyInterception('Remover usuário')}
                onLinkExistingUser={() => notifyInterception('Vincular usuário')}
                onAddCategory={() => notifyInterception('Adicionar categoria')}
                onUpdateCategory={() => notifyInterception('Atualizar categoria')}
                onDeleteCategory={() => notifyInterception('Excluir categoria')}
                onResetDatabase={() => notifyInterception('Resetar banco')}
                onImportCSV={() => notifyInterception('Importar CSV')}
                isPreviewMode={true}
                billingPreviewData={billingPreviewData}
                previewMembers={PREVIEW_MEMBERS}
                previewInvitations={PREVIEW_INVITATIONS}
                onActionIntercepted={notifyInterception}
              />
            )}

            {/* Plano e Cobrança Isolado (Req. 9) */}
            {currentTab === 'billing' && (
              <PlanAndBillingView
                activeOrganizationId={PREVIEW_COMPANY.id}
                currentUserRole="owner"
                isPreviewMode={true}
                previewData={billingPreviewData}
              />
            )}
          </main>
        </div>
      </div>

      {/* Modal Nova Transação (Revisão de interface com salvamento bloqueado) */}
      <NewTransactionModal
        isOpen={isNewTransactionModalOpen}
        onClose={() => setIsNewTransactionModalOpen(false)}
        type={newTransactionType}
        categories={categories}
        costCenters={costCenters}
        clients={clients}
        products={products}
        onSave={handleSaveTransaction}
        defaultStatus={newTransactionDefaultStatus}
      />

      {/* Modal Edição de Transação */}
      {(editingRevenue || editingExpense) && (
        <EditTransactionModal
          isOpen={true}
          onClose={() => {
            setEditingRevenue(null);
            setEditingExpense(null);
          }}
          transaction={(editingRevenue || editingExpense)!}
          type={editingRevenue ? 'revenue' : 'expense'}
          categories={categories}
          costCenters={costCenters}
          clients={clients}
          products={products}
          onSave={handleUpdateTransaction}
        />
      )}

      {/* Modal Edição de Empresa */}
      <EditCompanyModal
        isOpen={isEditCompanyModalOpen}
        onClose={() => setIsEditCompanyModalOpen(false)}
        company={PREVIEW_COMPANY}
        onSave={() => {
          setIsEditCompanyModalOpen(false);
          notifyInterception('Editar empresa');
        }}
      />
    </div>
  );
};
