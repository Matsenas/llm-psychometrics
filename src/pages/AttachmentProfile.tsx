import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { useToast } from "@/hooks/use-toast";

interface AttachmentSummary {
  mean_anxiety: number;
  mean_avoidance: number;
  sd_anxiety: number;
  sd_avoidance: number;
  modal_prototype: string;
  displayed_narrative: string | null;
  completed_runs: number;
}

const PROTOTYPE_LABELS: Record<string, string> = {
  secure: "Secure",
  preoccupied: "Preoccupied",
  dismissive: "Dismissive",
  fearful: "Fearful",
};

const AttachmentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading } = useParticipant();
  const [summary, setSummary] = useState<AttachmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [missingReason, setMissingReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, isLoading]);

  const loadSummary = async () => {
    if (!participant) {
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      setMissingReason(null);
      const { data } = await supabase
        .from("attachment_classification_summaries")
        .select("mean_anxiety, mean_avoidance, sd_anxiety, sd_avoidance, modal_prototype, displayed_narrative, completed_runs")
        .eq("participant_id", participant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSummary({
          mean_anxiety: Number(data.mean_anxiety),
          mean_avoidance: Number(data.mean_avoidance),
          sd_anxiety: Number(data.sd_anxiety),
          sd_avoidance: Number(data.sd_avoidance),
          modal_prototype: data.modal_prototype,
          displayed_narrative: data.displayed_narrative,
          completed_runs: data.completed_runs,
        });
      } else {
        const session = await loadCompletedRelationshipSession();
        if (!session) {
          setMissingReason("The relationship interview has not been completed yet, so there is no conversation to analyze.");
          return;
        }
        await runClassification();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile.";
      toast({ title: "Profile unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runClassification = async () => {
    if (!participant || running) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-attachment-classification", {
        body: { participantId: participant.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Classification did not complete.");
      setSummary({
        mean_anxiety: Number(data.summary.mean_anxiety),
        mean_avoidance: Number(data.summary.mean_avoidance),
        sd_anxiety: Number(data.summary.sd_anxiety),
        sd_avoidance: Number(data.summary.sd_avoidance),
        modal_prototype: data.summary.modal_prototype,
        displayed_narrative: data.summary.displayed_narrative,
        completed_runs: data.summary.completed_runs,
      });
    } finally {
      setRunning(false);
    }
  };

  const loadCompletedRelationshipSession = async () => {
    if (!participant) return null;

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, is_complete")
      .eq("participant_id", participant.id)
      .eq("session_number", 1)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.is_complete ? data : null;
  };

  if (!isLoading && !loading && missingReason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-xl mx-auto space-y-6">
          <ParticipantHeader />
          <Card>
            <CardHeader>
              <CardTitle>Profile Not Ready</CardTitle>
              <CardDescription>{missingReason}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/chat")} className="w-full">
                Return to Interview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || loading || running || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-center text-muted-foreground">
              Analyzing the conversation...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const anxietyPercent = ((summary.mean_anxiety - 1) / 6) * 100;
  const avoidancePercent = ((summary.mean_avoidance - 1) / 6) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <ParticipantHeader />

        <Card>
          <CardHeader>
            <CardTitle>Experimental Attachment Profile</CardTitle>
            <CardDescription>
              This is an LLM-generated research output based on the conversation. It is not a clinical assessment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <ScoreBar label="Anxiety" value={summary.mean_anxiety} sd={summary.sd_anxiety} percent={anxietyPercent} />
              <ScoreBar label="Avoidance" value={summary.mean_avoidance} sd={summary.sd_avoidance} percent={avoidancePercent} />
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Prototype</p>
              <p className="text-xl font-semibold">
                {PROTOTYPE_LABELS[summary.modal_prototype] ?? summary.modal_prototype}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on {summary.completed_runs} classifier run{summary.completed_runs === 1 ? "" : "s"}.
              </p>
            </div>

            {summary.displayed_narrative && (
              <div className="space-y-2">
                <h3 className="font-semibold">Narrative</h3>
                <p className="text-sm leading-6 text-muted-foreground">{summary.displayed_narrative}</p>
              </div>
            )}

            <Button onClick={() => navigate("/usability")} size="lg" className="w-full">
              Continue to Usability Questions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ScoreBar = ({ label, value, sd, percent }: { label: string; value: number; sd: number; percent: number }) => (
  <div className="rounded-lg bg-muted/50 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <span className="text-lg font-semibold">{value.toFixed(2)}</span>
    </div>
    <Progress value={percent} className="h-2" />
    <p className="text-xs text-muted-foreground">1-7 scale, SD {sd.toFixed(2)}</p>
  </div>
);

export default AttachmentProfile;
