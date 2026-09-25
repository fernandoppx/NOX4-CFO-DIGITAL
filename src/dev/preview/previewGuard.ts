/**
 * Guardião de Segurança do Modo de Pré-Visualização Interna.
 * 
 * Regras estritas:
 * 1. import.meta.env.DEV === true
 * 2. VITE_ENABLE_INTERNAL_PREVIEW === 'true'
 * 
 * Se estiver em produção (PROD === true) ou qualquer uma das condições não for satisfeita,
 * o modo de pré-visualização deve ser estritamente bloqueado.
 */
export function isInternalPreviewEnabled(env: {
  DEV?: boolean;
  PROD?: boolean;
  VITE_ENABLE_INTERNAL_PREVIEW?: string;
} = import.meta.env): boolean {
  // Se estiver em produção, bloqueia imediatamente
  if (env.PROD === true) {
    return false;
  }

  // Ambas as condições devem ser verdadeiras
  const isDev = env.DEV === true;
  const isFlagActive = env.VITE_ENABLE_INTERNAL_PREVIEW === 'true';

  return isDev && isFlagActive;
}
