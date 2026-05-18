import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  targetUserId?: unknown;
}

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding === 2) return atob(base64 + "==");
  if (padding === 3) return atob(base64 + "=");
  if (padding === 0) return atob(base64);
  throw new Error("Invalid base64url string");
}

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload.sub || null;
  } catch (error) {
    console.error("JWT decode error:", error);
    return null;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${field} is required`);
  }
  return value.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const callerUserId = getUserIdFromJwt(req.headers.get("Authorization"));
    if (!callerUserId) throw new RequestError("Unauthorized: missing or invalid authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new RequestError("Server is missing Supabase service configuration", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminRole, error: adminError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRole) throw new RequestError("Forbidden: admin role required", 403);

    const body = (await req.json()) as DeleteUserRequest;
    const targetUserId = stringValue(body.targetUserId, "Target user");
    if (targetUserId === callerUserId) {
      throw new RequestError("You cannot delete your own account.", 400);
    }

    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(targetUserId);
    if (targetUserError || !targetUser.user) {
      throw new RequestError("Target user was not found", 404);
    }

    const { data: targetAdminRole, error: targetAdminRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (targetAdminRoleError) throw targetAdminRoleError;

    if (targetAdminRole) {
      const { count: adminCount, error: adminCountError } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (adminCountError) throw adminCountError;
      if ((adminCount ?? 0) <= 1) {
        throw new RequestError("Cannot delete the final admin account.", 400);
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteError) throw new RequestError(deleteError.message, 400);

    return jsonResponse({ deletedUserId: targetUserId });
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected user deletion error";
    console.error("admin-delete-user error:", error);
    return jsonResponse({ error: message }, status);
  }
});
