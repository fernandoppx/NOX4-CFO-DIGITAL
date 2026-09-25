import { describe, it, expect } from 'vitest';
import { isInternalPreviewEnabled } from '../../dev/preview/previewGuard';
import {
  PREVIEW_USER,
  PREVIEW_COMPANY,
  PREVIEW_PLAN,
  PREVIEW_SUBSCRIPTION,
  PREVIEW_MEMBERS,
  PREVIEW_REVENUES,
  PREVIEW_EXPENSES,
} from '../../dev/preview/previewFixtures';
import {
  calculateExtraUsers,
  calculateExtraMonthlyCost,
  formatCurrencyBRL,
} from '../billingService';

describe('Modo de Pré-Visualização Interna - Testes de Segurança e Isolamento', () => {
  // Teste 1: Bloqueio estrito em Produção (Req. 1 e 10)
  it('1. Deve bloquear o preview quando import.meta.env.PROD === true, mesmo se a flag for true', () => {
    const prodEnv = {
      DEV: false,
      PROD: true,
      VITE_ENABLE_INTERNAL_PREVIEW: 'true',
    };
    expect(isInternalPreviewEnabled(prodEnv)).toBe(false);
  });

  // Teste 2: Bloqueio em Dev quando flag não for 'true' (Req. 1)
  it('2. Deve bloquear o preview em Dev se VITE_ENABLE_INTERNAL_PREVIEW estiver ausente ou false', () => {
    expect(isInternalPreviewEnabled({ DEV: true, PROD: false, VITE_ENABLE_INTERNAL_PREVIEW: undefined })).toBe(false);
    expect(isInternalPreviewEnabled({ DEV: true, PROD: false, VITE_ENABLE_INTERNAL_PREVIEW: '' })).toBe(false);
    expect(isInternalPreviewEnabled({ DEV: true, PROD: false, VITE_ENABLE_INTERNAL_PREVIEW: 'false' })).toBe(false);
    expect(isInternalPreviewEnabled({ DEV: true, PROD: false, VITE_ENABLE_INTERNAL_PREVIEW: '0' })).toBe(false);
  });

  // Teste 3: Habilitação exclusiva quando DEV === true E VITE_ENABLE_INTERNAL_PREVIEW === 'true'
  it('3. Deve habilitar o preview exclusivamente quando DEV === true e VITE_ENABLE_INTERNAL_PREVIEW === "true"', () => {
    const validDevEnv = {
      DEV: true,
      PROD: false,
      VITE_ENABLE_INTERNAL_PREVIEW: 'true',
    };
    expect(isInternalPreviewEnabled(validDevEnv)).toBe(true);
  });

  // Teste 4: Verificação do Usuário Fictício do Preview (Req. 4)
  it('4. Deve prover usuário de demonstração com nome "Administrador NOX4" e role "owner"', () => {
    expect(PREVIEW_USER.name).toBe('Administrador NOX4');
    expect(PREVIEW_USER.role).toBe('owner');
    expect(PREVIEW_USER.id).toBe('preview-user-admin');
  });

  // Teste 5: Verificação da CIA Fictícia do Preview (Req. 4)
  it('5. Deve prover CIA de demonstração com nome "Empresa Demonstração" e id "preview-organization"', () => {
    expect(PREVIEW_COMPANY.name).toBe('Empresa Demonstração');
    expect(PREVIEW_COMPANY.id).toBe('preview-organization');
  });

  // Teste 6: Conformidade dos Dados de Plano e Cobrança do Preview (Req. 9)
  it('6. Plano e Cobrança no preview deve corresponder com precisão aos valores especificados', () => {
    expect(PREVIEW_PLAN.name).toBe('NOX4');
    expect(PREVIEW_SUBSCRIPTION.status).toBe('active');
    expect(PREVIEW_PLAN.max_organizations).toBe(1); // CIAs incluídas: 1
    expect(PREVIEW_PLAN.included_users).toBe(3);     // Usuários incluídos: 3
    
    // Usuários ativos no preview: 5
    const activeUsers = 5;
    expect(PREVIEW_MEMBERS.length).toBe(activeUsers);

    // Usuários adicionais calculados: 2
    const extraUsers = calculateExtraUsers(activeUsers, PREVIEW_PLAN.included_users);
    expect(extraUsers).toBe(2);

    // Usuário adicional: R$ 29,90
    expect(PREVIEW_PLAN.extra_user_price).toBe(29.9);

    // Adicional mensal: R$ 59,80
    const extraMonthlyCost = calculateExtraMonthlyCost(extraUsers, PREVIEW_PLAN.extra_user_price);
    expect(extraMonthlyCost).toBe(59.8);
    expect(formatCurrencyBRL(extraMonthlyCost)).toContain('59,80');
    expect(formatCurrencyBRL(extraMonthlyCost)).toContain('R$');
  });

  // Teste 7: Isolamento de dados - Nenhum mock no preview afeta persistência real
  it('7. Dados do preview devem estar encapsulados e conter receitas e despesas de demonstração', () => {
    expect(PREVIEW_REVENUES.length).toBeGreaterThan(0);
    expect(PREVIEW_EXPENSES.length).toBeGreaterThan(0);
    PREVIEW_REVENUES.forEach((rev) => {
      expect(rev.company_id).toBe('preview-organization');
    });
    PREVIEW_EXPENSES.forEach((exp) => {
      expect(exp.company_id).toBe('preview-organization');
    });
  });
});
