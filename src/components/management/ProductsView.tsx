import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Tag,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';

interface ProductsViewProps {
  products: Product[];
  onAddProduct: (prod: Omit<Product, 'id' | 'created_at'>) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 3500,
    cost_estimate: 800,
    is_recurring: true,
    active: true,
  });

  const handleOpenModal = (product?: Product) => {
    setModalError(null);
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        cost_estimate: product.cost_estimate,
        is_recurring: product.is_recurring,
        active: product.active,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 4500,
        cost_estimate: 1000,
        is_recurring: true,
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setModalError('Por favor, informe o nome do produto ou serviço.');
      return;
    }

    if (formData.price < 0) {
      setModalError('O preço de venda não pode ser negativo.');
      return;
    }

    if (formData.cost_estimate < 0) {
      setModalError('O custo direto estimado não pode ser negativo.');
      return;
    }

    try {
      if (editingProduct) {
        onUpdateProduct({
          ...editingProduct,
          name: trimmedName,
          description: formData.description.trim(),
          price: formData.price,
          cost_estimate: formData.cost_estimate,
          is_recurring: formData.is_recurring,
          active: formData.active,
        });
      } else {
        onAddProduct({
          name: trimmedName,
          description: formData.description.trim(),
          price: formData.price,
          cost_estimate: formData.cost_estimate,
          is_recurring: formData.is_recurring,
          active: formData.active,
          company_id: 'comp_nox4',
        });
      }
      setIsModalOpen(false);
      setFeedbackError(null);
    } catch (err) {
      setModalError(formatFinancialErrorMessage(err, editingProduct ? 'update' : 'create', 'product'));
    }
  };

  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    setDeleteModalError(null);
    try {
      onDeleteProduct(productToDelete.id);
      setProductToDelete(null);
      setFeedbackError(null);
    } catch (err) {
      setDeleteModalError(formatFinancialErrorMessage(err, 'delete', 'product'));
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Catálogo de Soluções
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                Precificação, Custos Diretos & Margem de Contribuição
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Produtos & Serviços
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastro de planos recorrentes (retainers), setups, consultorias e cálculo de margem unitária
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Produto / Serviço</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do serviço ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Feedback Error Banner */}
        {feedbackError && (
          <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="font-medium">{feedbackError}</div>
            </div>
            <button
              onClick={() => setFeedbackError(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold px-1.5 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-heading">Nenhum produto ou serviço cadastrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Cadastre seus serviços, produtos e estimativas de custo direto para gerenciar as margens operacionais.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Primeiro Produto / Serviço</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => {
            const unitMargin = prod.price - prod.cost_estimate;
            const unitMarginPercent = prod.price > 0 ? (unitMargin / prod.price) * 100 : 0;

            return (
              <div
                key={prod.id}
                className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 font-heading">{prod.name}</h3>
                        <span className="text-[10px] text-slate-500">
                          {prod.is_recurring ? 'Serviço Recorrente (Mensal)' : 'Venda Pontual / Setup'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        prod.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {prod.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {prod.description && (
                    <p className="text-xs text-slate-500 mt-3 line-clamp-2">
                      {prod.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Preço Venda</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(prod.price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Custo Direto</span>
                      <span className="font-mono font-semibold text-rose-600">
                        {formatCurrency(prod.cost_estimate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Margem Contrib.</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {formatPercent(unitMarginPercent)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenModal(prod)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-slate-500" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalError(null);
                      setProductToDelete(prod);
                    }}
                    title="Excluir Produto / Serviço"
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              {editingProduct ? 'Editar Produto / Serviço' : 'Novo Produto / Serviço'}
            </h3>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{modalError}</div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome do Serviço/Produto *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  placeholder="Ex: Gestão de Tráfego & Performance"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Custo Direto Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_estimate}
                    onChange={(e) => setFormData({ ...formData, cost_estimate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span>Recorrente (Mensal)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span>Ativo</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Produto / Serviço?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar o item{' '}
                <strong className="text-slate-800">{productToDelete.name}</strong>?
              </p>
            </div>

            {deleteModalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{deleteModalError}</div>
              </div>
            )}

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> Lançamentos de receitas e contratos que utilizam este produto poderão ter a referência desvinculada.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalError(null);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Item</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
