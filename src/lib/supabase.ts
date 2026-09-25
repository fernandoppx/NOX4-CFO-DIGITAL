import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase não configurado.');
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);

// Garante instância estável do functions client para chamadas de Edge Functions
const functionsClient = (supabase as any).functions;
Object.defineProperty(supabase, 'functions', {
  get: () => functionsClient,
  configurable: true,
});

