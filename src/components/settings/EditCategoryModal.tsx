import React, { useState, useEffect, useCallback } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { Category } from '../../types';
import { EXPENSE_GROUP_LABELS } from '../../lib/utils';
import { useEscapeKey } from '../../lib/hooks';

export interface CategoryFormData {
  id?: string;
  name: string;
  /** 'revenue' ou um grupo de despesa do DRE */
  group: string;
  /** Natureza do custo para contas de despesa */
  cost_type: 'fixed' | 'variable';
}

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSave: (categoryData: CategoryFormData) => void | Promise<void>;
}

const GROUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'revenue', label: 'Receita' },
  ...Object.entries(EXPENSE_GROUP_LABELS)
    .filter(([k]) => k !== 'revenue')
    .map(([value, label]) => ({ value, label })),
];

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, category, onSave }) => {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('operational');
  const [costType, setCostType] = useState<'fixed' | 'variable'>('fixed');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const close = useCallback(() => {
    if (!isSaving) onClose();
  }, [isSaving, onClose]);
  useEscapeKey(isOpen, close);

  useEffect(() => {
    if (!isOpen) return;
    if (category) {
      setName(category.name);
      const isRevenue = category.type === 'REVENUE' || category.group === 'revenue';
      setGroup(isRevenue ? 'revenue' : String(category.group || 'operational'));
      setCostType(((category as any).cost_type as 'fixed' | 'variable') || 'fixed');
    } else {
      setName('');
      setGroup('operational');
      setCostType('fixed');
    }
    setErrorMessage(null);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(category);
  const isRevenue = group === 'revenue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Informe o nome da conta.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ id: category?.id, name: name.trim(), group, cost_type: costType });
      onClose();
    } catch {
      setErrorMessage('Não foi possível salvar a conta. Tente de novo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                {isEditing ? 'Editar conta' : 'Nova conta do Plano de Contas'}
              </h3>
              <p className="text-xs text-slate-500">Define em qual linha da DRE os lançamentos aparecem</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Fechar" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="cat-name" className="block text-slate-700 font-semibold mb-1">Nome da conta *</label>
            <input
              id="cat-name"
              autoFocus
              placeholder="Ex: Marketing digital"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className={`grid gap-3 ${isRevenue ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Grupo na DRE</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                disabled={isEditing}
                title={isEditing ? 'Para mudar entre receita e despesa, crie uma nova conta' : undefined}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer disabled:opacity-70"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            {!isRevenue && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Natureza</label>
                <select
                  value={costType}
                  onChange={(e) => setCostType(e.target.value as 'fixed' | 'variable')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none cursor-pointer"
                >
                  <option value="fixed">Fixo</option>
                  <option value="variable">Variável</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={close} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
            >
              {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
