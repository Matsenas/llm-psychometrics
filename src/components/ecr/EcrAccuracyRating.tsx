import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft } from "lucide-react";

const DIMENSIONS = [
  {
    key: "anxiety",
    label: "Anxiety (attachment-related)",
    description:
      "Higher scores reflect worry about rejection or abandonment, hypervigilance to a partner's feelings, and a strong need for reassurance. Lower scores reflect relational security and stable self-worth in close relationships.",
  },
  {
    key: "avoidance",
    label: "Avoidance (attachment-related)",
    description:
      "Higher scores reflect discomfort with closeness or emotional dependence, a preference for self-reliance, and distancing under stress. Lower scores reflect ease with intimacy and interdependence.",
  },
] as const;

const RATING_LABELS: Record<number, string> = {
  1: "Not accurate at all",
  2: "Slightly accurate",
  3: "Moderately accurate",
  4: "Quite accurate",
  5: "Very accurate",
};

export interface EcrAccuracyRatings {
  anxiety_chat_accuracy: number | null;
  anxiety_self_accuracy: number | null;
  avoidance_chat_accuracy: number | null;
  avoidance_self_accuracy: number | null;
}

interface Scores {
  anxiety: number;
  avoidance: number;
}

interface Props {
  chatScores: Scores;
  selfScores: Scores;
  ratings: EcrAccuracyRatings;
  onRatingsChange: (next: EcrAccuracyRatings) => void;
  onSave: () => Promise<boolean>;
  onComplete: () => void;
  isSaving?: boolean;
}

const EcrAccuracyRating = ({
  chatScores,
  selfScores,
  ratings,
  onRatingsChange,
  onSave,
  onComplete,
  isSaving = false,
}: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methodOrder = useMemo<Array<"chat" | "self">>(() => {
    return Math.random() > 0.5 ? ["chat", "self"] : ["self", "chat"];
  }, []);

  const current = DIMENSIONS[currentIndex];
  const progress = ((currentIndex + 1) / DIMENSIONS.length) * 100;

  const chatKey = `${current.key}_chat_accuracy` as keyof EcrAccuracyRatings;
  const selfKey = `${current.key}_self_accuracy` as keyof EcrAccuracyRatings;

  const setChatRating = (value: number) => {
    onRatingsChange({ ...ratings, [chatKey]: value });
  };
  const setSelfRating = (value: number) => {
    onRatingsChange({ ...ratings, [selfKey]: value });
  };

  const canProceed = () => ratings[chatKey] !== null && ratings[selfKey] !== null;

  const handleNext = async () => {
    setIsSubmitting(true);
    const saved = await onSave();
    if (!saved) {
      setIsSubmitting(false);
      return;
    }
    if (currentIndex < DIMENSIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsSubmitting(false);
    } else {
      await onComplete();
      setIsSubmitting(false);
    }
  };

  const renderMethod = (method: "chat" | "self") => {
    const label = method === "chat" ? "Chat Assessment" : "ECR-R Self-Report";
    const color = method === "chat" ? "hsl(var(--primary))" : "hsl(45 93% 47%)";
    const score = method === "chat" ? chatScores[current.key] : selfScores[current.key];
    const ratingKey = method === "chat" ? chatKey : selfKey;
    const rating = ratings[ratingKey];
    // Score is 1..7; render as 0..100% of the scale for the progress bar.
    const percent = ((score - 1) / 6) * 100;

    return (
      <div className="space-y-4 p-4 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-medium">{label}</span>
          </div>
          <span className="text-lg font-semibold">{score.toFixed(2)}</span>
        </div>
        <Progress
          value={percent}
          className="h-2 bg-progress-track"
          style={{
            // @ts-expect-error — match TraitAccuracyRating's pattern for custom colour
            "--progress-background": color,
          }}
        />
        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            How accurately does this score reflect your {current.key}?
          </p>
          <RadioGroup
            value={rating?.toString() ?? ""}
            onValueChange={(v) => {
              const parsed = parseInt(v, 10);
              if (method === "chat") setChatRating(parsed);
              else setSelfRating(parsed);
            }}
            className="space-y-2"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={value.toString()}
                  id={`${method}-${current.key}-${value}`}
                />
                <Label
                  htmlFor={`${method}-${current.key}-${value}`}
                  className="cursor-pointer text-sm"
                >
                  {RATING_LABELS[value]}
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
        {currentIndex > 0 && (
          <Button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
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
          {currentIndex + 1} of {DIMENSIONS.length}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{current.label}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm">
            Below are your scores for <strong>{current.label}</strong> from two different methods.
            Scores are on the native ECR-R 1–7 scale. Please rate how accurately each reflects you.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {methodOrder.map((method) => (
              <div key={method}>{renderMethod(method)}</div>
            ))}
          </div>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentIndex < DIMENSIONS.length - 1 ? "Next" : "View Full Results"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

export default EcrAccuracyRating;
