import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParticipant } from "@/contexts/ParticipantContext";

const NoStudy = () => {
  const navigate = useNavigate();
  const { participant, clearParticipant } = useParticipant();

  const handleSignOut = async () => {
    await clearParticipant();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>No Study Assigned</CardTitle>
          <CardDescription>
            You are signed in, but the research team has not assigned a study to this email yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {participant?.email
              ? `Signed in as ${participant.email}.`
              : "Your sign-in was successful."} Please contact the research team if you expected access.
          </p>
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoStudy;
