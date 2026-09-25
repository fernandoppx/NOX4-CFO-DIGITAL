import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Building2,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Company, OrganizationMember, OrganizationInvitation } from '../../types';
import {
  loadOrganizationMembers,
  loadOrganizationInvitations,
  inviteOrganizationMember,
  removeOrganizationMember,
  cancelInvitation,
  formatTeamErrorMessage,
} from '../../lib/supabaseAuth';

interface TeamManagementTabProps {
  currentCompany: Company;
  currentUserRole: 'owner' | 'finance' | 'system_admin' | string;
  currentUserId: string;
  isPreviewMode?: boolean;
  previewMembers?: OrganizationMember[];
  previewInvitations?: OrganizationInvitation[];
  onActionIntercepted?: (msg: string) => void;
}

export const TeamManagementTab: React.FC<TeamManagementTabProps> = ({
  currentCompany,
  currentUserRole,
  currentUserId,
  isPreviewMode = false,
  previewMembers = [],
  previewInvitations = [],
  onActionIntercepted,
}) => {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Invite Form
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'finance'>('finance');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState<boolean>(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Action status
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'system_admin';

  const fetchData = async () => {
    if (isPreviewMode) {
      setMembers(previewMembers);
      setInvitations(previewInvitations);
      setIsLoading(false);
      return;
    }

    if (!currentCompany?.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [membersData, invData] = await Promise.all([
        loadOrganizationMembers(currentCompany.id),
        loadOrganizationInvitations(currentCompany.id),
      ]);
      setMembers(membersData);
      setInvitations(invData);
    } catch (err) {
      console.error('Erro ao carregar equipe da empresa:', err);
      setLoadError(formatTeamErrorMessage(err, 'load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentCompany?.id, isPreviewMode]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentCompany?.id) return;

    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      setInviteFeedback({
        type: 'success',
        message: 'Modo de pré-visualização: nenhuma alteração foi gravada.',
      });
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteFeedback(null);
        setInviteEmail('');
        setInviteName('');
      }, 1200);
      return;
    }

    setIsSubmittingInvite(true);
    setInviteFeedback(null);

    try {
      const res = await inviteOrganizationMember(
        currentCompany.id,
        inviteEmail.trim(),
        inviteRole,
        inviteName.trim() || undefined
      );

      if (res.success) {
        setInviteFeedback({
          type: 'success',
          message: res.message || 'Convite registrado com sucesso! O usuário receberá acesso ao fazer login.',
        });
        setInviteEmail('');
        setInviteName('');
        await fetchData();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteFeedback(null);
        }, 1500);
      } else {
        setInviteFeedback({
          type: 'error',
          message: formatTeamErrorMessage(res.message, 'invite'),
        });
      }
    } catch (err: any) {
      console.error('Erro ao processar convite:', err);
      setInviteFeedback({
        type: 'error',
        message: formatTeamErrorMessage(err, 'invite'),
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja remover este membro da empresa?')) return;

    setActionLoadingId(memberUserId);
    setActionFeedback(null);
    try {
      await removeOrganizationMember(currentCompany.id, memberUserId);
      await fetchData();
      setActionFeedback({
        type: 'success',
        message: 'Membro removido com sucesso.',
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao remover membro:', err);
      setActionFeedback({
        type: 'error',
        message: formatTeamErrorMessage(err, 'remove'),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      return;
    }

    if (!window.confirm('Deseja cancelar este convite pendente?')) return;

    setActionLoadingId(invitationId);
    setActionFeedback(null);
    try {
      await cancelInvitation(invitationId);
      await fetchData();
      setActionFeedback({
        type: 'success',
        message: 'Convite cancelado com sucesso.',
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao cancelar convite:', err);
      setActionFeedback({
        type: 'error',
        message: formatTeamErrorMessage(err, 'cancel'),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Equipe & Controle de Acessos</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                {currentCompany.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cadastre e gerencie os acessos e permissões dos usuários desta empresa.
            </p>
          </div>
        </div>

        {isOwnerOrAdmin && (
          <button
            id="btn-open-invite-modal"
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Usuário Financeiro</span>
          </button>
        )}
      </div>

      {/* Error state for loading members */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-200 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Action feedback banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white p-1 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Members Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Membros Ativos ({members.length})</span>
          </h4>
          <button
            type="button"
            onClick={fetchData}
            title="Atualizar lista"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {members.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum membro listado para esta empresa.
            </div>
          ) : (
            members.map((member) => {
              const isOwner = member.role === 'owner';
              const isCurrent = member.user_id === currentUserId;

              return (
                <div
                  key={member.user_id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-850/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        isOwner ? 'bg-amber-600 border border-amber-500' : 'bg-blue-600 border border-blue-500'
                      }`}
                    >
                      {member.user_name ? member.user_name.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 flex items-center gap-2 truncate">
                        <span>{member.user_name || 'Usuário'}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded font-normal">
                            (Você)
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{member.user_email || 'Email vinculado via Auth'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isOwner
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isOwner ? 'Sócio / Owner' : 'Financeiro'}
                    </span>

                    {isOwnerOrAdmin && !isOwner && !isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={actionLoadingId === member.user_id}
                        title="Remover da empresa"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pending Invitations Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Convites Pendentes ({invitations.length})</span>
          </h4>
        </div>

        <div className="divide-y divide-slate-800/60">
          {invitations.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              Nenhum convite pendente. Todos os usuários cadastrados já foram associados.
            </div>
          ) : (
            invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-850/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{inv.name || 'Convidado Financeiro'}</p>
                    <p className="text-[11px] text-slate-400 truncate">{inv.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Aguardando Login
                  </span>

                  {isOwnerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={actionLoadingId === inv.id}
                      title="Cancelar convite"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Cadastrar Usuário Financeiro</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  id="invite-name-input"
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Usuário
                </label>
                <input
                  id="invite-email-input"
                  type="email"
                  required
                  placeholder="Ex: financeiro@empresa.com.br"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  O vínculo à empresa é feito automaticamente através deste e-mail.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Função / Papel
                </label>
                <select
                  id="invite-role-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'finance')}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="finance">Financeiro (Lançamentos, DRE, Fluxo de Caixa)</option>
                </select>
              </div>

              {inviteFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    inviteFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}
                >
                  {inviteFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{inviteFeedback.message}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-invite"
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmittingInvite ? 'Salvando...' : 'Cadastrar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
