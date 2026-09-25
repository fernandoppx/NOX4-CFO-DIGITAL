import React, { useEffect, useState } from 'react';
import {
  UserRound,
  X,
  Check,
  Loader2,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { AvatarUpload } from '../common/AvatarUpload';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSaveProfile: (updatedUser: User) => void;
}

const AVATAR_BUCKET = 'avatars';

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error('Não foi possível preparar a imagem para envio.');
  }

  return response.blob();
};

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
}) => {
  const [fullName, setFullName] = useState(currentUser.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(currentUser.name || '');
      setSelectedAvatar(currentUser.avatar || '');
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, currentUser.id, currentUser.name, currentUser.avatar]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSaving) return;

    setErrorMessage(null);
    onClose();
  };

  const handleSave = async () => {
    if (isSaving) return;

    const normalizedName = fullName.trim().replace(/\s+/g, ' ');

    if (normalizedName.length < 2) {
      setErrorMessage('Informe um nome válido com pelo menos 2 caracteres.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const avatarPath = `${currentUser.id}/avatar.jpg`;
      const nameChanged = normalizedName !== (currentUser.name || '').trim();
      const avatarChanged =
        (selectedAvatar || '') !== (currentUser.avatar || '');

      let finalAvatarUrl = currentUser.avatar || '';

      // 1. Avatar removido
      if (avatarChanged && !selectedAvatar) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([avatarPath]);

        if (removeError) {
          console.warn(
            'Não foi possível remover o arquivo anterior do avatar:',
            removeError
          );
        }

        finalAvatarUrl = '';
      }

      // 2. Novo upload local
      if (avatarChanged && selectedAvatar.startsWith('data:image/')) {
        const blob = await dataUrlToBlob(selectedAvatar);

        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(avatarPath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        const { data: signedData, error: signedError } =
          await supabase.storage
            .from(AVATAR_BUCKET)
            .createSignedUrl(
              avatarPath,
              60 * 60 * 24 * 7
            );

        if (signedError || !signedData?.signedUrl) {
          throw (
            signedError ||
            new Error('Não foi possível gerar a visualização da foto.')
          );
        }

        finalAvatarUrl = signedData.signedUrl;
      }

      // 3. URL externa / galeria
      if (
        avatarChanged &&
        selectedAvatar &&
        /^https?:\/\//i.test(selectedAvatar) &&
        !selectedAvatar.includes('/storage/v1/object/sign/avatars/')
      ) {
        finalAvatarUrl = selectedAvatar;
      }

      // Define o valor estável que será salvo em profiles.avatar_url.
      let avatarValueForDatabase: string | null | undefined;

      if (avatarChanged) {
        if (!selectedAvatar) {
          avatarValueForDatabase = null;
        } else if (selectedAvatar.startsWith('data:image/')) {
          avatarValueForDatabase = avatarPath;
        } else if (/^https?:\/\//i.test(selectedAvatar)) {
          // Se for a URL assinada atual e não houve uma nova escolha real,
          // não devemos gravar a URL temporária no banco.
          if (
            selectedAvatar.includes('/storage/v1/object/sign/avatars/')
          ) {
            avatarValueForDatabase = undefined;
          } else {
            avatarValueForDatabase = selectedAvatar;
          }
        }
      }

      // 4. Atualiza o perfil no banco.
      const profileUpdate: Record<string, any> = {
        full_name: normalizedName,
        updated_at: new Date().toISOString(),
      };

      if (avatarValueForDatabase !== undefined) {
        profileUpdate.avatar_url = avatarValueForDatabase;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Mantém o metadata do Supabase Auth consistente com profiles.full_name.
      // Se falhar, o dado principal já ficou salvo em public.profiles.
      if (nameChanged) {
        const { error: authMetadataError } =
          await supabase.auth.updateUser({
            data: {
              full_name: normalizedName,
            },
          });

        if (authMetadataError) {
          console.warn(
            'Nome salvo em profiles, mas o metadata do Auth não foi atualizado:',
            authMetadataError
          );
        }
      }

      onSaveProfile({
        ...currentUser,
        name: normalizedName,
        avatar: finalAvatarUrl || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar perfil:', err);

      setErrorMessage(
        err?.message || 'Não foi possível salvar o perfil.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
              <UserRound className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Meu Perfil
              </h3>

              <p className="text-xs text-slate-500">
                Atualize seu nome e sua foto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label
              htmlFor="profile-full-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nome
            </label>

            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setErrorMessage(null);
              }}
              maxLength={120}
              autoComplete="name"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder="Seu nome"
            />
          </div>

          {/* Email somente leitura */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              E-mail
            </label>

            <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{currentUser.email}</span>
            </div>

            <p className="text-[10px] text-slate-400 mt-1">
              O e-mail da conta não é alterado por esta tela.
            </p>
          </div>

          {/* Avatar */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Foto de perfil
            </label>

            <AvatarUpload
              value={selectedAvatar}
              onChange={(url) => {
                setSelectedAvatar(url);
                setErrorMessage(null);
              }}
              userName={fullName || currentUser.name}
            />
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Salvar Perfil</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
