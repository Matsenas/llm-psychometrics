import { BIG5_QUESTIONS, TRAIT_COLORS } from "@/data/big5Questions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const QuestionsOverview = () => {
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
