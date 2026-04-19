import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, Shield, ChevronLeft } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import confetti from "canvas-confetti";
import { EcrQuestionnaire } from "@/components/ecr/EcrQuestionnaire";
import { assertNever } from "@/lib/assertNever";

// Milestone messages for encouragement (at 25%, 50%, 75%)
const MILESTONE_MESSAGES: Record<number, { title: string; message: string }> = {
  12: { title: "Quarter way done!", message: "Great start! Keep going, you're doing amazing." },
  24: { title: "Halfway there!", message: "You're crushing it! Just 26 more to go." },
  36: { title: "Almost finished!", message: "So close! Only 14 more to go—you've got this!" },
};

const IPIP_ITEMS = [
  { text: "I am the life of the party", positive: true, trait: "Extraversion" },
  { text: "I feel little concern for others", positive: false, trait: "Agreeableness" },
  { text: "I am always prepared", positive: true, trait: "Conscientiousness" },
  { text: "I get stressed out easily", positive: true, trait: "Neuroticism" },
  { text: "I have a rich vocabulary", positive: true, trait: "Openness" },
  { text: "I don't talk a lot", positive: false, trait: "Extraversion" },
  { text: "I am interested in people", positive: true, trait: "Agreeableness" },
  { text: "I leave my belongings around", positive: false, trait: "Conscientiousness" },
  { text: "I am relaxed most of the time", positive: false, trait: "Neuroticism" },
  { text: "I have difficulty understanding abstract ideas", positive: false, trait: "Openness" },
  { text: "I feel comfortable around people", positive: true, trait: "Extraversion" },
  { text: "I insult people", positive: false, trait: "Agreeableness" },
  { text: "I pay attention to details", positive: true, trait: "Conscientiousness" },
  { text: "I worry about things", positive: true, trait: "Neuroticism" },
  { text: "I have a vivid imagination", positive: true, trait: "Openness" },
  { text: "I keep in the background", positive: false, trait: "Extraversion" },
  { text: "I sympathize with others' feelings", positive: true, trait: "Agreeableness" },
  { text: "I make a mess of things", positive: false, trait: "Conscientiousness" },
  { text: "I seldom feel blue", positive: false, trait: "Neuroticism" },
  { text: "I am not interested in abstract ideas", positive: false, trait: "Openness" },
  { text: "I start conversations", positive: true, trait: "Extraversion" },
  { text: "I am not interested in other people's problems", positive: false, trait: "Agreeableness" },
  { text: "I get chores done right away", positive: true, trait: "Conscientiousness" },
  { text: "I am easily disturbed", positive: true, trait: "Neuroticism" },
  { text: "I have excellent ideas", positive: true, trait: "Openness" },
  { text: "I have little to say", positive: false, trait: "Extraversion" },
  { text: "I have a soft heart", positive: true, trait: "Agreeableness" },
  { text: "I often forget to put things back in their proper place", positive: false, trait: "Conscientiousness" },
  { text: "I get upset easily", positive: true, trait: "Neuroticism" },
  { text: "I do not have a good imagination", positive: false, trait: "Openness" },
  { text: "I talk to a lot of different people at parties", positive: true, trait: "Extraversion" },
  { text: "I am not really interested in others", positive: false, trait: "Agreeableness" },
  { text: "I like order", positive: true, trait: "Conscientiousness" },
  { text: "I change my mood a lot", positive: true, trait: "Neuroticism" },
  { text: "I am quick to understand things", positive: true, trait: "Openness" },
  { text: "I don't like to draw attention to myself", positive: false, trait: "Extraversion" },
  { text: "I take time out for others", positive: true, trait: "Agreeableness" },
  { text: "I shirk my duties", positive: false, trait: "Conscientiousness" },
  { text: "I have frequent mood swings", positive: true, trait: "Neuroticism" },
  { text: "I use difficult words", positive: true, trait: "Openness" },
  { text: "I don't mind being the center of attention", positive: true, trait: "Extraversion" },
  { text: "I feel others' emotions", positive: true, trait: "Agreeableness" },
  { text: "I follow a schedule", positive: true, trait: "Conscientiousness" },
  { text: "I get irritated easily", positive: true, trait: "Neuroticism" },
  { text: "I spend time reflecting on things", positive: true, trait: "Openness" },
  { text: "I am quiet around strangers", positive: false, trait: "Extraversion" },
  { text: "I make people feel at ease", positive: true, trait: "Agreeableness" },
  { text: "I am exacting in my work", positive: true, trait: "Conscientiousness" },
  { text: "I often feel blue", positive: true, trait: "Neuroticism" },
  { text: "I am full of ideas", positive: true, trait: "Openness" },
];

const LIKERT_SCALE = [
  { value: 5, label: "Strongly Agree" },
  { value: 4, label: "Agree" },
  { value: 3, label: "Neutral" },
  { value: 2, label: "Disagree" },
  { value: 1, label: "Strongly Disagree" },
];

const Questionnaire = () => {
  const { participant } = useParticipant();
  // Route per-participant: ECR gets the 36-item ECR-R, big5 gets the existing IPIP-50.
  // Admins with no participant default to the Big Five preview.
  if (participant) {
    switch (participant.assessment_type) {
      case "ecr":
        return <EcrQuestionnaire />;
      case "big5":
        break; // fall through to existing IPIP rendering below
      default:
        return assertNever(participant.assessment_type);
    }
  }
  return <BigFiveQuestionnaire />;
};

const BigFiveQuestionnaire = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingResponse, setSavingResponse] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading: participantLoading } = useParticipant();

  const isLastBatch = currentIndex + 3 >= IPIP_ITEMS.length;

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
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
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 1500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#2C5697', '#4A7BC7', '#FFD700', '#FFA500'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#2C5697', '#4A7BC7', '#FFD700', '#FFA500'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Load existing responses on mount
  useEffect(() => {
    if (!checkingAdmin && (participant || isAdmin)) {
      if (participant && !participantLoading) {
        loadExistingResponses();
      } else if (isAdmin && !participant) {
        setInitialLoading(false);
      }
    }
  }, [participant, participantLoading, checkingAdmin, isAdmin]);

  const loadExistingResponses = async () => {
    if (!participant) return;
    
    try {
      const { data: existingResponses, error } = await supabase
        .from("ipip_responses")
        .select("item_number, response_value")
        .eq("participant_id", participant.id)
        .order("item_number");

      if (error) throw error;

      if (existingResponses && existingResponses.length > 0) {
        // If all 50 responses exist, redirect to results (unless admin)
        if (existingResponses.length >= 50 && !isAdmin) {
          navigate("/accuracy");
          return;
        }

        // Restore responses to state
        const restoredResponses: Record<number, number> = {};
        existingResponses.forEach(r => {
          restoredResponses[r.item_number - 1] = r.response_value;
        });
        setResponses(restoredResponses);

        // Calculate starting index based on saved responses
        // Find the highest consecutive answered item and start from next batch
        const answeredCount = existingResponses.length;
        const startIndex = Math.floor(answeredCount / 3) * 3;
        setCurrentIndex(startIndex);

        if (answeredCount > 0) {
          toast({
            title: "Progress Restored",
            description: `Resuming from question ${startIndex + 1}`,
          });
        }
      }
    } catch (error) {
      console.error("Error loading existing responses:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const currentItems = IPIP_ITEMS.slice(currentIndex, currentIndex + 3);
  const totalPages = Math.ceil(IPIP_ITEMS.length / 3);
  const currentPage = Math.floor(currentIndex / 3) + 1;
  const progress = (currentPage / totalPages) * 100;

  const handleResponse = (itemIndex: number, value: number) => {
    // Update local state only - saving happens on Next click
    setResponses(prev => ({ ...prev, [itemIndex]: value }));
  };

  const canProceed = currentItems.every((_, idx) => 
    responses[currentIndex + idx] !== undefined
  );

  const saveCurrentBatch = async () => {
    if (!participant) return true;
    
    setSavingResponse(true);
    try {
      // Save responses for current batch of questions using upsert
      const batchResponses = currentItems.map((item, idx) => {
        const itemIndex = currentIndex + idx;
        return {
          participant_id: participant.id,
          item_number: itemIndex + 1,
          item_text: item.text,
          is_positive_key: item.positive,
          response_value: responses[itemIndex],
        };
      });

      const { error } = await supabase
        .from("ipip_responses")
        .upsert(batchResponses, { 
          onConflict: "participant_id,item_number" 
        });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving responses:", error);
      toast({
        title: "Error saving responses",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSavingResponse(false);
    }
    return true;
  };

  const handleNext = async () => {
    setLoading(true);
    
    // Skip saving for admin preview without participant
    if (participant) {
      const saved = await saveCurrentBatch();
      if (!saved) {
        setLoading(false);
        return;
      }
    }

    // Calculate completed count after this save
    const completedCount = currentIndex + 3;

    if (currentIndex + 3 >= IPIP_ITEMS.length) {
      // Trigger IPIP scoring in background
      if (participant) {
        supabase.rpc('calculate_and_store_ipip_scores', { 
          p_participant_id: participant.id 
        }).then(({ error }) => {
          if (error) console.error("Background IPIP scoring error:", error);
          else console.log("IPIP scoring completed successfully");
        });
      }
      
      triggerConfetti();
      toast({
        title: "Questionnaire Complete!",
        description: "Amazing work! One more step to go...",
      });
      navigate("/feedback-intro");
    } else {
      // Check for milestones (12, 24, 36 items = 25%, 50%, 75%)
      if (MILESTONE_MESSAGES[completedCount]) {
        const milestone = MILESTONE_MESSAGES[completedCount];
        triggerConfetti();
        toast({
          title: milestone.title,
          description: milestone.message,
        });
      }
      setCurrentIndex(prev => prev + 3);
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">No Session Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please use your unique session link to access the survey.
            </p>
          </CardContent>
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
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 3))}
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
            {currentPage} of {totalPages}
            {savingResponse && <Loader2 className="h-3 w-3 animate-spin" />}
          </span>
        </div>

        {/* Last batch indicator */}
        {isLastBatch && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 ring-2 ring-primary/50 rounded-lg animate-fade-in">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Final Questions! You're almost done.</span>
          </div>
        )}

        <div className="space-y-6">
          {currentItems.map((item, idx) => (
            <Card key={currentIndex + idx}>
              <CardContent className="pt-6 space-y-4">
                <p className="text-lg font-medium">{item.text}</p>
                <RadioGroup
                  value={responses[currentIndex + idx]?.toString()}
                  onValueChange={(value) => handleResponse(currentIndex + idx, parseInt(value))}
                >
                  {LIKERT_SCALE.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value.toString()} id={`${currentIndex + idx}-${option.value}`} />
                      <Label htmlFor={`${currentIndex + idx}-${option.value}`} className="cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!canProceed || loading}
          className="w-full"
          size="lg"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {currentIndex + 3 >= IPIP_ITEMS.length ? "Complete Questionnaire" : "Next"}
        </Button>
      </div>
    </div>
  );
};

export default Questionnaire;