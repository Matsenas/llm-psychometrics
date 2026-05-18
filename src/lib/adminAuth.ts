import { supabase } from "@/integrations/supabase/client";

export async function getCurrentAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { session: null, user: null, isAdmin: false };
  }

  const { data: roleData, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw error;

  return {
    session,
    user: session.user,
    isAdmin: !!roleData,
  };
}
