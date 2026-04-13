import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft } from "lucide-react";

const TRAITS = [
  { key: "openness", label: "Openness", description: "Reflects imagination, creativity, and intellectual curiosity. High scorers are open to new experiences, ideas, and unconventional values. Low scorers prefer routine and familiar approaches." },
  { key: "conscientiousness", label: "Conscientiousness", description: "Measures organization, responsibility, and self-discipline. High scorers are reliable, planned, and achievement-oriented. Low scorers tend to be spontaneous and flexible." },
  { key: "extraversion", label: "Extraversion", description: "Indicates sociability, assertiveness, and energy level. High scorers are outgoing, talkative, and energized by social interaction. Low scorers (introverts) prefer solitude and quiet environments." },
  { key: "agreeableness", label: "Agreeableness", description: "Reflects compassion, cooperation, and trust in others. High scorers are empathetic, helpful, and value harmony. Low scorers are more skeptical and competitive." },
  { key: "neuroticism", label: "Neuroticism", description: "Measures emotional stability and stress reactivity. High scorers experience more anxiety, mood swings, and emotional distress. Low scorers are calm, resilient, and emotionally stable." },
] as const;

const RATING_LABELS = {
  1: "Not accurate at all",
  2: "Slightly accurate",
  3: "Moderately accurate",
  4: "Quite accurate",
  5: "Very accurate",
};

export interface TraitRatings {
  openness_chat_accuracy: number | null;
  openness_ipip_accuracy: number | null;
  conscientiousness_chat_accuracy: number | null;
  conscientiousness_ipip_accuracy: number | null;
  extraversion_chat_accuracy: number | null;
  extraversion_ipip_accuracy: number | null;
  agreeableness_chat_accuracy: number | null;
  agreeableness_ipip_accuracy: number | null;
  neuroticism_chat_accuracy: number | null;
  neuroticism_ipip_accuracy: number | null;
}

interface ChatScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface IPIPScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface TraitAccuracyRatingProps {
  chatScores: ChatScores;
  ipipScores: IPIPScores;
  ratings: TraitRatings;
  onRatingsChange: (ratings: TraitRatings) => void;
  onSave: () => Promise<boolean>;
  onComplete: () => void;
  isSaving?: boolean;
}

const TraitAccuracyRating = ({
  chatScores,
  ipipScores,
  ratings,
  onRatingsChange,
  onSave,
  onComplete,
  isSaving = false,
}: TraitAccuracyRatingProps) => {
  const [currentTraitIndex, setCurrentTraitIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Randomize order of methods per participant (consistent during session)
  const methodOrder = useMemo(() => {
    return Math.random() > 0.5 ? ["chat", "ipip"] : ["ipip", "chat"];
  }, []);

  const currentTrait = TRAITS[currentTraitIndex];
  const progress = ((currentTraitIndex + 1) / TRAITS.length) * 100;

  const getChatRating = (traitKey: string) => {
    return ratings[`${traitKey}_chat_accuracy` as keyof TraitRatings];
  };

  const getIpipRating = (traitKey: string) => {
    return ratings[`${traitKey}_ipip_accuracy` as keyof TraitRatings];
  };

  const setChatRating = (traitKey: string, value: number) => {
    onRatingsChange({
      ...ratings,
      [`${traitKey}_chat_accuracy`]: value,
    });
  };

  const setIpipRating = (traitKey: string, value: number) => {
    onRatingsChange({
      ...ratings,
      [`${traitKey}_ipip_accuracy`]: value,
    });
  };

  const getScore = (method: string, traitKey: string) => {
    if (method === "chat") {
      return chatScores[traitKey as keyof ChatScores];
    }
    return ipipScores[traitKey as keyof IPIPScores];
  };

  const canProceed = () => {
    const chatRating = getChatRating(currentTrait.key);
    const ipipRating = getIpipRating(currentTrait.key);
    return chatRating !== null && ipipRating !== null;
  };

  const handleNext = async () => {
    setIsSubmitting(true);
    const saved = await onSave();
    if (!saved) {
      setIsSubmitting(false);
      return;
    }
    
    if (currentTraitIndex < TRAITS.length - 1) {
      setCurrentTraitIndex(currentTraitIndex + 1);
      setIsSubmitting(false);
    } else {
      await onComplete();
      setIsSubmitting(false);
    }
  };

  const renderMethodRating = (method: "chat" | "ipip") => {
    const methodLabel = method === "chat" ? "Chat Assessment" : "IPIP Questionnaire";
    const methodColor = method === "chat" ? "hsl(var(--primary))" : "hsl(45 93% 47%)";
    const score = getScore(method, currentTrait.key);
    const rating = method === "chat" 
      ? getChatRating(currentTrait.key) 
      : getIpipRating(currentTrait.key);
    const setRating = method === "chat" ? setChatRating : setIpipRating;

    return (
      <div className="space-y-4 p-4 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: methodColor }}
            />
            <span className="font-medium">{methodLabel}</span>
          </div>
          <span className="text-lg font-semibold">{Math.round(score)}</span>
        </div>
        
        <Progress 
          value={score} 
          className="h-2 bg-progress-track"
          style={{ 
            // @ts-ignore
            '--progress-background': methodColor 
          }}
        />

        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            How accurately does this score reflect your {currentTrait.label.toLowerCase()}?
          </p>
          <RadioGroup 
            value={rating?.toString() ?? ""} 
            onValueChange={(v) => setRating(currentTrait.key, parseInt(v))}
            className="space-y-2"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value.toString()} id={`${method}-${currentTrait.key}-${value}`} />
                <Label 
                  htmlFor={`${method}-${currentTrait.key}-${value}`} 
                  className="cursor-pointer text-sm"
                >
                  {RATING_LABELS[value as keyof typeof RATING_LABELS]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {currentTraitIndex > 0 && (
          <Button
            onClick={() => setCurrentTraitIndex(prev => Math.max(0, prev - 1))}
            disabled={isSubmitting}
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <Progress value={progress} className="h-2 flex-1 bg-progress-track" />
        <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-2">
          {currentTraitIndex + 1} of {TRAITS.length}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentTrait.label}</CardTitle>
          <CardDescription>{currentTrait.description}</CardDescription>
        </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm">
          Below are your scores for <strong>{currentTrait.label}</strong> from two different assessment methods. 
          Please rate how accurately each score reflects your actual personality.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {methodOrder.map((method) => (
            <div key={method}>
              {renderMethodRating(method as "chat" | "ipip")}
            </div>
          ))}
        </div>

        <Button 
          onClick={handleNext} 
          disabled={!canProceed() || isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {currentTraitIndex < TRAITS.length - 1 ? "Next" : "View Full Results"}
        </Button>
      </CardContent>
      </Card>
    </>
  );
};

export default TraitAccuracyRating;
