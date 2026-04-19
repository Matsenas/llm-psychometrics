import { BIG5_QUESTIONS, TRAIT_COLORS } from "@/data/big5Questions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ECR_ITEMS } from "@/lib/ecrItems";

interface Props {
  assessmentId?: "big5" | "ecr";
}

const EcrQuestionsOverview = () => {
  const anxietyItems = ECR_ITEMS.filter((i) => i.subscale === "anxiety");
  const avoidanceItems = ECR_ITEMS.filter((i) => i.subscale === "avoidance");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Relationship Conversation Opener</h3>
        <p className="text-sm text-muted-foreground mb-3">
          A single open-ended AI conversation. The full opening text lives in the
          relationship-chat edge function.
        </p>
        <div className="bg-muted/50 p-3 rounded-md text-sm leading-relaxed">
          Think of a recent moment in a close relationship — romantic, friendship, or
          family — where you felt a real difficulty. Could be a disagreement, a moment of
          distance, feeling unseen, or anything else that comes to mind. Share it at
          whatever depth feels right.
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">ECR-R Items (36 Questions)</h3>
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="anxiety" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <Badge variant="secondary">Anxiety</Badge>
                <span className="font-medium">Items 1–18 ({anxietyItems.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-1 text-sm">
                {anxietyItems.map((i) => (
                  <li key={i.itemNumber} className="flex gap-3 py-1">
                    <span className="font-mono text-muted-foreground w-8">{i.itemNumber}.</span>
                    <span>
                      {i.text}
                      {i.reverseKeyed && (
                        <span className="ml-2 text-xs text-muted-foreground">(reverse-keyed)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="avoidance" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <Badge variant="secondary">Avoidance</Badge>
                <span className="font-medium">Items 19–36 ({avoidanceItems.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-1 text-sm">
                {avoidanceItems.map((i) => (
                  <li key={i.itemNumber} className="flex gap-3 py-1">
                    <span className="font-mono text-muted-foreground w-8">{i.itemNumber}.</span>
                    <span>
                      {i.text}
                      {i.reverseKeyed && (
                        <span className="ml-2 text-xs text-muted-foreground">(reverse-keyed)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <p className="text-xs text-muted-foreground">
        ECR-R: Fraley, Waller, &amp; Brennan (2000). Items presented to participants in a
        randomized order (seeded per participant in localStorage).
      </p>
    </div>
  );
};

const QuestionsOverview = ({ assessmentId = "big5" }: Props) => {
  if (assessmentId === "ecr") return <EcrQuestionsOverview />;

  return (
    <div>
      <h3 className="font-semibold mb-3">Chat Questions (20 Questions)</h3>
      <Accordion type="multiple" className="space-y-2">
        {BIG5_QUESTIONS.map((q) => (
          <AccordionItem
            key={q.sessionNumber}
            value={`q-${q.sessionNumber}`}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <span className="font-mono text-sm text-muted-foreground w-6">
                  {q.sessionNumber}.
                </span>
                <Badge className={TRAIT_COLORS[q.trait]} variant="secondary">
                  {q.trait}
                </Badge>
                <span className="font-medium">{q.question}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-2">
              <div className="space-y-4 ml-9">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                    Guidance
                  </h4>
                  <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-line">
                    {q.guidance}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                    Completion Criteria
                  </h4>
                  <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-line">
                    {q.criteria}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default QuestionsOverview;
