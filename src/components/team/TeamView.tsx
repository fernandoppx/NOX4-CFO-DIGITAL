import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Building2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Briefcase,
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

type TeamMember = OrganizationMember & { user_avatar?: string };

interface TeamViewProps {
  currentCompany: Company;
  currentUserRole: 'owner' | 'finance' | 'viewer' | string;
  currentUserId: string;
  currentUserAvatar?: string;
  isPreviewMode?: boolean;
  previewMembers?: OrganizationMember[];
  previewInvitations?: OrganizationInvitation[];
  onActionIntercepted?: (msg: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  currentCompany,
  currentUserRole,
  currentUserId,
  currentUserAvatar,
  isPreviewMode = false,
  previewMembers = [],
  previewInvitations = [],
  onActionIntercepted,
}) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Form states: owner informs strictly Email and Função
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'finance' | 'viewer'>('finance');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Action status
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<
    | { type: 'remove-member'; id: string; label: string }
    | { type: 'cancel-invite'; id: string; label: string }
    | null
  >(null);

  const isOwner = currentUserRole === 'owner';

  const fetchData = async () => {
    if (isPreviewMode) {
      setMembers(previewMembers as TeamMember[]);
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
      setMembers(membersData as TeamMember[]);
      setInvitations(invData);
    } catch (err) {
      console.error('Erro ao carregar equipe:', err);
      setLoadError(formatTeamErrorMessage(err, 'load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentCompany?.id, isPreviewMode]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentCompany?.id || !isOwner) return;

    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      setFeedback({
        type: 'success',
        message: 'Modo de pré-visualização: nenhuma alteração foi gravada.',
      });
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setFeedback(null);
        setInviteEmail('');
        setInviteRole('finance');
      }, 1200);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await inviteOrganizationMember(
        currentCompany.id,
        inviteEmail.trim(),
        inviteRole
      );

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Convite registrado com sucesso! O usuário receberá acesso ao fazer login ou atualizar.',
        });
        setInviteEmail('');
        setInviteRole('finance');
        await fetchData();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setFeedback(null);
        }, 1400);
      } else {
        setFeedback({
          type: 'error',
          message: formatTeamErrorMessage(res.message, 'invite'),
        });
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      setFeedback({
        type: 'error',
        message: formatTeamErrorMessage(err, 'invite'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestRemoveMember = (memberUserId: string, label: string) => {
    if (!isOwner) return;

    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      return;
    }

    setConfirmAction({
      type: 'remove-member',
      id: memberUserId,
      label,
    });
  };

  const requestCancelInvite = (invitationId: string, label: string) => {
    if (!isOwner) return;

    if (isPreviewMode) {
      onActionIntercepted?.('Modo de pré-visualização: nenhuma alteração foi gravada.');
      return;
    }

    setConfirmAction({
      type: 'cancel-invite',
      id: invitationId,
      label,
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction || !isOwner) return;

    const action = confirmAction;
    setConfirmAction(null);
    setActionLoadingId(action.id);

    try {
      if (action.type === 'remove-member') {
        await removeOrganizationMember(currentCompany.id, action.id);
      } else {
        await cancelInvitation(action.id);
      }

      await fetchData();
      setFeedback({
        type: 'success',
        message:
          action.type === 'remove-member'
            ? 'Membro removido com sucesso.'
            : 'Convite cancelado com sucesso.',
      });
      setTimeout(() => {
        setFeedback(null);
      }, 3500);
    } catch (err: any) {
      console.error('Erro ao executar ação da equipe:', err);
      setFeedback({
        type: 'error',
        message: formatTeamErrorMessage(
          err,
          action.type === 'remove-member' ? 'remove' : 'cancel'
        ),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'Proprietário';
      case 'finance':
        return 'Financeiro';
      case 'viewer':
        return 'Visualizador';
      default:
        return 'Membro';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Briefcase className="w-3 h-3" />
            <span>Proprietário</span>
          </span>
        );
      case 'finance':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3" />
            <span>Financeiro</span>
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40">
            <Eye className="w-3 h-3" />
            <span>Visualizador</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-slate-400">
            <span>{role}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight font-heading">
                Equipe
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                <Building2 className="w-3 h-3 text-blue-400" />
                {currentCompany.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controle de acessos e permissões da organização. Somente o proprietário pode administrar a equipe.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            title="Atualizar lista"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isOwner ? (
            <button
              id="btn-add-user"
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Adicionar usuário</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40 text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Somente owner administra equipe</span>
            </div>
          )}
        </div>
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

      {/* Action feedback outside modal (e.g. member removed / invite cancelled) */}
      {!isInviteModalOpen && feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Unified Team List: Members and Pending Invitations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/90 bg-slate-950/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span>Membros e Convites ({members.length + invitations.length})</span>
          </h2>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {members.length} Ativo{members.length !== 1 ? 's' : ''}
            </span>
            {invitations.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {invitations.length} Pendente{invitations.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <div className="col-span-4 sm:col-span-3">Nome</div>
          <div className="col-span-4 sm:col-span-4">Email</div>
          <div className="col-span-2 sm:col-span-2">Papel</div>
          <div className="col-span-2 sm:col-span-2">Status</div>
          <div className="col-span-12 sm:col-span-1 text-right">Ações</div>
        </div>

        {/* List Body */}
        <div className="divide-y divide-slate-800/60">
          {members.length === 0 && invitations.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Nenhum usuário cadastrado na equipe desta empresa.
            </div>
          ) : (
            <>
              {/* Active Members */}
              {members.map((member) => {
                const isMemberOwner = member.role === 'owner';
                const isCurrent = member.user_id === currentUserId;
                const displayAvatar =
                  member.user_avatar || (isCurrent ? currentUserAvatar : undefined);

                return (
                  <div
                    key={member.user_id || member.id}
                    id={`member-row-${member.user_id}`}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-850/40 transition-colors"
                  >
                    {/* Nome */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-3 min-w-0">
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt={member.user_name || 'Usuário'}
                          className={`w-8 h-8 rounded-lg object-cover shrink-0 border ${
                            isMemberOwner
                              ? 'border-amber-500/40'
                              : 'border-blue-500/40'
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            isMemberOwner
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {member.user_name
                            ? member.user_name.slice(0, 2).toUpperCase()
                            : 'US'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{member.user_name || 'Usuário'}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-400 font-normal">
                              (Você)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="col-span-4 sm:col-span-4 min-w-0">
                      <p className="text-xs text-slate-300 truncate font-mono">
                        {member.user_email || 'Email autenticado'}
                      </p>
                    </div>

                    {/* Papel */}
                    <div className="col-span-2 sm:col-span-2">
                      {getRoleBadge(member.role)}
                    </div>

                    {/* Status */}
                    <div className="col-span-2 sm:col-span-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ativo</span>
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="col-span-12 sm:col-span-1 text-right">
                      {isOwner && !isMemberOwner && !isCurrent ? (
                        <button
                          type="button"
                          onClick={() =>
                            requestRemoveMember(
                              member.user_id,
                              member.user_email || member.user_name || 'este usuário'
                            )
                          }
                          disabled={actionLoadingId === member.user_id}
                          title="Remover usuário da organização"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pending Invitations */}
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  id={`invitation-row-${inv.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center bg-amber-500/[0.02] hover:bg-amber-500/[0.05] transition-colors"
                >
                  {/* Nome */}
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-300 truncate">
                        {inv.name || 'Convidado'}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="col-span-4 sm:col-span-4 min-w-0">
                    <p className="text-xs text-amber-200/90 truncate font-mono">
                      {inv.email}
                    </p>
                  </div>

                  {/* Papel */}
                  <div className="col-span-2 sm:col-span-2">
                    {getRoleBadge(inv.role)}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 sm:col-span-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      <span>Pendente</span>
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="col-span-12 sm:col-span-1 text-right">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => requestCancelInvite(inv.id, inv.email)}
                        disabled={actionLoadingId === inv.id}
                        title="Cancelar convite pendente"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmação de remoção/cancelamento */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white">
                  {confirmAction.type === 'remove-member'
                    ? 'Remover usuário'
                    : 'Cancelar convite'}
                </h3>

                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {confirmAction.type === 'remove-member'
                    ? 'Este usuário perderá o acesso a esta empresa.'
                    : 'Este convite pendente será cancelado e deixará de aparecer na equipe.'}
                </p>

                <p className="text-xs font-semibold text-slate-200 mt-3 break-all">
                  {confirmAction.label}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={executeConfirmedAction}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {confirmAction.type === 'remove-member'
                  ? 'Remover usuário'
                  : 'Cancelar convite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar usuário (strictly asks Email and Função) */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Adicionar usuário</h3>
                  <p className="text-[11px] text-slate-400">
                    Cadastre o email e a função na empresa {currentCompany.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email <span className="text-rose-400">*</span>
                </label>
                <input
                  id="team-invite-email"
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  O usuário receberá o acesso associado assim que entrar ou atualizar a página.
                </p>
              </div>

              {/* Função */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Função <span className="text-rose-400">*</span>
                </label>
                <select
                  id="team-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'finance' | 'viewer')}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                >
                  <option value="finance">Financeiro</option>
                  <option value="viewer">Visualizador</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {inviteRole === 'finance'
                    ? 'Financeiro: Acesso a lançamentos, DRE e fluxo de caixa.'
                    : 'Visualizador: Acesso para consultas e relatórios (somente leitura).'}
                </p>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-add-user"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Adicionar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
