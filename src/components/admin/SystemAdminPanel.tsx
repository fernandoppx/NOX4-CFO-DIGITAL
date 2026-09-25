import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  Database,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Activity,
  Layers,
  ArrowRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { Company, User } from '../../types';
import { supabase } from '../../lib/supabase';
import { EditCompanyModal } from '../settings/EditCompanyModal';

interface SystemAdminPanelProps {
  currentUser: User;
  allCompanies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onOpenAppForCompany: (companyId: string) => void;
  onAddCompany?: (comp: Omit<Company, 'id' | 'created_at'>) => void;
}

export const SystemAdminPanel: React.FC<SystemAdminPanelProps> = ({
  currentUser,
  allCompanies,
  selectedCompanyId,
  onSelectCompany,
  onOpenAppForCompany,
  onAddCompany,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'healthy' | 'checking'>('healthy');
  const [adminStats, setAdminStats] = useState<{
    totalCompanies: number;
    totalProfiles: number;
    totalMemberships: number;
    totalInvitations: number;
  }>({
    totalCompanies: allCompanies.length,
    totalProfiles: 0,
    totalMemberships: 0,
    totalInvitations: 0,
  });

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const [profRes, memRes, invRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('organization_members').select('id', { count: 'exact', head: true }),
          supabase.from('organization_invitations').select('id', { count: 'exact', head: true }),
        ]);

        setAdminStats({
          totalCompanies: allCompanies.length,
          totalProfiles: profRes.count || 0,
          totalMemberships: memRes.count || 0,
          totalInvitations: invRes.count || 0,
        });
      } catch (e) {
        console.warn('Erro ao carregar estatísticas do system_admin:', e);
      }
    };

    fetchAdminStats();
  }, [allCompanies.length]);

  const filteredCompanies = allCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm) ||
      c.segment.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-800/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Painel de Controle System Admin</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Global Root Access
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Acesso administrativo global para governança e gestão avançada da plataforma.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Acesso Global Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Global Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total de Empresas</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{allCompanies.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Perfis de Usuários</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{adminStats.totalProfiles || '—'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Vínculos de Membros</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{adminStats.totalMemberships || '—'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Convites Ativos</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">{adminStats.totalInvitations || '—'}</p>
        </div>
      </div>

      {/* All Platform Organizations Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Todas as Empresas da Plataforma</h3>
            <p className="text-xs text-slate-400">Selecione qualquer organização para auditar métricas ou prestar suporte.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar empresa ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            {onAddCompany && (
              <button
                id="btn-admin-create-company"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Empresa</span>
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-800/60">
          {filteredCompanies.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhuma empresa encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredCompanies.map((comp) => {
              const isSelected = comp.id === selectedCompanyId;

              return (
                <div
                  key={comp.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-purple-950/20 border-l-2 border-purple-500' : 'hover:bg-slate-850/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                      {comp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">{comp.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        ID: <span className="font-mono text-slate-500">{comp.id}</span> • {comp.segment}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCompany(comp.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? 'Selecionada no Contexto' : 'Alternar Contexto'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenAppForCompany(comp.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                      title="Ir para o Dashboard desta empresa"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal to create company as System Admin */}
      {onAddCompany && (
        <EditCompanyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(data) => {
            onAddCompany({
              name: data.name,
              document: data.cnpj,
              cnpj: data.cnpj,
              segment: data.segment,
              currency: data.currency,
            });
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
