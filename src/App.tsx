import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { DREView } from './components/dre/DREView';
import { CashFlowView } from './components/cashflow/CashFlowView';
import { RevenuesView } from './components/transactions/RevenuesView';
import { ExpensesView } from './components/transactions/ExpensesView';
import { ReceivablesPayablesView } from './components/transactions/ReceivablesPayablesView';
import { ClientsView } from './components/management/ClientsView';
import { ProductsView } from './components/management/ProductsView';
import { CostCentersView } from './components/management/CostCentersView';
import { BudgetView } from './components/management/BudgetView';
import { PartnersView } from './components/management/PartnersView';
import { SettingsView } from './components/settings/SettingsView';
import { PlanAndBillingView } from './components/settings/PlanAndBillingView';
import { SystemAdminPanel } from './components/admin/SystemAdminPanel';
import { NewTransactionModal } from './components/modals/NewTransactionModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { LoginView } from './components/auth/LoginView';
import { VerifyEmailView } from './components/auth/VerifyEmailView';
import { CreateOrganizationOnboarding } from './components/auth/CreateOrganizationOnboarding';
import { EmailConfirmedView } from './components/auth/EmailConfirmedView';
import { WaitingOrganizationView } from './components/auth/WaitingOrganizationView';
import { PlansView } from './components/billing/PlansView';
import { CheckoutView } from './components/billing/CheckoutView';
import { SubscriptionProcessingView } from './components/billing/SubscriptionProcessingView';
import { TeamView } from './components/team/TeamView';
import { NoxLogo } from './components/brand/NoxLogo';
import { InternalPreviewApp } from './dev/preview/InternalPreviewApp';
import { isInternalPreviewEnabled } from './dev/preview/previewGuard';
import { supabase } from './lib/supabase';
import {
  loadUserProfile,
  loadUserOrganizations,
  isSystemAdmin,
  claimPendingInvitations,
  getUserRoleInOrganization,
  createOrganizationRPC,
} from './lib/supabaseAuth';

import {
  loadDatabase,
  saveDatabase,
  resetDatabaseToDefault,
  createEmptyDatabase,
  DatabaseState,
} from './lib/mockDatabase';

import {
  calculateDRE,
  calculateCashFlow,
  calculateIndicators,
  calculateClientProfitability,
  generateProactiveAlerts,
  normalizeTransactionStatus,
} from './lib/financialEngine';

import {
  User,
  CompanyRole,
  Revenue,
  Expense,
  Client,
  Product,
  CostCenter,
  Company,
  Budget,
  Partner,
  RevenueCategory,
  ExpenseCategory,
  ExpenseGroup,
  Category,
  Plan,
  AccountsReceivable,
  AccountsPayable,
  PartnerTransaction,
  TransactionStatus,
} from './types';

export default function App() {
  // Authentication & Multi-Tenant State (Supabase Auth & RLS)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSysAdmin, setIsSysAdmin] = useState<boolean>(false);
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'finance' | 'system_admin' | string>('owner');
  const [userOrganizations, setUserOrganizations] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState<boolean>(false);

  // Detecção de rotas públicas com prioridade absoluta
  const getInitialRoute = (): string => {
    if (typeof window === 'undefined') return '/';
    const path = window.location.pathname || '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    if (path === '/__dev/preview' || path.startsWith('/__dev/preview')) {
      return '/__dev/preview';
    }
    if (path === '/auth/verify-email' || path.startsWith('/auth/verify-email')) {
      return '/auth/verify-email';
    }
    if (
      path === '/auth/confirmed' ||
      path.startsWith('/auth/confirmed') ||
      hash.includes('type=signup') ||
      hash.includes('type=email_change') ||
      hash.includes('type=recovery') ||
      hash.includes('email-confirmed') ||
      search.includes('type=signup') ||
      search.includes('confirmation=true')
    ) {
      return '/auth/confirmed';
    }
    if (path === '/auth/register' || path.startsWith('/auth/register')) {
      return '/auth/register';
    }
    if (path === '/login' || path.startsWith('/login')) {
      return '/login';
    }
    if (path === '/plans' || path.startsWith('/plans')) {
      return '/plans';
    }
    if (path === '/checkout' || path.startsWith('/checkout')) {
      return '/checkout';
    }
    if (path === '/subscription/processing' || path.startsWith('/subscription/processing')) {
      return '/subscription/processing';
    }
    return path || '/';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(() => getInitialRoute());
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('nox4_selected_plan_id') || '';
    }
    return '';
  });

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState(null, '', route);
    }
  };
  const [tempVerifyEmail, setTempVerifyEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    }
    return '';
  });

  const [isEmailConfirmedScreen, setIsEmailConfirmedScreen] = useState<boolean>(() => currentRoute === '/auth/confirmed');

  // Listen to browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const newRoute = getInitialRoute();
      setCurrentRoute(newRoute);
      if (newRoute === '/auth/confirmed') {
        setIsEmailConfirmedScreen(true);
      }
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
          setTempVerifyEmail(emailParam);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load initial database from storage / seed.
  // No preview interno, não carregar o localStorage real.
  const [db, setDb] = useState<DatabaseState>(() =>
  currentRoute === '/__dev/preview'
    ? createEmptyDatabase()
    : loadDatabase()
  );

  // Navigation & Filter States
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');

  // Unified sync of user context, roles, and organizations
  const syncUserContext = async (userId: string, userEmail?: string, metadata?: any) => {
    try {
      const profile = await loadUserProfile(userId, userEmail, metadata);
      const isGlobalAdmin = await isSystemAdmin(userId);

      // Claim pending invitations for user's email
      if (userEmail) {
        await claimPendingInvitations(userEmail, userId);
      }

      // Load permitted organizations
      const orgs = await loadUserOrganizations(userId, isGlobalAdmin);

      setCurrentUser(profile);
      setIsSysAdmin(isGlobalAdmin);
      setUserOrganizations(orgs);

      let targetOrgId = selectedCompanyId;
      if (!targetOrgId || !orgs.some((o) => o.id === targetOrgId)) {
        targetOrgId = orgs.length > 0 ? orgs[0].id : '';
      }
      setSelectedCompanyId(targetOrgId);

      if (targetOrgId) {
        const role = await getUserRoleInOrganization(userId, targetOrgId, isGlobalAdmin);
        setCurrentUserRole(role);
      } else if (isGlobalAdmin) {
        setCurrentUserRole('system_admin');
      } else {
        setCurrentUserRole('finance');
      }
    } catch (err) {
      console.error('Erro ao sincronizar contexto do usuário:', err);
    }
  };

  // Supabase Auth & Session Verification Lifecycle
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Prioridade Absoluta: se for rota pública de confirmação ou OTP, NÃO abre dashboard
      if (
  currentRoute === '/__dev/preview' ||
  currentRoute === '/auth/verify-email' ||
  currentRoute === '/auth/confirmed' ||
  isEmailConfirmedScreen
  ) {
        if (isMounted) {
          setIsAuthLoading(false);
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Sessão Supabase não encontrada ou expirada:', error);
        }
        if (session?.user) {
          if (isMounted) {
            await syncUserContext(session.user.id, session.user.email, session.user.user_metadata);
          }
        } else {
          if (isMounted) {
            setCurrentUser(null);
            setIsSysAdmin(false);
            setUserOrganizations([]);
            setSelectedCompanyId('');
          }
        }
      } catch (err) {
        console.error('Erro ao verificar sessão Supabase:', err);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    initAuth();

    // Listen to real-time auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Se estiver na rota de confirmação ou OTP, encerra qualquer sessão residual e não carrega usuário
          if (
  currentRoute === '/__dev/preview' ||
  currentRoute === '/auth/verify-email' ||
  currentRoute === '/auth/confirmed' ||
  isEmailConfirmedScreen
  ) {
          if (isMounted) {
            setIsAuthLoading(false);
          }
          return;
        }

        if (session?.user) {
          if (isMounted) {
            await syncUserContext(session.user.id, session.user.email, session.user.user_metadata);
            setIsAuthLoading(false);
          }
        } else {
          if (isMounted) {
            setCurrentUser(null);
            setIsSysAdmin(false);
            setUserOrganizations([]);
            setSelectedCompanyId('');
            setIsAuthLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [currentRoute, isEmailConfirmedScreen]);

  // Update role when active company changes
  useEffect(() => {
    if (currentUser?.id && selectedCompanyId) {
      getUserRoleInOrganization(currentUser.id, selectedCompanyId, isSysAdmin).then((role) => {
        setCurrentUserRole(role);
      });
    }
  }, [currentUser?.id, selectedCompanyId, isSysAdmin]);

  // Sincronização de leitura do Supabase para clients, products e partners com proteção contra race conditions
  const latestLoadRequestIdRef = useRef<number>(0);
  const selectedCompanyIdRef = useRef<string>(selectedCompanyId);

  useEffect(() => {
    selectedCompanyIdRef.current = selectedCompanyId;
  }, [selectedCompanyId]);

  const loadCompanyManagementData = async (companyId: string) => {
    if (!companyId) return;

    const requestId = ++latestLoadRequestIdRef.current;

    try {
      const [clientsResult, productsResult, partnersResult] = await Promise.all([
        supabase.from('clients').select('*').eq('company_id', companyId),
        supabase.from('products').select('*').eq('company_id', companyId),
        supabase.from('partners').select('*').eq('company_id', companyId),
      ]);

      if (clientsResult.error) {
        console.error('Erro ao carregar clients do Supabase:', clientsResult.error);
      }
      if (productsResult.error) {
        console.error('Erro ao carregar products do Supabase:', productsResult.error);
      }
      if (partnersResult.error) {
        console.error('Erro ao carregar partners do Supabase:', partnersResult.error);
      }

      // Evita race condition se a empresa selecionada mudou ou se outra consulta mais recente já foi iniciada
      if (
        requestId !== latestLoadRequestIdRef.current ||
        selectedCompanyIdRef.current !== companyId
      ) {
        return;
      }

      setDb((prev) => ({
        ...prev,
        clients: clientsResult.error
          ? prev.clients
          : [
              ...prev.clients.filter((item) => item.company_id !== companyId),
              ...((clientsResult.data as Client[]) || []),
            ],
        products: productsResult.error
          ? prev.products
          : [
              ...prev.products.filter((item) => item.company_id !== companyId),
              ...((productsResult.data as Product[]) || []),
            ],
        partners: partnersResult.error
          ? prev.partners
          : [
              ...prev.partners.filter((item) => item.company_id !== companyId),
              ...((partnersResult.data as Partner[]) || []),
            ],
      }));
    } catch (err) {
      console.error('Erro inesperado ao carregar dados da empresa:', err);
    }
  };

  useEffect(() => {
    if (!currentUser || !selectedCompanyId) return;

    loadCompanyManagementData(selectedCompanyId);

    return () => {
      // Invalida consultas em andamento para a empresa anterior
      latestLoadRequestIdRef.current++;
    };
  }, [selectedCompanyId, currentUser]);

  const loadCompanyRevenues = async (companyId: string) => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('revenues')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        console.error('Erro ao carregar receitas do Supabase:', error);
        return;
      }

      // Evita aplicar estado desatualizado caso o usuário já tenha trocado de empresa
      if (selectedCompanyIdRef.current !== companyId) {
        return;
      }

      setDb((prev) => ({
        ...prev,
        revenues: [
          ...prev.revenues.filter((r) => r.company_id !== companyId),
          ...((data as Revenue[]) || []),
        ],
      }));
    } catch (err) {
      console.error('Erro inesperado ao carregar receitas da empresa:', err);
    }
  };

  useEffect(() => {
    if (!currentUser || !selectedCompanyId) return;

    loadCompanyRevenues(selectedCompanyId);
  }, [selectedCompanyId, currentUser]);

  // Supabase Auth Handlers
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao encerrar sessão Supabase:', e);
    } finally {
      setCurrentUser(null);
      setIsSysAdmin(false);
      setUserOrganizations([]);
      setSelectedCompanyId('');
      setCurrentRoute('/login');
      if (typeof window !== 'undefined' && window.history?.pushState) {
        window.history.pushState(null, '', '/login');
      }
    }
  };

  const handleOrganizationCreated = async (newOrgId?: string, companyName?: string) => {
    if (!currentUser) return;
    setIsAuthLoading(true);
    try {
      let orgs = await loadUserOrganizations(currentUser.id, isSysAdmin);

      if (orgs.length === 0 && (newOrgId || companyName)) {
        const fallbackOrg: Company = {
          id: newOrgId || crypto.randomUUID(),
          name: companyName?.trim() || 'Minha Empresa',
          document: '',
          segment: 'Serviços / Consultoria',
          created_at: new Date().toISOString(),
        };
        orgs = [fallbackOrg];
      }

      setUserOrganizations(orgs);

      const targetOrgId = (newOrgId && orgs.some((o) => o.id === newOrgId))
        ? newOrgId
        : orgs.length > 0
        ? orgs[0].id
        : '';

      if (targetOrgId) {
        setSelectedCompanyId(targetOrgId);
        setCurrentUserRole('owner');

        const createdCompanyObj = orgs.find((o) => o.id === targetOrgId);
        if (createdCompanyObj) {
          setDb((prev) => ({
            ...prev,
            companies: [
              ...prev.companies.filter((c) => c.id !== createdCompanyObj.id),
              createdCompanyObj,
            ],
            currentCompanyId: createdCompanyObj.id,
          }));
        }
      }
      setIsCreateOrgModalOpen(false);
    } catch (e) {
      console.error('Erro ao sincronizar organizações após criação:', e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Interactive DRE Filter States
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [cashFlowViewMode, setCashFlowViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Transaction Modal State
  const [isNewTransactionModalOpen, setIsNewTransactionModalOpen] = useState<boolean>(false);
  const [newTransactionInitialType, setNewTransactionInitialType] = useState<'revenue' | 'expense'>('revenue');
  const [newTransactionDefaultStatus, setNewTransactionDefaultStatus] = useState<TransactionStatus | undefined>(undefined);
  
  // Edit Transaction State
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleOpenNewTransactionModal = (type: 'revenue' | 'expense' = 'revenue', status?: TransactionStatus) => {
    setNewTransactionInitialType(type);
    setNewTransactionDefaultStatus(status);
    setIsNewTransactionModalOpen(true);
  };

  // Save to localStorage when db updates
  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  // Scoped Data by Company (Multi-Tenant Isolation)
  const currentCompany: Company = useMemo(() => {
    return (
      userOrganizations.find((c) => c.id === selectedCompanyId) ||
      db.companies.find((c) => c.id === selectedCompanyId) ||
      userOrganizations[0] ||
      db.companies[0] || {
        id: selectedCompanyId || 'comp_default',
        name: 'Minha Empresa',
        document: '',
        segment: 'Serviços',
        created_at: new Date().toISOString(),
      }
    );
  }, [userOrganizations, db.companies, selectedCompanyId]);

  const companyRevenues = useMemo(
    () => db.revenues.filter((r) => r.company_id === selectedCompanyId),
    [db.revenues, selectedCompanyId]
  );

  const companyExpenses = useMemo(
    () => db.expenses.filter((e) => e.company_id === selectedCompanyId),
    [db.expenses, selectedCompanyId]
  );

  const companyClients = useMemo(
    () => db.clients.filter((c) => c.company_id === selectedCompanyId),
    [db.clients, selectedCompanyId]
  );

  const companyCostCenters = useMemo(
    () => db.costCenters.filter((cc) => cc.company_id === selectedCompanyId),
    [db.costCenters, selectedCompanyId]
  );

  const companyProducts = useMemo(
    () => db.products.filter((p) => p.company_id === selectedCompanyId),
    [db.products, selectedCompanyId]
  );

  const companyPartners = useMemo(
    () => db.partners.filter((p) => p.company_id === selectedCompanyId),
    [db.partners, selectedCompanyId]
  );

  const companyReceivables = useMemo(
    () => db.accountsReceivable.filter((r) => r.company_id === selectedCompanyId),
    [db.accountsReceivable, selectedCompanyId]
  );

  const companyPayables = useMemo(
    () => db.accountsPayable.filter((p) => p.company_id === selectedCompanyId),
    [db.accountsPayable, selectedCompanyId]
  );

  const companyPartnerTransactions = useMemo(
    () => db.partnerTransactions.filter((pt) => pt.company_id === selectedCompanyId),
    [db.partnerTransactions, selectedCompanyId]
  );

  // Categories list unified
  const allCategories: Category[] = useMemo(() => {
    const revCats: Category[] = db.revenueCategories.map((rc) => ({
      id: rc.id,
      company_id: rc.company_id,
      name: rc.name,
      type: 'REVENUE',
      code: 'REC',
      group: 'revenue',
      active: rc.active,
    }));
    const expCats: Category[] = db.expenseCategories.map((ec) => ({
      id: ec.id,
      company_id: ec.company_id,
      name: ec.name,
      type: ec.group.toUpperCase(),
      code: 'EXP',
      group: ec.group,
      active: ec.active,
    }));
    return [...revCats, ...expCats];
  }, [db.revenueCategories, db.expenseCategories]);

  // Deterministic Financial Calculations (Source of Truth)
  const currentDRE = useMemo(() => {
    return calculateDRE(
      companyRevenues,
      companyExpenses,
      db.revenueCategories,
      db.expenseCategories,
      selectedMonth,
      {
        costCenterId: selectedCostCenterId || undefined,
        clientId: selectedClientId || undefined,
      },
      db.budgets
    );
  }, [
    companyRevenues,
    companyExpenses,
    db.revenueCategories,
    db.expenseCategories,
    selectedMonth,
    selectedCostCenterId,
    selectedClientId,
    db.budgets,
  ]);

  // Previous Month DRE for comparison
  const previousMonthStr = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const previousDRE = useMemo(() => {
    return calculateDRE(
      companyRevenues,
      companyExpenses,
      db.revenueCategories,
      db.expenseCategories,
      previousMonthStr,
      {
        costCenterId: selectedCostCenterId || undefined,
        clientId: selectedClientId || undefined,
      },
      db.budgets
    );
  }, [
    companyRevenues,
    companyExpenses,
    db.revenueCategories,
    db.expenseCategories,
    previousMonthStr,
    selectedCostCenterId,
    selectedClientId,
    db.budgets,
  ]);

  // Cash Flow Periods (Daily / Weekly / Monthly)
  const cashFlowPeriods = useMemo(() => {
    return calculateCashFlow(
      companyRevenues,
      companyExpenses,
      companyPartnerTransactions,
      db.bankAccounts,
      cashFlowViewMode,
      selectedMonth
    );
  }, [
    companyRevenues,
    companyExpenses,
    companyPartnerTransactions,
    db.bankAccounts,
    cashFlowViewMode,
    selectedMonth,
  ]);

  // KPI Indicators
  const indicators = useMemo(() => {
    return calculateIndicators(
      currentDRE,
      previousDRE,
      companyClients,
      companyRevenues,
      companyExpenses,
      companyReceivables,
      companyPayables,
      db.bankAccounts,
      db.expenseCategories
    );
  }, [
    currentDRE,
    previousDRE,
    companyClients,
    companyRevenues,
    companyExpenses,
    companyReceivables,
    companyPayables,
    db.bankAccounts,
    db.expenseCategories,
  ]);

  // Client Profitability Matrix
  const clientsProfitability = useMemo(() => {
    return calculateClientProfitability(companyClients, companyRevenues, companyExpenses, selectedMonth);
  }, [companyClients, companyRevenues, companyExpenses, selectedMonth]);

  // Proactive Alerts & Diagnostics
  const proactiveAlerts = useMemo(() => {
    return generateProactiveAlerts(currentDRE, previousDRE, indicators, clientsProfitability);
  }, [currentDRE, previousDRE, indicators, clientsProfitability]);

  // Tab Titles map
  const tabTitles: Record<NavTab, string> = {
    dashboard: 'Dashboard Executivo',
    revenues: 'Lançamentos de Receitas',
    expenses: 'Lançamentos de Despesas & Custos',
    receivables: 'Contas a Receber',
    payables: 'Contas a Pagar',
    cashflow: 'Fluxo de Caixa & Tesouraria',
    dre: 'DRE Gerencial Oficial',
    clients: 'Gestão de Clientes & Contratos',
    products: 'Produtos & Serviços',
    cost_centers: 'Centros de Resultado (BU)',
    budget: 'Orçamento (Budget) x Realizado',
    partners: 'Sócios, Pró-labore & Patrimônio',
    team: 'Equipe da Empresa',
    settings: 'Configurações & Governança',
    billing: 'Plano e Cobrança',
    admin_panel: 'Painel Global do System Admin',
  };

  // State Action Handlers
  const handleAddRevenue = async (
    newRev: Omit<Revenue, 'id' | 'created_at'>
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para criar receita.');
      alert('Nenhuma empresa selecionada para criar receita.');
      return false;
    }

    const categoryId = newRev.category_id?.trim();
    if (!categoryId) {
      console.error('A categoria da receita é obrigatória.');
      alert('A categoria da receita é obrigatória.');
      return false;
    }

    const normStatus = normalizeTransactionStatus(newRev.status);
    const payload = {
      ...newRev,
      company_id: selectedCompanyId,
      category_id: categoryId,
      client_id: newRev.client_id || null,
      product_id: newRev.product_id || null,
      cost_center_id: newRev.cost_center_id || null,
      received_date: newRev.received_date || null,
      payment_date: newRev.payment_date || null,
      status: normStatus,
    };

    const { data, error } = await supabase
      .from('revenues')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro detalhado ao inserir receita no Supabase:', error);
      alert(`Erro ao salvar receita: ${error.message}`);
      return false;
    }

    const savedRev = data as Revenue;

    setDb((prev) => {
      const updatedRevenues = [savedRev, ...prev.revenues];
      const updatedAccounts =
        normStatus === 'received'
          ? prev.bankAccounts.map((b, idx) =>
              idx === 0 ? { ...b, current_balance: b.current_balance + savedRev.net_amount } : b
            )
          : prev.bankAccounts;
      return {
        ...prev,
        revenues: updatedRevenues,
        bankAccounts: updatedAccounts,
      };
    });
    return true;
  };

  const handleAddExpense = (newExp: Omit<Expense, 'id' | 'created_at'>) => {
    const normStatus = normalizeTransactionStatus(newExp.status);
    const exp: Expense = {
      ...newExp,
      status: normStatus,
      id: `exp_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setDb((prev) => {
      const updatedExpenses = [exp, ...prev.expenses];
      const updatedAccounts =
        normStatus === 'paid'
          ? prev.bankAccounts.map((b, idx) =>
              idx === 0 ? { ...b, current_balance: b.current_balance - exp.amount } : b
            )
          : prev.bankAccounts;
      return {
        ...prev,
        expenses: updatedExpenses,
        bankAccounts: updatedAccounts,
      };
    });
  };

  const handleMarkAsReceived = (revenueId: string) => {
    const rev = db.revenues.find((r) => r.id === revenueId);
    if (!rev) return;
    const today = new Date().toISOString().slice(0, 10);

    setDb((prev) => ({
      ...prev,
      revenues: prev.revenues.map((r) =>
        r.id === revenueId
          ? {
              ...r,
              status: 'received',
              received_date: r.received_date || today,
              payment_date: r.payment_date || today,
            }
          : r
      ),
      bankAccounts: prev.bankAccounts.map((b, idx) =>
        idx === 0 ? { ...b, current_balance: b.current_balance + rev.net_amount } : b
      ),
    }));
  };

  const handleMarkAsPaid = (expenseId: string) => {
    const exp = db.expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    const today = new Date().toISOString().slice(0, 10);

    setDb((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              status: 'paid',
              paid_date: e.paid_date || today,
              payment_date: e.payment_date || today,
            }
          : e
      ),
      bankAccounts: prev.bankAccounts.map((b, idx) =>
        idx === 0 ? { ...b, current_balance: b.current_balance - exp.amount } : b
      ),
    }));
  };

  const handleUpdateRevenue = async (
    updatedRev: Revenue
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para atualizar receita.');
      alert('Nenhuma empresa selecionada para atualizar receita.');
      return false;
    }

    const categoryId = updatedRev.category_id?.trim();
    if (!categoryId) {
      console.error('A categoria da receita é obrigatória.');
      alert('A categoria da receita é obrigatória.');
      return false;
    }

    const { id, created_at, ...updateData } = updatedRev;

    const payload = {
      ...updateData,
      company_id: selectedCompanyId,
      category_id: categoryId,
      client_id: updatedRev.client_id || null,
      product_id: updatedRev.product_id || null,
      cost_center_id: updatedRev.cost_center_id || null,
      received_date: updatedRev.received_date || null,
      payment_date: updatedRev.payment_date || null,
    };

    const { data, error } = await supabase
      .from('revenues')
      .update(payload)
      .eq('id', updatedRev.id)
      .eq('company_id', selectedCompanyId)
      .select()
      .single();

    if (error) {
      console.error('Erro detalhado ao atualizar receita no Supabase:', error);
      alert(`Erro ao atualizar receita: ${error.message}`);
      return false;
    }

    const savedRev = (data as Revenue) || updatedRev;

    setDb((prev) => ({
      ...prev,
      revenues: prev.revenues.map((r) => (r.id === savedRev.id ? savedRev : r)),
    }));
    return true;
  };

  const handleUpdateExpense = (updatedExp: Expense) => {
    setDb((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === updatedExp.id ? updatedExp : e)),
    }));
  };

  const handleDeleteRevenue = async (
    id: string
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para excluir receita.');
      alert('Nenhuma empresa selecionada para excluir receita.');
      return false;
    }

    const { error } = await supabase
      .from('revenues')
      .delete()
      .eq('id', id)
      .eq('company_id', selectedCompanyId);

    if (error) {
      console.error('Erro detalhado ao excluir receita no Supabase:', error);
      alert(`Erro ao excluir receita: ${error.message}`);
      return false;
    }

    setDb((prev) => ({
      ...prev,
      revenues: prev.revenues.filter((r) => r.id !== id),
    }));
    return true;
  };

  const handleDeleteExpense = (id: string) => {
    setDb((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  const handleAddClient = async (
  clientData: Omit<Client, 'id' | 'created_at'>
) => {
  const { data, error } = await supabase
    .from('clients')
    .insert({
  ...clientData,
  status: 'active',
  company_id: selectedCompanyId,
})
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar cliente:', error);
    alert(error.message);
    return;
  }

  setDb((prev) => ({
    ...prev,
    clients: [...prev.clients, data],
  }));
};

  const handleUpdateClient = (updatedClient: Client) => {
    setDb((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === updatedClient.id ? updatedClient : c)),
    }));
  };

  const handleDeleteClient = (id: string) => {
    setDb((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== id),
    }));
  };

  const handleAddProduct = async (
    prodData: Omit<Product, 'id' | 'created_at'>
  ) => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para criar produto.');
      alert('Nenhuma empresa selecionada para criar produto.');
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...prodData,
        company_id: selectedCompanyId,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar produto:', error);
      alert(error.message);
      return;
    }

    setDb((prev) => ({
      ...prev,
      products: [...prev.products, data],
    }));
  };

  const handleUpdateProduct = async (prod: Product) => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para atualizar produto.');
      alert('Nenhuma empresa selecionada para atualizar produto.');
      return;
    }

    const { id, created_at, ...updateData } = prod;

    const { data, error } = await supabase
      .from('products')
      .update({
        ...updateData,
        company_id: selectedCompanyId,
      })
      .eq('id', prod.id)
      .eq('company_id', selectedCompanyId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar produto:', error);
      alert(error.message);
      return;
    }

    setDb((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === data.id ? data : p)),
    }));
  };

  const handleDeleteProduct = async (id: string) => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para excluir produto.');
      alert('Nenhuma empresa selecionada para excluir produto.');
      return;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('company_id', selectedCompanyId);

    if (error) {
      console.error('Erro ao excluir produto:', error);
      alert(error.message);
      return;
    }

    setDb((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  };

  const handleAddCostCenter = async (
    ccData: Omit<CostCenter, 'id'>
  ) => {
    try {
      if (!selectedCompanyId) {
        console.warn('Nenhuma empresa selecionada para inclusão do centro de resultado.');
        return;
      }

      let createdId = `cc_${Date.now()}`;

      try {
        const { data, error } = await supabase
          .from('cost_centers')
          .insert({
            company_id: selectedCompanyId,
            name: ccData.name,
            code: ccData.code || null,
          })
          .select()
          .single();

        if (!error && data?.id) {
          createdId = data.id;
        } else if (error) {
          console.warn('Persistindo centro de resultado localmente devido a restrição do banco:', error);
        }
      } catch (sbErr) {
        console.warn('Supabase indisponível para cost_centers, operando com armazenamento local:', sbErr);
      }

      const newCC: CostCenter = {
        ...ccData,
        id: createdId,
        company_id: selectedCompanyId,
      };

      setDb((prev) => ({
        ...prev,
        costCenters: [
          ...prev.costCenters,
          newCC,
        ],
      }));
    } catch (err) {
      console.error(
        'Erro inesperado ao criar centro de resultado:',
        err
      );
    }
  };

const handleUpdateCostCenter = (cc: CostCenter) => {
    setDb((prev) => ({
      ...prev,
      costCenters: prev.costCenters.map((c) => (c.id === cc.id ? cc : c)),
    }));
  };

  const handleDeleteCostCenter = (id: string) => {
    setDb((prev) => ({
      ...prev,
      costCenters: prev.costCenters.filter((c) => c.id !== id),
    }));
  };

  const handleAddPartner = async (
    partnerData: Omit<Partner, 'id' | 'company_id' | 'created_at'>
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para adicionar sócio.');
      alert('Nenhuma empresa selecionada para adicionar sócio.');
      return false;
    }

    const { data, error } = await supabase
      .from('partners')
      .insert({
        company_id: selectedCompanyId,
        name: partnerData.name,
        equity_percentage: partnerData.equity_percentage,
        prolabore_amount: partnerData.prolabore_amount,
        role: partnerData.role,
        document: partnerData.document,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar sócio:', error);
      alert(error.message);
      return false;
    }

    setDb((prev) => ({
      ...prev,
      partners: [...prev.partners, data],
    }));
    return true;
  };

  const handleUpdatePartner = async (
    updatedPartner: Partner
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para atualizar sócio.');
      alert('Nenhuma empresa selecionada para atualizar sócio.');
      return false;
    }

    const { data, error } = await supabase
      .from('partners')
      .update({
        name: updatedPartner.name,
        equity_percentage: updatedPartner.equity_percentage,
        prolabore_amount: updatedPartner.prolabore_amount,
        role: updatedPartner.role,
        document: updatedPartner.document,
      })
      .eq('id', updatedPartner.id)
      .eq('company_id', selectedCompanyId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar sócio:', error);
      alert(error.message);
      return false;
    }

    setDb((prev) => ({
      ...prev,
      partners: prev.partners.map((p) => (p.id === data.id ? data : p)),
    }));
    return true;
  };

  const handleDeletePartner = async (
    partnerId: string
  ): Promise<boolean | void> => {
    if (!selectedCompanyId) {
      console.error('Nenhuma empresa selecionada para excluir sócio.');
      alert('Nenhuma empresa selecionada para excluir sócio.');
      return false;
    }

    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', partnerId)
      .eq('company_id', selectedCompanyId);

    if (error) {
      console.error('Erro ao excluir sócio:', error);
      alert(error.message);
      return false;
    }

    setDb((prev) => ({
      ...prev,
      partners: prev.partners.filter((p) => p.id !== partnerId),
    }));
    return true;
  };

  const handleAddCategory = (catData: Omit<Category, 'id'>) => {
    const id = `cat_${Date.now()}`;
    const companyId = catData.company_id || selectedCompanyId;
    const isRevenueCategory =
      catData.group === 'revenue' || catData.type === 'REVENUE';

    setDb((prev) => {
      if (isRevenueCategory) {
        const newRevenueCategory: RevenueCategory = {
          id,
          company_id: companyId,
          name: catData.name,
          type: (catData.type as any) || 'services',
          active: catData.active ?? true,
        };

        return {
          ...prev,
          revenueCategories: [...prev.revenueCategories, newRevenueCategory],
        };
      }

      const newExpenseCategory: ExpenseCategory = {
        id,
        company_id: companyId,
        name: catData.name,
        group: (catData.group as ExpenseGroup) || 'operational',
        type: (catData.type as any) || 'fixed',
        active: catData.active ?? true,
      };

      return {
        ...prev,
        expenseCategories: [...prev.expenseCategories, newExpenseCategory],
      };
    });
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    const companyId = updatedCat.company_id || selectedCompanyId;
    const isRevenueCategory =
      updatedCat.group === 'revenue' || updatedCat.type === 'REVENUE';

    setDb((prev) => {
      if (isRevenueCategory) {
        const revenueCategory: RevenueCategory = {
          id: updatedCat.id,
          company_id: companyId,
          name: updatedCat.name,
          type: (updatedCat.type as any) || 'services',
          active: updatedCat.active ?? true,
        };

        return {
          ...prev,
          revenueCategories: prev.revenueCategories.some((c) => c.id === updatedCat.id)
            ? prev.revenueCategories.map((c) =>
                c.id === updatedCat.id ? revenueCategory : c
              )
            : [...prev.revenueCategories, revenueCategory],
          expenseCategories: prev.expenseCategories.filter(
            (c) => c.id !== updatedCat.id
          ),
        };
      }

      const expenseCategory: ExpenseCategory = {
        id: updatedCat.id,
        company_id: companyId,
        name: updatedCat.name,
        group: (updatedCat.group as ExpenseGroup) || 'operational',
        type: (updatedCat.type as any) || 'fixed',
        active: updatedCat.active ?? true,
      };

      return {
        ...prev,
        expenseCategories: prev.expenseCategories.some(
          (c) => c.id === updatedCat.id
        )
          ? prev.expenseCategories.map((c) =>
              c.id === updatedCat.id ? expenseCategory : c
            )
          : [...prev.expenseCategories, expenseCategory],
        revenueCategories: prev.revenueCategories.filter(
          (c) => c.id !== updatedCat.id
        ),
      };
    });
  };

  const handleDeleteCategory = (catId: string) => {
    setDb((prev) => ({
      ...prev,
      revenueCategories: prev.revenueCategories.filter((c) => c.id !== catId),
      expenseCategories: prev.expenseCategories.filter((c) => c.id !== catId),
    }));
  };

  const handleRecordProfitDistribution = (partnerId: string, amount: number, date: string) => {
    const partner = db.partners.find((p) => p.id === partnerId);
    const exp: Expense = {
      id: `exp_dist_${Date.now()}`,
      company_id: selectedCompanyId,
      category_id: 'ec_distribuicao_lucros',
      cost_center_id: 'cc_adm',
      supplier: partner ? partner.name : 'Sócio',
      description: `Distribuição de Lucros / Dividendos - ${partner ? partner.name : 'Sócio'}`,
      amount,
      cost_nature: 'VARIABLE',
      competence_date: date,
      due_date: date,
      paid_date: date,
      status: 'paid',
      is_equity_movement: true, // Crucial: separated from operational DRE
      created_at: new Date().toISOString(),
    };

    const pTransaction: PartnerTransaction = {
      id: `pt_${Date.now()}`,
      company_id: selectedCompanyId,
      partner_id: partnerId,
      type: 'profit_distribution',
      description: `Distribuição de Lucros - ${partner?.name || 'Sócio'}`,
      amount,
      date,
    };

    setDb((prev) => ({
      ...prev,
      expenses: [exp, ...prev.expenses],
      partnerTransactions: [pTransaction, ...prev.partnerTransactions],
      bankAccounts: prev.bankAccounts.map((b, idx) =>
        idx === 0 ? { ...b, current_balance: b.current_balance - amount } : b
      ),
    }));
  };

  const handleSaveBudget = (budget: Budget) => {
    setDb((prev) => {
      const exists = prev.budgets.find(
        (b) => b.category_id === budget.category_id && (b.year_month === budget.year_month || b.reference_month === budget.year_month)
      );
      if (exists) {
        return {
          ...prev,
          budgets: prev.budgets.map((b) => (b.id === exists.id ? budget : b)),
        };
      }
      return {
        ...prev,
        budgets: [...prev.budgets, budget],
      };
    });
  };

  // Company Management Handlers
  const handleAddCompany = async (c: Omit<Company, 'id' | 'created_at'>) => {
    try {
      const createdOrgId = await createOrganizationRPC(c.name, {
        document: c.document || (c as any).cnpj || '',
        segment: c.segment || 'Serviços & Consultoria',
        userId: currentUser?.id,
      });

      const newComp: Company = {
        ...c,
        id: createdOrgId || `comp_${Date.now()}`,
        document: c.document || (c as any).cnpj || '',
        currency: c.currency || 'BRL',
        created_at: new Date().toISOString(),
      };

      // Update user organizations list immediately
      setUserOrganizations((prev) => {
        if (prev.some((item) => item.id === newComp.id)) return prev;
        return [...prev, newComp];
      });

      // Update local db state
      setDb((prev) => ({
        ...prev,
        companies: [...prev.companies.filter((x) => x.id !== newComp.id), newComp],
        currentCompanyId: newComp.id,
      }));

      // Select newly created company
      setSelectedCompanyId(newComp.id);
      setCurrentUserRole('owner');

      // Refresh in background if user is online
      if (currentUser) {
        loadUserOrganizations(currentUser.id, isSysAdmin).then((refreshed) => {
          if (refreshed && refreshed.length > 0) {
            setUserOrganizations((curr) => {
              const merged = [...refreshed];
              for (const item of curr) {
                if (!merged.some((m) => m.id === item.id)) {
                  merged.push(item);
                }
              }
              return merged;
            });
          }
        });
      }

      return newComp;
    } catch (err) {
      console.error('Erro ao adicionar empresa:', err);
      const fallbackComp: Company = {
        ...c,
        id: `comp_${Date.now()}`,
        currency: c.currency || 'BRL',
        created_at: new Date().toISOString(),
      };
      setUserOrganizations((prev) => [...prev, fallbackComp]);
      setDb((prev) => ({
        ...prev,
        companies: [...prev.companies, fallbackComp],
        currentCompanyId: fallbackComp.id,
      }));
      setSelectedCompanyId(fallbackComp.id);
      setCurrentUserRole('owner');
      return fallbackComp;
    }
  };

  const handleUpdateCompany = async (updatedCompany: Company) => {
    try {
      await supabase
        .from('organizations')
        .update({
          name: updatedCompany.name,
          document: updatedCompany.document || (updatedCompany as any).cnpj || '',
          segment: updatedCompany.segment,
        })
        .eq('id', updatedCompany.id);
    } catch (err) {
      console.warn('Erro ao atualizar empresa no Supabase:', err);
    }

    setUserOrganizations((prev) =>
      prev.map((c) => (c.id === updatedCompany.id ? updatedCompany : c))
    );
    setDb((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === updatedCompany.id ? updatedCompany : c)),
    }));
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (userOrganizations.length <= 1 && db.companies.length <= 1) {
      console.warn('Operação cancelada: não é permitido apagar a única empresa cadastrada no sistema.');
      return;
    }

    try {
      await supabase.from('organizations').delete().eq('id', companyId);
    } catch (err) {
      console.warn('Erro ao excluir empresa no Supabase:', err);
    }

    const remaining = userOrganizations.filter((c) => c.id !== companyId);
    setUserOrganizations(remaining);

    setDb((prev) => {
      const remainingCompanies = prev.companies.filter((c) => c.id !== companyId);
      const nextCompId =
        prev.currentCompanyId === companyId
          ? remainingCompanies[0]?.id || ''
          : prev.currentCompanyId;

      return {
        ...prev,
        companies: remainingCompanies,
        currentCompanyId: nextCompId,
      };
    });

    if (selectedCompanyId === companyId) {
      const nextSelected = remaining[0]?.id || '';
      setSelectedCompanyId(nextSelected);
    }
  };

  // User Management Handlers (Per-Company & Global)
  const handleAddUser = (userData: Omit<User, 'id' | 'created_at'>) => {
    const newUser: User = {
      ...userData,
      id: `usr_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      users: [...(prev.users || []), newUser],
    }));
  };

  const handleDeleteUser = (userId: string) => {
    if ((db.users || []).length <= 1) {
      console.warn('Operação cancelada: não é permitido apagar o único usuário do sistema.');
      return;
    }

    setDb((prev) => ({
      ...prev,
      users: (prev.users || []).filter((u) => u.id !== userId),
    }));
  };

  const handleAddUserToCompany = (
    companyId: string,
    userData: Omit<User, 'id' | 'created_at'>
  ) => {
    const newUser: User = {
      ...userData,
      id: `usr_${Date.now()}`,
      company_id: companyId,
      company_ids: [companyId],
      created_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      users: [...(prev.users || []), newUser],
    }));
  };

  const handleUpdateUser = (updatedUser: User) => {
    setDb((prev) => {
      const nextDb: DatabaseState = {
        ...prev,
        users: (prev.users || []).some((u) => u.id === updatedUser.id)
          ? (prev.users || []).map((u) => (u.id === updatedUser.id ? updatedUser : u))
          : [...(prev.users || []), updatedUser],
        currentUser: prev.currentUser?.id === updatedUser.id ? updatedUser : prev.currentUser,
      };
      saveDatabase(nextDb);
      return nextDb;
    });

    if (currentUser?.id === updatedUser.id || currentUser?.email === updatedUser.email) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem('nox4_auth_session', JSON.stringify(updatedUser));
      } catch (e) {
        console.error('Error updating current user session:', e);
      }
    }
  };


  const handleRemoveUserFromCompany = (companyId: string, userId: string) => {
    setDb((prev) => ({
      ...prev,
      users: (prev.users || []).map((u) => {
        if (u.id === userId) {
          const currentIds = u.company_ids || (u.company_id ? [u.company_id] : []);
          const nextIds = currentIds.filter((id) => id !== companyId);
          return {
            ...u,
            company_ids: nextIds,
            company_id: u.company_id === companyId ? nextIds[0] || '' : u.company_id,
          };
        }
        return u;
      }),
    }));
  };

  const handleLinkExistingUser = (companyId: string, userId: string, role?: CompanyRole) => {
    setDb((prev) => ({
      ...prev,
      users: (prev.users || []).map((u) => {
        if (u.id === userId) {
          const currentIds = u.company_ids || (u.company_id ? [u.company_id] : []);
          const nextIds = currentIds.includes(companyId) ? currentIds : [...currentIds, companyId];
          return {
            ...u,
            company_ids: nextIds,
            role: role || u.role,
          };
        }
        return u;
      }),
    }));
  };

  const handleResetDatabase = () => {
    const fresh = resetDatabaseToDefault();
    setDb(fresh);
  };

  const handleImportCSV = (type: 'revenues' | 'expenses', csvContent: string) => {
    const lines = csvContent.split('\n');
    lines.forEach((line) => {
      const parts = line.split(';').map((p) => p.trim());
      if (parts.length >= 2) {
        const description = parts[0];
        const amount = parseFloat(parts[1].replace('R$', '').replace('.', '').replace(',', '.')) || 1000;
        const compDate = parts[2] || `${selectedMonth}-01`;
        const dueDate = parts[3] || `${selectedMonth}-10`;

        if (type === 'revenues') {
          const taxAmt = amount * 0.06;
          const commAmt = amount * 0.05;
          handleAddRevenue({
            company_id: selectedCompanyId,
            description,
            cost_center_id: companyCostCenters[0]?.id || 'cc_trafego',
            category_id: 'rc_recorrente',
            gross_amount: amount,
            tax_amount: taxAmt,
            commission_amount: commAmt,
            other_deductions: 0,
            net_amount: amount - taxAmt - commAmt,
            competence_date: compDate,
            due_date: dueDate,
            status: 'received',
            received_date: compDate,
          });
        } else {
          handleAddExpense({
            company_id: selectedCompanyId,
            description,
            supplier: 'Fornecedor Importado',
            cost_center_id: companyCostCenters[0]?.id || 'cc_trafego',
            category_id: 'ec_freelancers',
            amount,
            cost_nature: 'FIXED',
            competence_date: compDate,
            due_date: dueDate,
            status: 'paid',
            paid_date: compDate,
            is_equity_movement: false,
          });
        }
      }
    });
  };

  // 0. Modo de Pré-Visualização Interna (/ __dev/preview)
  if (currentRoute === '/__dev/preview') {
    // Se o preview não estiver estritamente habilitado (DEV === true && VITE_ENABLE_INTERNAL_PREVIEW === 'true')
    // ou se estiver em produção (PROD === true), bloqueia imediatamente e redireciona para o login normal
    if (!isInternalPreviewEnabled()) {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
      return (
        <LoginView
          initialMode="login"
          onAuthSuccess={() => setCurrentRoute('/dashboard')}
          onNavigateToVerifyEmail={(email) => {
            setTempVerifyEmail(email);
            setCurrentRoute('/auth/verify-email');
          }}
        />
      );
    }

    return (
      <InternalPreviewApp
        onExitPreview={() => {
          setCurrentRoute('/login');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(null, '', '/login');
          }
        }}
      />
    );
  }

  // 1. Verify Email OTP Page - Prioridade máxima sobre qualquer AuthGuard
  if (currentRoute === '/auth/verify-email') {
    return (
      <VerifyEmailView
        email={tempVerifyEmail}
        onSuccessGoToLogin={() => {
          setTempVerifyEmail('');
          setCurrentRoute('/login');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(null, '', '/login');
          }
        }}
        onChangeEmail={() => {
          setTempVerifyEmail('');
          setCurrentRoute('/auth/register');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(null, '', '/auth/register');
          }
        }}
        onClearSessionAndState={async () => {
          setCurrentUser(null);
          setIsSysAdmin(false);
          setUserOrganizations([]);
          setSelectedCompanyId('');
        }}
      />
    );
  }

  // 2. Email confirmation link page - Compatibilidade legado
  if (currentRoute === '/auth/confirmed' || isEmailConfirmedScreen) {
    return (
      <EmailConfirmedView
        onGoToLogin={() => {
          setIsEmailConfirmedScreen(false);
          setCurrentRoute('/login');
          setCurrentUser(null);
          setIsSysAdmin(false);
          setUserOrganizations([]);
          setSelectedCompanyId('');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(null, '', '/login');
          }
        }}
      />
    );
  }

  // 3. Loading state during auth verification
  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <NoxLogo size="md" layout="vertical" theme="dark" showSubtitle={true} />
        <div className="mt-8 flex items-center gap-2.5 text-xs text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span>Carregando suas informações com segurança...</span>
        </div>
      </div>
    );
  }

  // 4. Public Auth Routes (/login, /auth/register) or Unauthenticated: render Supabase LoginView
  if (!currentUser || currentRoute === '/login' || currentRoute === '/auth/register') {
    return (
      <LoginView
        initialMode={currentRoute === '/auth/register' ? 'register' : 'login'}
        onAuthSuccess={() => {
          setCurrentRoute('/dashboard');
        }}
        onNavigateToVerifyEmail={(email) => {
          setTempVerifyEmail(email);
          setCurrentRoute('/auth/verify-email');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(null, '', '/auth/verify-email');
          }
        }}
      />
    );
  }

  // 5. Authenticated Billing Onboarding Routes (/plans, /checkout, /subscription/processing)
  // Essas rotas exigem usuário autenticado, mas NÃO exigem que o usuário já possua organização.
  if (currentRoute === '/plans') {
    return (
      <PlansView
        currentUser={currentUser}
        onSelectPlan={(plan) => {
          setSelectedPlanId(plan.id);
          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem('nox4_selected_plan_id', plan.id);
            }
          } catch {
            // ignore
          }
          navigateTo('/checkout');
        }}
        onBack={() => navigateTo('/')}
        onLogout={handleLogout}
      />
    );
  }

  if (currentRoute === '/checkout') {
    return (
      <CheckoutView
        currentUser={currentUser}
        selectedPlanId={selectedPlanId}
        onNavigateToPlans={() => navigateTo('/plans')}
        onNavigateToProcessing={() => navigateTo('/subscription/processing')}
        onNavigateToLogin={() => navigateTo('/login')}
        onLogout={handleLogout}
      />
    );
  }

  if (currentRoute === '/subscription/processing') {
    return (
      <SubscriptionProcessingView
        onBackToAccount={() => navigateTo('/')}
        onLogout={handleLogout}
      />
    );
  }

  // 6. Authenticated without organization and NOT system_admin:
  // Strict rule: NO mock data, NO dashboard, NO fake company.
  if (!isSysAdmin && userOrganizations.length === 0) {
    if (isCreateOrgModalOpen) {
      return (
        <CreateOrganizationOnboarding
          currentUser={currentUser}
          onOrganizationCreated={handleOrganizationCreated}
          onLogout={handleLogout}
          onCancel={() => setIsCreateOrgModalOpen(false)}
        />
      );
    }

    return (
      <WaitingOrganizationView
        userEmail={currentUser.email}
        userName={currentUser.name}
        onRefresh={() => syncUserContext(currentUser.id, currentUser.email)}
        onLogout={handleLogout}
        onNavigateToPlans={() => navigateTo('/plans')}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] text-slate-900 overflow-hidden font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        currentUser={currentUser}
        isSystemAdmin={isSysAdmin}
        currentUserRole={currentUserRole}
        userOrganizations={userOrganizations}
        activeOrganizationId={selectedCompanyId}
        onSelectCompany={(id) => {
          setSelectedCompanyId(id);
          setDb((prev) => ({ ...prev, currentCompanyId: id }));
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          companies={userOrganizations}
          currentCompanyId={selectedCompanyId}
          onSelectCompany={(id) => setSelectedCompanyId(id)}
          selectedMonth={selectedMonth}
          onSelectMonth={(m) => setSelectedMonth(m)}
          onOpenNewTransactionModal={() => handleOpenNewTransactionModal('revenue')}
          activeTabTitle={tabTitles[currentTab]}
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigateSettings={() => setCurrentTab('settings')}
          onUpdateUser={handleUpdateUser}
        />

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F1F5F9]">
          {currentTab === 'admin_panel' && isSysAdmin && (
            <SystemAdminPanel
              currentUser={currentUser}
              allCompanies={userOrganizations}
              selectedCompanyId={selectedCompanyId}
              onSelectCompany={(id) => setSelectedCompanyId(id)}
              onOpenAppForCompany={(id) => {
                setSelectedCompanyId(id);
                setCurrentTab('dashboard');
              }}
              onAddCompany={handleAddCompany}
            />
          )}

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

          {currentTab === 'dre' && (
            <DREView
              currentDRE={currentDRE}
              previousDRE={previousDRE}
              costCenters={companyCostCenters}
              clients={companyClients}
              products={companyProducts}
              selectedCostCenterId={selectedCostCenterId}
              onSelectCostCenter={(id) => setSelectedCostCenterId(id)}
              selectedClientId={selectedClientId}
              onSelectClient={(id) => setSelectedClientId(id)}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
            />
          )}

          {currentTab === 'cashflow' && (
            <CashFlowView
              cashFlowPeriods={cashFlowPeriods}
              bankAccounts={db.bankAccounts}
              viewMode={cashFlowViewMode}
              onChangeViewMode={(mode) => setCashFlowViewMode(mode)}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
            />
          )}

          {currentTab === 'revenues' && (
            <RevenuesView
              revenues={companyRevenues}
              clients={companyClients}
              products={companyProducts}
              costCenters={companyCostCenters}
              categories={allCategories}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
              onOpenNewRevenueModal={() => handleOpenNewTransactionModal('revenue')}
              onEditRevenue={(rev) => setEditingRevenue(rev)}
              onDeleteRevenue={handleDeleteRevenue}
              onMarkAsReceived={handleMarkAsReceived}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesView
              expenses={companyExpenses}
              costCenters={companyCostCenters}
              categories={allCategories}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
              onOpenNewExpenseModal={() => handleOpenNewTransactionModal('expense')}
              onEditExpense={(exp) => setEditingExpense(exp)}
              onDeleteExpense={handleDeleteExpense}
              onMarkAsPaid={handleMarkAsPaid}
            />
          )}

          {currentTab === 'receivables' && (
            <ReceivablesPayablesView
              type="receivables"
              revenues={companyRevenues}
              expenses={companyExpenses}
              clients={companyClients}
              costCenters={companyCostCenters}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
              onMarkAsReceived={handleMarkAsReceived}
              onMarkAsPaid={handleMarkAsPaid}
              onOpenNewTransaction={() => handleOpenNewTransactionModal('revenue', 'pending')}
              onEditReceivable={(rev) => setEditingRevenue(rev)}
              onEditPayable={(exp) => setEditingExpense(exp)}
            />
          )}

          {currentTab === 'payables' && (
            <ReceivablesPayablesView
              type="payables"
              revenues={companyRevenues}
              expenses={companyExpenses}
              clients={companyClients}
              costCenters={companyCostCenters}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
              onMarkAsReceived={handleMarkAsReceived}
              onMarkAsPaid={handleMarkAsPaid}
              onOpenNewTransaction={() => handleOpenNewTransactionModal('expense', 'pending')}
              onEditReceivable={(rev) => setEditingRevenue(rev)}
              onEditPayable={(exp) => setEditingExpense(exp)}
            />
          )}

          {currentTab === 'clients' && (
            <ClientsView
              clients={companyClients}
              revenues={companyRevenues}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={companyProducts}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {currentTab === 'cost_centers' && (
            <CostCentersView
              costCenters={companyCostCenters}
              revenues={companyRevenues}
              expenses={companyExpenses}
              onAddCostCenter={handleAddCostCenter}
              onUpdateCostCenter={handleUpdateCostCenter}
              onDeleteCostCenter={handleDeleteCostCenter}
            />
          )}

          {currentTab === 'budget' && (
            <BudgetView
              budgets={db.budgets}
              categories={allCategories}
              costCenters={companyCostCenters}
              expenses={companyExpenses}
              revenues={companyRevenues}
              selectedMonth={selectedMonth}
              onSelectMonth={(m) => setSelectedMonth(m)}
              onSaveBudget={handleSaveBudget}
            />
          )}

          {currentTab === 'partners' && (
            <PartnersView
              partners={companyPartners}
              expenses={companyExpenses}
              onAddPartner={handleAddPartner}
              onUpdatePartner={handleUpdatePartner}
              onDeletePartner={handleDeletePartner}
              onRecordProfitDistribution={handleRecordProfitDistribution}
            />
          )}

          {currentTab === 'team' && (
            <TeamView
              currentCompany={currentCompany}
              currentUserRole={currentUserRole}
              currentUserId={currentUser.id}
              currentUserAvatar={currentUser.avatar}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              companies={userOrganizations}
              categories={allCategories}
              costCenters={companyCostCenters}
              currentCompanyId={selectedCompanyId}
              users={db.users || []}
              currentUserRole={currentUserRole}
              currentUserId={currentUser.id}
              onSelectCompany={(compId) => setSelectedCompanyId(compId)}
              onAddCompany={handleAddCompany}
              onUpdateCompany={handleUpdateCompany}
              onDeleteCompany={handleDeleteCompany}
              onAddUser={handleAddUser}
              onAddUserToCompany={handleAddUserToCompany}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onRemoveUserFromCompany={handleRemoveUserFromCompany}
              onLinkExistingUser={handleLinkExistingUser}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onResetDatabase={handleResetDatabase}
              onImportCSV={handleImportCSV}
            />
          )}

          {currentTab === 'billing' && (
            <PlanAndBillingView
              activeOrganizationId={selectedCompanyId}
              currentUserRole={currentUserRole}
            />
          )}
        </main>
      </div>

      {/* Global New Transaction Modal */}
      <NewTransactionModal
        isOpen={isNewTransactionModalOpen}
        onClose={() => setIsNewTransactionModalOpen(false)}
        clients={companyClients}
        products={companyProducts}
        costCenters={companyCostCenters}
        categories={allCategories}
        currentCompanyId={selectedCompanyId}
        selectedCompanyId={selectedCompanyId}
        initialType={newTransactionInitialType}
        defaultStatus={newTransactionDefaultStatus}
        onAddRevenue={handleAddRevenue}
        onAddExpense={handleAddExpense}
      />

      {/* Global Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={Boolean(editingRevenue || editingExpense)}
        onClose={() => {
          setEditingRevenue(null);
          setEditingExpense(null);
        }}
        revenue={editingRevenue}
        expense={editingExpense}
        clients={companyClients}
        products={companyProducts}
        costCenters={companyCostCenters}
        categories={allCategories}
        currentCompanyId={selectedCompanyId}
        onSaveRevenue={handleUpdateRevenue}
        onSaveExpense={handleUpdateExpense}
      />
    </div>
  );
}
