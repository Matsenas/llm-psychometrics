import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { LogOut, Copy, Check } from "lucide-react";
import universityLogo from "@/assets/university-of-tartu-logo.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParticipantHeaderProps {
  hasSubmitted?: boolean;
}

const ParticipantHeader = ({ hasSubmitted = false }: ParticipantHeaderProps) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { participant, clearParticipant } = useParticipant();

  const handleEndSession = () => {
    if (hasSubmitted) {
      endSession();
    } else {
      setShowConfirmDialog(true);
    }
  };

  const endSession = () => {
    clearParticipant();
    navigate("/");
  };

  if (!participant) return null;

  return (
    <>
      <div className="flex items-center justify-between bg-primary text-primary-foreground rounded-lg px-4 py-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white overflow-hidden">
            <img src={universityLogo} alt="University of Tartu" className="w-6 h-6 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {participant.name || "Participant"}
            </span>
            <span className="text-xs text-primary-foreground/70">
              ID: {participant.respondent_id}
            </span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleEndSession} className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
          <LogOut className="h-4 w-4 mr-2" />
          Exit Session
        </Button>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) setCopied(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit session?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to end your session? Your progress will be saved, 
                  but you will need to re-enter your ID to continue.
                </p>
                <p>Your ID:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <span className="font-medium text-foreground">{participant?.respondent_id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(participant?.respondent_id || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={endSession}>
              Exit Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ParticipantHeader;
