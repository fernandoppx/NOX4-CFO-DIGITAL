import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatTeamErrorMessage,
  inviteOrganizationMember,
  removeOrganizationMember,
  cancelInvitation,
} from '../supabaseAuth';
import { supabase } from '../supabase';

describe('Revisão de UX nas mensagens de erro do módulo de equipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatTeamErrorMessage - Sanitização de mensagens técnicas', () => {
    it('1. Substitui "permission denied for table organization_members"', () => {
      const error = new Error('permission denied for table organization_members');
      const formatted = formatTeamErrorMessage(error, 'remove');
      expect(formatted).toBe('Você não possui permissão para realizar esta ação.');
    });

    it('2. Substitui "violates row-level security policy for table organization_members"', () => {
      const error = { message: 'new row violates row-level security policy for table organization_members' };
      const formatted = formatTeamErrorMessage(error, 'invite');
      expect(formatted).toBe('Você não possui permissão para realizar esta ação.');
    });

    it('3. Substitui "duplicate key value violates unique constraint"', () => {
      const error = { code: '23505', message: 'duplicate key value violates unique constraint "organization_invitations_email_key"' };
      const formatted = formatTeamErrorMessage(error, 'invite');
      expect(formatted).toBe('Este usuário já possui um convite ou acesso nesta empresa.');
    });

    it('4. Substitui "Failed to load organization members"', () => {
      const error = new Error('Failed to load organization members');
      const formatted = formatTeamErrorMessage(error, 'load');
      expect(formatted).toBe('Não foi possível carregar a equipe. Tente novamente.');
    });

    it('5. Substitui "RPC function failed"', () => {
      const error = new Error('RPC function failed: could not find function invite_organization_member');
      const formatted = formatTeamErrorMessage(error, 'general');
      expect(formatted).toBe('Não foi possível concluir a operação.');
    });

    it('6. Garante que nenhum termo técnico vaze na mensagem para o usuário', () => {
      const technicalSamples = [
        'Postgres internal error: syntax error at or near "SELECT"',
        'Supabase client timeout error',
        'violates not-null constraint on column user_id',
        'null value in column organization_id',
        'undefined object reference in SQL execution',
        'foreign key constraint failure',
      ];

      for (const sample of technicalSamples) {
        const msg = formatTeamErrorMessage(sample, 'invite');
        expect(msg).not.toMatch(/postgres|supabase|sql|postgrest|constraint|null value|undefined|error|failed/i);
      }
    });

    it('7. Mensagens de fallback amigáveis por contexto', () => {
      expect(formatTeamErrorMessage(null, 'invite')).toBe('Não foi possível registrar o convite. Tente novamente.');
      expect(formatTeamErrorMessage(null, 'remove')).toBe('Não foi possível remover o membro. Tente novamente.');
      expect(formatTeamErrorMessage(null, 'cancel')).toBe('Não foi possível cancelar o convite. Tente novamente.');
      expect(formatTeamErrorMessage(null, 'load')).toBe('Não foi possível carregar a equipe. Tente novamente.');
      expect(formatTeamErrorMessage(null, 'claim')).toBe('Não foi possível verificar seus acessos agora. Tente novamente.');
    });
  });

  describe('inviteOrganizationMember - Tratamento amigável', () => {
    it('8. Retorna mensagem amigável quando RPC falha com permission denied', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied for schema public' } as any,
      } as any);

      const res = await inviteOrganizationMember('org-1', 'usuario@empresa.com', 'finance');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Você não possui permissão para realizar esta ação.');
    });

    it('9. Retorna mensagem amigável quando RPC falha com duplicate key', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' } as any,
      } as any);

      const res = await inviteOrganizationMember('org-1', 'duplicado@empresa.com', 'finance');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Este usuário já possui um convite ou acesso nesta empresa.');
    });
  });

  describe('removeOrganizationMember e cancelInvitation - Tratamento amigável', () => {
    it('10. removeOrganizationMember lança erro com mensagem amigável sem vazar detalhes de banco', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              error: { message: 'permission denied for table organization_members' },
            }),
          }),
        }),
      } as any);

      await expect(removeOrganizationMember('org-1', 'user-1')).rejects.toThrow(
        'Você não possui permissão para realizar esta ação.'
      );
    });

    it('11. cancelInvitation lança erro com mensagem amigável ao falhar', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                maybeSingle: vi.fn().mockResolvedValueOnce({
                  data: null,
                  error: { message: 'permission denied for table organization_invitations' },
                }),
              }),
            }),
          }),
        }),
      } as any);

      await expect(cancelInvitation('inv-1')).rejects.toThrow(
        'Você não possui permissão para realizar esta ação.'
      );
    });
  });
});
