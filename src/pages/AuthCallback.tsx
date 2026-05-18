import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParticipant } from "@/contexts/ParticipantContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { bootstrapAuthenticatedParticipant } = useParticipant();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const finish = async () => {
      try {
        const participant = await bootstrapAuthenticatedParticipant();
        if (!participant) {
          setError("We could not find an authenticated session. Please return to sign in with your email and password.");
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to complete sign-in.";
        setError(message);
      }
    };

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign-In Issue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default AuthCallback;
