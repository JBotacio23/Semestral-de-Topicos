import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service role key: bypassa RLS.
 * SOLO usar en Services que corren en servidor para operaciones de sistema
 * (generar número de trámite, escribir historial_estados, notificaciones).
 * Nunca importar este archivo desde un componente cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
