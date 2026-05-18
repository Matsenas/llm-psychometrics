import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import universityLogo from "@/assets/university-of-tartu-logo.png";
import { getNextRouteForParticipant } from "@/studies/progress";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const {
    participant,
    isLoading: participantLoading,
    session,
    activeStudy,
    bootstrapAuthenticatedParticipant,
  } = useParticipant();
  const { toast } = useToast();

  useEffect(() => {
    if (!participantLoading) {
      checkUserStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantLoading, participant, session, activeStudy]);

  const checkUserStatus = async () => {
    try {
      if (session && !session.user.is_anonymous) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        if (!participant) {
          const bootstrapped = await bootstrapAuthenticatedParticipant();
          if (bootstrapped) {
            setLoading(false);
            return;
          }
        }
      }

      if (participant) {
        const route = await getNextRouteForParticipant(participant, activeStudy);
        navigate(route, { replace: true });
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error("Error checking user status:", error);
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!normalizedEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedPassword.length < 6) {
      toast({
        title: "Password Required",
        description: "Please enter a password with at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: trimmedPassword,
      });

      if (error) throw error;

      const bootstrapped = await bootstrapAuthenticatedParticipant();
      if (!bootstrapped) {
        await supabase.auth.signOut();
        throw new Error("No study account is assigned to this email address.");
      }

      toast({
        title: "Signed in",
        description: "Your study session is ready.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      toast({
        title: "Sign-In Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || participantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={universityLogo} alt="University of Tartu" className="h-20 w-20 object-contain mx-auto" />
          <div className="space-y-2">
            <CardTitle className="text-2xl">AI Study Sign In</CardTitle>
            <CardDescription className="text-sm">
              Sign in with the email address and password for your study account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handlePasswordAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="participant-email">Email</Label>
                <Input
                  id="participant-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participant-password">Password</Label>
                <Input
                  id="participant-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Sign In
              </Button>
          </form>

          <div className="text-center pt-2 border-t">
            <p className="text-sm text-muted-foreground pt-3">
              Have a legacy respondent link? Open that link directly to continue.
            </p>
          </div>

          {isAdmin && (
            <div className="text-center pt-3 border-t mt-3">
              <p className="text-sm text-muted-foreground">
                Admin preview mode -{" "}
                <button
                  onClick={() => navigate("/admin")}
                  className="text-primary underline hover:text-primary/80"
                >
                  Go to Admin Dashboard
                </button>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
