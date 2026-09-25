import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Check,
  X,
  Trash2,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
} from 'lucide-react';

interface AvatarUploadProps {
  value?: string;
  onChange: (avatarUrl: string) => void;
  userName?: string;
  className?: string;
}

export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=300',
];

/**
 * Redimensiona e comprime a imagem antes do upload para o Supabase Storage.
 */
const processAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida ou corrompida'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw and export as webp or jpeg
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  value,
  onChange,
  userName = 'Usuário',
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'presets' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'US';

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Selecione uma imagem válida nos formatos JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O arquivo excede o limite de 5MB.');
      return;
    }

    try {
      setIsProcessing(true);
      const dataUrl = await processAndCompressImage(file);
      onChange(dataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar a imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
  };

  const handleRemove = () => {
    onChange('');
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Main Avatar Preview & Quick Controls */}
      <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="relative shrink-0 group">
          {value ? (
            <img
              src={value}
              alt={userName}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-blue-500/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-bold text-lg flex items-center justify-center border-2 border-white shadow-sm ring-2 ring-blue-500/20 font-heading">
              {initials}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Alterar imagem"
            className="absolute bottom-0 right-0 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md border-2 border-white transition-transform active:scale-90 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 font-heading">
              {value ? 'Foto de Perfil Definida' : 'Nenhuma Foto Selecionada'}
            </span>
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remover</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Formatos suportados: PNG, JPG e WEBP até 5MB.
          </p>

          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'upload'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload do Computador</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('presets')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'presets'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Galeria</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'url'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>URL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mode 1: Drag & Drop File Zone */}
      {mode === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
              : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/60'
          }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center py-2 text-blue-600">
              <RefreshCw className="w-6 h-6 animate-spin mb-1" />
              <span className="text-xs font-semibold">Otimizando foto de perfil...</span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  <span className="text-blue-600 hover:underline">Clique para selecionar</span> ou arraste e solte sua foto aqui
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  A imagem será automaticamente otimizada e centralizada
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode 2: Presets */}
      {mode === 'presets' && (
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <span className="text-[11px] font-semibold text-slate-600 block">
            Selecione uma foto da galeria corporativa:
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {PRESET_AVATARS.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(url)}
                className={`relative rounded-full p-0.5 transition-all cursor-pointer ${
                  value === url
                    ? 'ring-2 ring-blue-600 ring-offset-2 scale-105'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
              >
                <img
                  src={url}
                  alt={`Avatar ${i + 1}`}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {value === url && (
                  <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 shadow-xs">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode 3: Direct URL */}
      {mode === 'url' && (
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 block">
            Endereço web (URL) da foto:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/minha-foto.jpg"
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-mono text-slate-800"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
