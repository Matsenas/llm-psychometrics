import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { useToast } from "@/hooks/use-toast";
import {
  CUQ_ITEMS,
  PLAUSIBILITY_ITEM,
  RELATIONSHIP_USABILITY_ITEMS,
  SUS_ITEMS,
  USABILITY_LIKERT,
} from "@/lib/usabilityInstruments";
import { scoreCuq, scoreSus } from "@/lib/usabilityScoring";

const UsabilitySurvey = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, activeStudy, isLoading } = useParticipant();
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missingReason, setMissingReason] = useState<string | null>(null);

  const answeredCount = useMemo(
    () => RELATIONSHIP_USABILITY_ITEMS.filter((item) => responses[item.itemKey] !== undefined).length,
    [responses],
  );
  const progress = (answeredCount / RELATIONSHIP_USABILITY_ITEMS.length) * 100;
  const canSubmit = answeredCount === RELATIONSHIP_USABILITY_ITEMS.length;

  useEffect(() => {
    if (!isLoading) loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, isLoading]);

  const loadExisting = async () => {
    if (!participant) {
      navigate("/");
      return;
    }
    try {
      setMissingReason(null);
      const { data: summary, error: summaryError } = await supabase
        .from("attachment_classification_summaries")
        .select("id")
        .eq("participant_id", participant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (summaryError) throw summaryError;
      if (!summary) {
        setMissingReason("The attachment profile has not been generated yet, so these usability questions are not available.");
        return;
      }

      const { data, error } = await supabase
        .from("usability_responses")
        .select("instrument, item_key, response_value, response_text")
        .eq("participant_id", participant.id);
      if (error) throw error;

      const next: Record<string, number> = {};
      data?.forEach((row) => {
        if (typeof row.response_value === "number") {
          next[row.item_key] = row.response_value;
        }
        if (row.instrument === "feedback" && row.item_key === "free_text_feedback" && row.response_text) {
          setFeedback(row.response_text);
        }
      });
      setResponses(next);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!participant || !canSubmit) return;
    setSaving(true);
    try {
      const responseRows = RELATIONSHIP_USABILITY_ITEMS.map((item) => ({
        participant_id: participant.id,
        instrument: item.instrument,
        item_key: item.itemKey,
        item_text: item.text,
        response_value: responses[item.itemKey],
        response_text: null,
      }));

      responseRows.push({
        participant_id: participant.id,
        instrument: "feedback",
        item_key: "free_text_feedback",
        item_text: "Optional feedback",
        response_value: null,
        response_text: feedback.trim() || null,
      });

      const { error } = await supabase
        .from("usability_responses")
        .upsert(responseRows, { onConflict: "participant_id,instrument,item_key" });
      if (error) throw error;

      if (activeStudy?.assignmentId) {
        await supabase
          .from("participant_study_assignments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", activeStudy.assignmentId);
      }

      const cuq = scoreCuq(CUQ_ITEMS, responses);
      const sus = scoreSus(SUS_ITEMS, responses);
      toast({
        title: "Thank you",
        description: `Responses saved${cuq !== null && sus !== null ? ` (CUQ ${cuq.toFixed(1)}, SUS ${sus.toFixed(1)})` : ""}.`,
      });
      navigate("/results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save responses.";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (missingReason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-xl mx-auto space-y-6">
          <ParticipantHeader />
          <Card>
            <CardHeader>
              <CardTitle>Questions Not Ready</CardTitle>
              <CardDescription>{missingReason}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/attachment-profile")} className="w-full">
                Return to Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <ParticipantHeader />
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {answeredCount} of {RELATIONSHIP_USABILITY_ITEMS.length}
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usability Questions</CardTitle>
            <CardDescription>
              Please rate the interview system and the output you just saw.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <QuestionSection title="Chatbot Usability Questionnaire" items={CUQ_ITEMS} responses={responses} onChange={setResponses} />
            <QuestionSection title="System Usability Scale" items={SUS_ITEMS} responses={responses} onChange={setResponses} />
            <QuestionSection title="Output Plausibility" items={[PLAUSIBILITY_ITEM]} responses={responses} onChange={setResponses} />

            <div className="space-y-3">
              <Label className="text-base font-medium">Additional Feedback (Optional)</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share anything else about the experience..."
                className="min-h-[100px]"
              />
            </div>

            <Button onClick={handleSubmit} disabled={!canSubmit || saving} className="w-full" size="lg">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Responses
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const QuestionSection = ({
  title,
  items,
  responses,
  onChange,
}: {
  title: string;
  items: typeof RELATIONSHIP_USABILITY_ITEMS;
  responses: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) => (
  <section className="space-y-4">
    <h3 className="font-semibold">{title}</h3>
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.itemKey} className="space-y-3 rounded-lg bg-muted/50 p-4">
          <Label className="text-sm font-medium">{item.text}</Label>
          <RadioGroup
            value={responses[item.itemKey]?.toString() ?? ""}
            onValueChange={(value) => onChange({ ...responses, [item.itemKey]: parseInt(value, 10) })}
            className="grid gap-2 sm:grid-cols-5"
          >
            {USABILITY_LIKERT.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value.toString()} id={`${item.itemKey}-${option.value}`} />
                <Label htmlFor={`${item.itemKey}-${option.value}`} className="cursor-pointer text-xs">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  </section>
);

export default UsabilitySurvey;
