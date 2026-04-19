import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, Shield, ChevronLeft } from "lucide-react";
import confetti from "canvas-confetti";
import ParticipantHeader from "@/components/ParticipantHeader";
import { ECR_ITEMS, ECR_ITEM_COUNT } from "@/lib/ecrItems";
import { scoreEcrResponses } from "@/lib/ecrScoring";

const ITEMS_PER_PAGE = 4;
const TOTAL_PAGES = Math.ceil(ECR_ITEM_COUNT / ITEMS_PER_PAGE);

const LIKERT_SCALE = [
  { value: 7, label: "Strongly Agree" },
  { value: 6, label: "Agree" },
  { value: 5, label: "Slightly Agree" },
  { value: 4, label: "Neutral / Mixed" },
  { value: 3, label: "Slightly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 1, label: "Strongly Disagree" },
];

const MILESTONE_MESSAGES: Record<number, { title: string; message: string }> = {
  9: { title: "Quarter way done!", message: "Great start! Keep going — you're doing amazing." },
  18: { title: "Halfway there!", message: "You're crushing it. Just 18 more to go." },
  27: { title: "Almost finished!", message: "So close — only 9 more to go." },
};

const ORDER_STORAGE_PREFIX = "ecr_item_order_";

function loadStoredOrder(participantId: string): number[] | null {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_PREFIX + participantId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length !== ECR_ITEM_COUNT ||
      !parsed.every((n) => typeof n === "number")
    ) {
      return null;
    }
    return parsed as number[];
  } catch {
    return null;
  }
}

function persistOrder(participantId: string, order: number[]): void {
  try {
    localStorage.setItem(ORDER_STORAGE_PREFIX + participantId, JSON.stringify(order));
  } catch {
    // Safari private mode throws on setItem; tolerate the loss.
  }
}

function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function triggerConfetti(): void {
  const end = Date.now() + 1500;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#2C5697", "#4A7BC7", "#FFD700", "#FFA500"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#2C5697", "#4A7BC7", "#FFD700", "#FFA500"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export function EcrQuestionnaire() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading: participantLoading } = useParticipant();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({}); // keyed by itemNumber
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Determine presentation order: stored (if valid) or a fresh shuffle.
  const presentationOrder = useMemo<number[]>(() => {
    if (!participant) return ECR_ITEMS.map((i) => i.itemNumber);
    const stored = loadStoredOrder(participant.id);
    if (stored) return stored;
    const fresh = shuffle(ECR_ITEMS.map((i) => i.itemNumber));
    persistOrder(participant.id, fresh);
    return fresh;
  }, [participant]);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .maybeSingle();
          setIsAdmin(!!roleData);
        }
      } finally {
        setCheckingAdmin(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (checkingAdmin || participantLoading) return;
    if (!participant) {
      setInitialLoading(false);
      return;
    }
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("ecr_responses")
          .select("item_number, response_value")
          .eq("participant_id", participant.id);
        if (error) throw error;
        if (data && data.length > 0) {
          if (data.length >= ECR_ITEM_COUNT && !isAdmin) {
            navigate("/accuracy");
            return;
          }
          const restored: Record<number, number> = {};
          data.forEach((r) => {
            restored[r.item_number] = r.response_value;
          });
          setResponses(restored);
          const answeredCount = data.length;
          const startIndex = Math.floor(answeredCount / ITEMS_PER_PAGE) * ITEMS_PER_PAGE;
          setCurrentIndex(startIndex);
          if (answeredCount > 0) {
            toast({
              title: "Progress Restored",
              description: `Resuming from question ${startIndex + 1}`,
            });
          }
        }
      } catch (err) {
        console.error("Error loading ECR responses:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [participant, participantLoading, checkingAdmin, isAdmin, navigate, toast]);

  const currentItemNumbers = presentationOrder.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);
  const currentPage = Math.floor(currentIndex / ITEMS_PER_PAGE) + 1;
  const progress = (currentPage / TOTAL_PAGES) * 100;
  const isLastBatch = currentIndex + ITEMS_PER_PAGE >= ECR_ITEM_COUNT;

  const canProceed = currentItemNumbers.every((num) => responses[num] !== undefined);

  const handleResponse = (itemNumber: number, value: number) => {
    setResponses((prev) => ({ ...prev, [itemNumber]: value }));
  };

  const saveCurrentBatch = async (): Promise<boolean> => {
    if (!participant) return true;
    setSaving(true);
    try {
      const batch = currentItemNumbers.map((num) => ({
        participant_id: participant.id,
        item_number: num,
        response_value: responses[num],
      }));
      const { error } = await supabase
        .from("ecr_responses")
        .upsert(batch, { onConflict: "participant_id,item_number" });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error saving ECR responses:", err);
      toast({
        title: "Error saving responses",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const finalizeScoring = async (): Promise<void> => {
    if (!participant) return;
    try {
      const scored = scoreEcrResponses(
        Object.entries(responses).map(([itemNumber, value]) => ({
          itemNumber: Number(itemNumber),
          value,
        })),
      );
      const { error } = await supabase
        .from("attachment_scores")
        .upsert(
          {
            participant_id: participant.id,
            method: "self",
            anxiety: Number(scored.anxiety.toFixed(2)),
            avoidance: Number(scored.avoidance.toFixed(2)),
            llm_metadata: null,
          },
          { onConflict: "participant_id,method" },
        );
      if (error) throw error;
    } catch (err) {
      console.error("Error storing ECR self-report scores:", err);
      toast({
        title: "Scoring issue",
        description: "Your responses were saved but self-report scoring failed. Please retry on the next screen.",
        variant: "destructive",
      });
    }
  };

  const handleNext = async () => {
    setLoading(true);
    if (participant) {
      const ok = await saveCurrentBatch();
      if (!ok) {
        setLoading(false);
        return;
      }
    }
    const completedCount = currentIndex + ITEMS_PER_PAGE;
    if (isLastBatch) {
      if (participant) await finalizeScoring();
      triggerConfetti();
      toast({
        title: "Questionnaire Complete!",
        description: "Amazing work. One more step to go...",
      });
      navigate("/feedback-intro");
    } else {
      const milestone = MILESTONE_MESSAGES[completedCount];
      if (milestone) {
        triggerConfetti();
        toast({ title: milestone.title, description: milestone.message });
      }
      setCurrentIndex((prev) => prev + ITEMS_PER_PAGE);
    }
    setLoading(false);
  };

  if (participantLoading || initialLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md p-6">
          <h3 className="text-lg font-semibold text-destructive mb-2">No Session Found</h3>
          <p className="text-muted-foreground">
            Please use your unique session link to access the survey.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {isAdmin && !participant && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2 text-sm text-primary">
            <Shield className="h-4 w-4" />
            Admin preview mode — redirects disabled
          </div>
        )}
        {participant && <ParticipantHeader />}
        <div className="flex items-center gap-3">
          {currentIndex > 0 && (
            <Button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - ITEMS_PER_PAGE))}
              disabled={loading}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Progress value={progress} className="h-2 flex-1 bg-progress-track" />
          <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-2">
            {currentPage} of {TOTAL_PAGES}
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          </span>
        </div>

        <div className="p-3 bg-muted/40 border rounded-lg text-sm text-muted-foreground leading-relaxed">
          <p>
            The statements below concern how you feel in emotionally intimate relationships.
            We're interested in how you <em>generally</em> experience close relationships —
            not just what is happening in a current one.
          </p>
        </div>

        {isLastBatch && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 ring-2 ring-primary/50 rounded-lg animate-fade-in">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Final Questions! You're almost done.</span>
          </div>
        )}

        <div className="space-y-6">
          {currentItemNumbers.map((itemNumber) => {
            const item = ECR_ITEMS.find((i) => i.itemNumber === itemNumber)!;
            return (
              <Card key={itemNumber}>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-lg font-medium">{item.text}</p>
                  <RadioGroup
                    value={responses[itemNumber]?.toString()}
                    onValueChange={(value) => handleResponse(itemNumber, parseInt(value, 10))}
                  >
                    {LIKERT_SCALE.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={option.value.toString()}
                          id={`ecr-${itemNumber}-${option.value}`}
                        />
                        <Label
                          htmlFor={`ecr-${itemNumber}-${option.value}`}
                          className="cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button onClick={handleNext} disabled={!canProceed || loading} className="w-full" size="lg">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLastBatch ? "Complete Questionnaire" : "Next"}
        </Button>

        <p className="text-xs text-muted-foreground text-center pt-2">
          ECR-R: Fraley, Waller, &amp; Brennan (2000), <em>Experiences in Close Relationships-Revised</em>.
        </p>
      </div>
    </div>
  );
}
