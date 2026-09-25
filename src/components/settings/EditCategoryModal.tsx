import React, { useState, useEffect } from 'react';
import { Layers, X, Check, AlertCircle } from 'lucide-react';
import { Category, CategoryType } from '../../types';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  onSave: (categoryData: {
    id?: string;
    name: string;
    code: string;
    type: CategoryType;
    description?: string;
  }) => void;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<CategoryType>('OPERATIONAL_EXPENSE');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setCode(category.code || '');
      setType(category.type || 'OPERATIONAL_EXPENSE');
      setDescription(category.description || '');
    } else {
      setName('');
      setCode('');
      setType('OPERATIONAL_EXPENSE');
      setDescription('');
    }
    setErrorMessage(null);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!category;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Por favor, informe o nome da categoria / conta contábil.');
      return;
    }

    try {
      onSave({
        id: category?.id,
        name: name.trim(),
        code: code.trim() || `DRE-${Math.floor(100 + Math.random() * 900)}`,
        type,
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMessage(formatFinancialErrorMessage(err, isEditing ? 'update' : 'create', 'category'));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                {isEditing ? 'Editar Conta DRE' : 'Nova Conta do Plano de Contas'}
              </h3>
              <p className="text-xs text-slate-500">
                Classificação contábil e gerencial do DRE
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Feedback Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Nome da Categoria / Conta <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marketing Digital & Performance"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Código DRE</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 3.1.04"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tipo no DRE</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CategoryType)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
              >
                <option value="REVENUE">Receita Operacional Bruta</option>
                <option value="VARIABLE_COST">Custo dos Serviços / Produtos (CPV/CSV)</option>
                <option value="OPERATIONAL_EXPENSE">Despesa Operacional (OPEX)</option>
                <option value="FINANCIAL">Resultado Financeiro</option>
                <option value="TAX">Impostos sobre Faturamento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Descrição / Instruções de Uso</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva que tipos de despesas ou receitas devem ser alocadas nesta conta..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Categoria'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
