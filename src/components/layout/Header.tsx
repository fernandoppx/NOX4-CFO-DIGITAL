import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Plus,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  Shield,
  Camera,
} from 'lucide-react';
import { Company, User } from '../../types';
import { MonthPickerFilter } from '../common/MonthPickerFilter';
import { ProfilePhotoModal } from '../modals/ProfilePhotoModal';

interface HeaderProps {
  companies: Company[];
  currentCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  selectedMonth: string; // YYYY-MM
  onSelectMonth: (month: string) => void;
  onOpenNewTransactionModal: () => void;
  activeTabTitle: string;
  currentUser?: User;
  onLogout?: () => void;
  onNavigateSettings?: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  onOpenCreateCompany?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  currentCompanyId,
  onSelectCompany,
  selectedMonth,
  onSelectMonth,
  onOpenNewTransactionModal,
  activeTabTitle,
  currentUser,
  onLogout,
  onNavigateSettings,
  onUpdateUser,
  onOpenCreateCompany,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'system_admin':
        return 'Administrador Geral (System Admin)';
      case 'owner':
      case 'admin':
        return 'Sócio / Proprietário (Owner)';
      case 'finance':
      case 'financial_analyst':
        return 'Equipe Financeira (Finance)';
      case 'manager':
        return 'Gestor';
      case 'viewer':
        return 'Visualizador';
      default:
        return 'Usuário';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between z-10 sticky top-0 shadow-sm">
      {/* Current Section Title & Company Selector */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-800 font-heading tracking-tight truncate">
          {activeTabTitle}
        </h1>

        <span className="text-slate-300 hidden sm:inline">|</span>

        {/* Company Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs hover:border-slate-300 transition-colors shrink-0">
          <Building2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-blue-600 shrink-0" />
          <select
            id="company-selector"
            value={currentCompanyId}
            onChange={(e) => onSelectCompany(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1 font-sans max-w-[130px] sm:max-w-none truncate"
          >
            {companies.map((comp) => (
              <option key={comp.id} value={comp.id} className="bg-white text-slate-800">
                {comp.name}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Month Selector Component */}
        <MonthPickerFilter
          selectedMonth={selectedMonth}
          onSelectMonth={onSelectMonth}
        />

        {/* Quick New Transaction Modal */}
        <button
          id="header-btn-new-entry"
          onClick={onOpenNewTransactionModal}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Novo Lançamento</span>
          <span className="sm:hidden">Novo</span>
        </button>

        {/* User Profile Menu */}
        {currentUser && (
          <div className="relative ml-1 sm:ml-2" ref={menuRef}>
            <button
              id="header-btn-user-profile"
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-300"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border border-blue-700">
                  {getInitials(currentUser.name)}
                </div>
              )}
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[120px] truncate">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight">
                  {currentUser.role === 'admin' ? 'CFO / Admin' : 'Usuário'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                    <Shield className="w-3 h-3" />
                    <span>{getRoleLabel(currentUser.role)}</span>
                  </div>
                </div>

                <div className="py-1">
                  {onUpdateUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsPhotoModalOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span>Editar Perfil</span>
                    </button>
                  )}

                  {onNavigateSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigateSettings();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      <span>Configurações & Perfil</span>
                    </button>
                  )}
                </div>

                {onLogout && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sair da Conta (Logout)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Profile Photo Modal */}
            {isPhotoModalOpen && onUpdateUser && (
              <ProfilePhotoModal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                currentUser={currentUser}
                onSaveProfile={(updatedUser) => onUpdateUser(updatedUser)}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
};
