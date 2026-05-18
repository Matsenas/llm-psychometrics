import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Users, ClipboardList } from "lucide-react";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import { ParticipantsUserManagement } from "@/components/admin/ParticipantsUserManagement";
import { StudyManagement } from "@/components/admin/StudyManagement";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const Admin = () => (
  <AdminRouteGuard>
    {(admin) => <AdminShell currentUserId={admin.user.id} userEmail={admin.email} />}
  </AdminRouteGuard>
);

function AdminShell({ currentUserId, userEmail }: { currentUserId: string; userEmail: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const section = useMemo(() => (location.pathname.startsWith("/admin/studies") ? "studies" : "participants"), [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage participants, users, and study versions.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost-destructive" size="sm">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to logout from the admin dashboard?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs value={section} onValueChange={(value) => navigate(value === "studies" ? "/admin/studies" : "/admin/participants")}>
          <TabsList>
            <TabsTrigger value="participants">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="studies">
              <ClipboardList className="h-4 w-4" />
              Study Management
            </TabsTrigger>
          </TabsList>
          <TabsContent value="participants" className="mt-6">
            <ParticipantsUserManagement currentUserId={currentUserId} />
          </TabsContent>
          <TabsContent value="studies" className="mt-6">
            <StudyManagement currentUserId={currentUserId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Admin;
