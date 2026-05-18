import { ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAdmin } from "@/lib/adminAuth";

interface AdminRouteGuardProps {
  children: (admin: { user: User; email: string | null }) => ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [denied, setDenied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (!mounted) return;

        if (!admin.session) {
          navigate("/auth");
          return;
        }

        if (!admin.isAdmin || !admin.user) {
          setDenied(true);
          return;
        }

        setAdminUser(admin.user);
      } catch (error) {
        console.error("Error checking admin access:", error);
        if (mounted) setDenied(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (denied || !adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You do not have admin permissions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children({ user: adminUser, email: adminUser.email ?? null })}</>;
}
