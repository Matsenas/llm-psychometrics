import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccountKind = "participant" | "admin";

interface BaseRequest {
  kind?: AccountKind;
  name?: unknown;
  email?: unknown;
  respondentId?: unknown;
  studyVersionId?: unknown;
}

interface StudyVersionRow {
  id: string;
  study_id: string;
  is_published: boolean;
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

function optionalStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedEmail(value: unknown): string {
  const email = stringValue(value, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError("A valid email address is required");
  }
  return email;
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function generatedRespondentId(): string {
  return `email-${crypto.randomUUID().slice(0, 8)}`;
}

function authDuplicateMessage(kind: AccountKind): string {
  return kind === "admin"
    ? "A user with this email already exists. Use Grant on the existing profile instead."
    : "A user with this email already exists. Use the existing account or choose another email.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let createdUserId: string | null = null;
  let createdParticipantId: string | null = null;
  let cleanupClient: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    const callerUserId = getUserIdFromJwt(authHeader);
    if (!callerUserId) throw new RequestError("Unauthorized: missing or invalid authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new RequestError("Server is missing Supabase service configuration", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    cleanupClient = supabase;

    const { data: adminRole, error: adminError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRole) throw new RequestError("Forbidden: admin role required", 403);

    const body = (await req.json()) as BaseRequest;
    const kind = body.kind;
    if (kind !== "participant" && kind !== "admin") {
      throw new RequestError("Account kind must be participant or admin");
    }

    const name = stringValue(body.name, "Name");
    const email = normalizedEmail(body.email);
    const temporaryPassword = generateTemporaryPassword();

    let selectedStudyVersion: StudyVersionRow | null = null;

    if (kind === "participant") {
      const studyVersionId = stringValue(body.studyVersionId, "Study assignment");
      const { data: existingParticipant, error: participantLookupError } = await supabase
        .from("participants")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (participantLookupError) throw participantLookupError;
      if (existingParticipant) {
        throw new RequestError("A participant with this email already exists", 409);
      }

      const { data: studyVersion, error: studyVersionError } = await supabase
        .from("study_versions")
        .select("id, study_id, is_published")
        .eq("id", studyVersionId)
        .maybeSingle();

      if (studyVersionError) throw studyVersionError;
      if (!studyVersion) throw new RequestError("Selected study version was not found", 404);
      if (!(studyVersion as StudyVersionRow).is_published) {
        throw new RequestError("Selected study version is not published", 400);
      }
      selectedStudyVersion = studyVersion as StudyVersionRow;
    }

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
        created_by_admin: true,
        account_kind: kind,
      },
    });

    if (createUserError) {
      const message = /already|registered|exists/i.test(createUserError.message)
        ? authDuplicateMessage(kind)
        : createUserError.message;
      throw new RequestError(message, /already|registered|exists/i.test(createUserError.message) ? 409 : 400);
    }

    const user = createdUser.user;
    if (!user) throw new RequestError("Supabase did not return a created user", 500);
    createdUserId = user.id;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email,
        name,
        updated_at: new Date().toISOString(),
      });
    if (profileError) throw profileError;

    const { error: userRoleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "user" }, { onConflict: "user_id,role" });
    if (userRoleError) throw userRoleError;

    if (kind === "admin") {
      const { error: adminRoleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
      if (adminRoleError) throw adminRoleError;

      const { error: eventError } = await supabase.from("admin_role_events").insert({
        actor_user_id: callerUserId,
        target_user_id: user.id,
        action: "grant_admin",
      });
      if (eventError) throw eventError;

      createdUserId = null;
      return jsonResponse({
        kind,
        userId: user.id,
        email,
        name,
        temporaryPassword,
      });
    }

    const studyVersionId = stringValue(body.studyVersionId, "Study assignment");
    if (!selectedStudyVersion) {
      throw new RequestError("Selected study version was not found", 404);
    }

    const respondentId = optionalStringValue(body.respondentId) ?? generatedRespondentId();
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .insert({
        respondent_id: respondentId,
        name,
        email,
        user_id: user.id,
      })
      .select("id, respondent_id")
      .single();
    if (participantError) throw participantError;

    createdParticipantId = participant.id;

    const { error: assignmentError } = await supabase.from("participant_study_assignments").insert({
      participant_id: participant.id,
      study_id: selectedStudyVersion.study_id,
      study_version_id: studyVersionId,
      assigned_by_user_id: callerUserId,
      status: "active",
    });
    if (assignmentError) throw assignmentError;

    createdUserId = null;
    createdParticipantId = null;

    return jsonResponse({
      kind,
      userId: user.id,
      participantId: participant.id,
      respondentId: participant.respondent_id,
      email,
      name,
      temporaryPassword,
    });
  } catch (error) {
    if (cleanupClient) {
      if (createdParticipantId) {
        const { error: cleanupParticipantError } = await cleanupClient
          .from("participants")
          .delete()
          .eq("id", createdParticipantId);
        if (cleanupParticipantError) {
          console.error("Failed to clean up participant after account creation error:", cleanupParticipantError);
        }
      }

      if (createdUserId) {
        const { error: cleanupUserError } = await cleanupClient.auth.admin.deleteUser(createdUserId);
        if (cleanupUserError) {
          console.error("Failed to clean up auth user after account creation error:", cleanupUserError);
        }
      }
    }

    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected account creation error";
    console.error("admin-create-user error:", error);
    return jsonResponse({ error: message }, status);
  }
});
