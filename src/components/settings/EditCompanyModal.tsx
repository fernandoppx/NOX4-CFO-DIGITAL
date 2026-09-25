import React, { useState, useEffect } from 'react';
import { Building2, X, Check, Globe } from 'lucide-react';
import { Company } from '../../types';

interface EditCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
  onSave: (companyData: {
    name: string;
    cnpj: string;
    segment: string;
    currency: string;
  }) => void;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  isOpen,
  onClose,
  company,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [segment, setSegment] = useState('Serviços & Consultoria');
  const [currency, setCurrency] = useState('BRL');

  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setCnpj(company.cnpj || company.document || '');
      setSegment(company.segment || 'Serviços & Consultoria');
      setCurrency(company.currency || 'BRL');
    } else {
      setName('');
      setCnpj('');
      setSegment('Serviços & Consultoria');
      setCurrency('BRL');
    }
  }, [company, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      cnpj: cnpj.trim(),
      segment: segment.trim(),
      currency,
    });
    onClose();
  };

  const isEditing = !!company;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdropblur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                {isEditing ? 'Editar Dados da Empresa' : 'Cadastrar Nova Empresa'}
              </h3>

              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Atualize a razão social, CNPJ e informações cadastrais da empresa'
                  : 'Cadastre um novo ambiente empresarial na plataforma'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Razão Social / Nome Fantasia <span className="text-rose-500">*</span>
            </label>

            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-medium"
              placeholder="Ex: NOX4 Franchising Ltda"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                CNPJ / CPF
              </label>

              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-mono"
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Moeda Padrão
              </label>

              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-medium"
              >
                <option value="BRL">BRL (R$ Real Brasileiro)</option>
                <option value="USD">USD ($ Dólar Americano)</option>
                <option value="EUR">EUR (€ Euro)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Segmento de Atuação
            </label>

            <input
              type="text"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-medium"
              placeholder="Ex: Consultoria & Marketing Digital"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5 text-blue-800">
            <Globe className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />

            <p className="text-[11px] leading-relaxed">
              <strong>Ambiente independente:</strong> Esta empresa possui seus próprios dados financeiros,
              usuários e configurações separados dentro da plataforma.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Ambiente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};