import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck, ShieldMinus, ShieldPlus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/appUrl";

interface AdminRoleManagerProps {
  currentUserId: string;
}

interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: "admin" | "user";
}

interface CreatedAdminCredentials {
  email: string;
  name: string;
  temporaryPassword: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function functionErrorMessage(data: unknown, error: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }
  return errorMessage(error);
}

export function AdminRoleManager({ currentUserId }: AdminRoleManagerProps) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createdAdminAccount, setCreatedAdminAccount] = useState<CreatedAdminCredentials | null>(null);
  const [copiedAdminCredentials, setCopiedAdminCredentials] = useState(false);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adminUserIds = useMemo(
    () => new Set(roles.filter((role) => role.role === "admin").map((role) => role.user_id)),
    [roles],
  );
  const adminCount = adminUserIds.size;

  async function loadUsers() {
    try {
      setLoading(true);
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("id, email, name").order("email"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setProfiles((profilesResult.data ?? []) as ProfileRow[]);
      setRoles((rolesResult.data ?? []) as RoleRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load users";
      toast({ title: "Admin users unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function grantAdmin(profile: ProfileRow) {
    setMutatingUserId(profile.id);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.id, role: "admin" });
      if (error) throw error;

      await supabase.from("admin_role_events").insert({
        actor_user_id: currentUserId,
        target_user_id: profile.id,
        action: "grant_admin",
      });

      toast({ title: "Admin granted", description: `${profile.email} can now access admin tools.` });
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to grant admin role";
      toast({ title: "Grant failed", description: message, variant: "destructive" });
    } finally {
      setMutatingUserId(null);
    }
  }

  async function revokeAdmin(profile: ProfileRow) {
    if (adminCount <= 1) {
      toast({
        title: "Cannot revoke final admin",
        description: "At least one admin account must remain.",
        variant: "destructive",
      });
      return;
    }

    const confirmationMessage = profile.id === currentUserId
      ? "Revoke your own admin access? You will lose access after this session refreshes."
      : `Revoke admin access for ${profile.email}?`;
    if (!window.confirm(confirmationMessage)) return;

    setMutatingUserId(profile.id);
    try {
      const adminRole = roles.find((role) => role.user_id === profile.id && role.role === "admin");
      if (!adminRole) return;

      const { error } = await supabase.from("user_roles").delete().eq("id", adminRole.id);
      if (error) throw error;

      await supabase.from("admin_role_events").insert({
        actor_user_id: currentUserId,
        target_user_id: profile.id,
        action: "revoke_admin",
      });

      toast({ title: "Admin revoked", description: `${profile.email} no longer has admin access.` });
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to revoke admin role";
      toast({ title: "Revoke failed", description: message, variant: "destructive" });
    } finally {
      setMutatingUserId(null);
    }
  }

  async function deleteUser(profile: ProfileRow) {
    const isAdmin = adminUserIds.has(profile.id);

    if (profile.id === currentUserId) {
      toast({
        title: "Cannot delete yourself",
        description: "Ask another admin to delete this account if it needs to be removed.",
        variant: "destructive",
      });
      return;
    }

    if (isAdmin && adminCount <= 1) {
      toast({
        title: "Cannot delete final admin",
        description: "At least one admin account must remain.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Delete ${profile.email}? This removes sign-in access and cannot be undone.`)) return;

    setMutatingUserId(profile.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { targetUserId: profile.id },
      });

      if (error) throw new Error(functionErrorMessage(data, error));

      toast({ title: "User deleted", description: `${profile.email} sign-in access was removed.` });
      await loadUsers();
    } catch (error) {
      toast({ title: "Delete failed", description: errorMessage(error), variant: "destructive" });
    } finally {
      setMutatingUserId(null);
    }
  }

  async function createAdminAccount() {
    const name = newAdminName.trim();
    const email = newAdminEmail.trim().toLowerCase();

    if (!name) {
      toast({
        title: "Name required",
        description: "Enter the admin's name before creating the account.",
        variant: "destructive",
      });
      return;
    }

    if (!email) {
      toast({
        title: "Email required",
        description: "Admin accounts require an email address.",
        variant: "destructive",
      });
      return;
    }

    setCreatingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          kind: "admin",
          name,
          email,
        },
      });

      if (error) throw new Error(functionErrorMessage(data, error));

      const created = data as CreatedAdminCredentials;
      setCreatedAdminAccount(created);
      setNewAdminName("");
      setNewAdminEmail("");
      toast({ title: "Admin account created", description: `${created.email} can now access admin tools.` });
      await loadUsers();
    } catch (error) {
      toast({ title: "Admin creation failed", description: errorMessage(error), variant: "destructive" });
    } finally {
      setCreatingAdmin(false);
    }
  }

  function copyCreatedAdminCredentials() {
    if (!createdAdminAccount) return;
    navigator.clipboard.writeText(
      [
        `Admin sign in: ${appUrl("/auth")}`,
        `Email: ${createdAdminAccount.email}`,
        `Temporary password: ${createdAdminAccount.temporaryPassword}`,
      ].join("\n"),
    );
    setCopiedAdminCredentials(true);
    setTimeout(() => setCopiedAdminCredentials(false), 2000);
    toast({ title: "Copied!", description: "Admin sign-in details copied to clipboard." });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Create admin accounts or grant access for existing users.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Dialog
              open={addAdminOpen}
              onOpenChange={(open) => {
                setAddAdminOpen(open);
                if (!open) {
                  setCreatedAdminAccount(null);
                  setCopiedAdminCredentials(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Admin Account</DialogTitle>
                  <DialogDescription>
                    Create an email/password account with administrator access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {createdAdminAccount ? (
                    <div className="space-y-4">
                      <div className="rounded-md border bg-muted/50 p-3 text-sm">
                        <div className="font-medium">Temporary admin sign-in details</div>
                        <div className="mt-3 grid gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground">Admin sign-in URL</div>
                            <div className="font-mono text-xs">{appUrl("/auth")}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Email</div>
                            <div className="font-mono text-xs">{createdAdminAccount.email}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Temporary password</div>
                            <div className="font-mono text-xs">{createdAdminAccount.temporaryPassword}</div>
                          </div>
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={copyCreatedAdminCredentials} className="w-full">
                        {copiedAdminCredentials ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        Copy Sign-In Details
                      </Button>
                      <Button type="button" onClick={() => setCreatedAdminAccount(null)} className="w-full">
                        Add Another Admin
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="admin-name">Name</Label>
                        <Input
                          id="admin-name"
                          value={newAdminName}
                          onChange={(event) => setNewAdminName(event.target.value)}
                          placeholder="Admin name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          value={newAdminEmail}
                          onChange={(event) => setNewAdminEmail(event.target.value)}
                          placeholder="admin@example.com"
                        />
                      </div>
                      <Button onClick={createAdminAccount} disabled={creatingAdmin} className="w-full">
                        {creatingAdmin ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="mr-2 h-4 w-4" />
                        )}
                        Create Admin Account
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => {
                const isAdmin = adminUserIds.has(profile.id);
                const isMutating = mutatingUserId === profile.id;
                const isFinalAdmin = isAdmin && adminCount <= 1;
                return (
                  <TableRow key={profile.id}>
                    <TableCell>{profile.name || "-"}</TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{profile.id}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-sm text-primary">
                          <ShieldCheck className="h-4 w-4" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">User</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {isAdmin ? (
                          <Button
                            variant="ghost-destructive"
                            size="sm"
                            disabled={isMutating || isFinalAdmin}
                            onClick={() => revokeAdmin(profile)}
                            title={isFinalAdmin ? "Cannot revoke the final admin" : "Revoke admin access"}
                          >
                            {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldMinus className="h-4 w-4" />}
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isMutating}
                            onClick={() => grantAdmin(profile)}
                          >
                            {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
                            Grant
                          </Button>
                        )}
                        <Button
                          variant="ghost-destructive"
                          size="sm"
                          disabled={isMutating || profile.id === currentUserId || isFinalAdmin}
                          onClick={() => deleteUser(profile)}
                          title={
                            profile.id === currentUserId
                              ? "Cannot delete yourself"
                              : isFinalAdmin
                                ? "Cannot delete the final admin"
                                : "Delete user"
                          }
                        >
                          {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
