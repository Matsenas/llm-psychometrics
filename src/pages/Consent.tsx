import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const CONSENT_TEXT = `Informed consent for participation in research study on AI-based personality assessment.`;

const Consent = () => {
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedRead, setAgreedRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingConsent, setCheckingConsent] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading } = useParticipant();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
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

  // Check if consent already exists and redirect if so
  useEffect(() => {
    const checkExistingConsent = async () => {
      // For admin preview without participant, skip consent check
      if (!participant) {
        if (!isLoading) {
          setCheckingConsent(false);
        }
        return;
      }

      try {
        // Use limit(1) instead of maybeSingle to handle multiple records
        const { data: consentData } = await supabase
          .from("consent_responses")
          .select("id")
          .eq("participant_id", participant.id)
          .limit(1);

        if (consentData && consentData.length > 0) {
          // Consent already given, redirect to start
          navigate("/start");
          return;
        }
      } catch (error) {
        console.error("Error checking consent:", error);
      } finally {
        setCheckingConsent(false);
      }
    };

    checkExistingConsent();
  }, [participant, isLoading, navigate]);

  const canProceed = agreedAge && agreedRead;

  const handleConsent = async () => {
    if (!canProceed) {
      toast({
        title: "Consent Required",
        description: "Please confirm both checkboxes to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!participant) {
      toast({
        title: "Session Error",
        description: "No valid session found. Please use your unique link.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if consent already exists (prevent duplicates)
      const { data: existingConsent } = await supabase
        .from("consent_responses")
        .select("id")
        .eq("participant_id", participant.id)
        .limit(1);

      if (existingConsent && existingConsent.length > 0) {
        // Consent already exists, just navigate
        navigate("/start");
        return;
      }

      const { error } = await supabase.from("consent_responses").insert({
        participant_id: participant.id,
        consented: true,
        consent_text: CONSENT_TEXT,
      });

      if (error) throw error;

      toast({
        title: "Thank you!",
        description: "You can now begin the survey.",
      });

      navigate("/start");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || checkingConsent || checkingAdmin) {
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
            <p className="text-muted-foreground">Please use your unique session link to access the survey.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Informed Consent</CardTitle>
          <CardDescription>
            {participant.name ? `Welcome, ${participant.name}!` : "Welcome!"} Please review and agree to the following
            consent form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Accordion type="multiple" className="w-full" defaultValue={["study-purpose"]}>
            <AccordionItem value="study-purpose">
              <AccordionTrigger className="text-base font-medium">Study Purpose</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                We're researching whether AI chatbots can accurately estimate personality traits through conversation.
                You'll chat with an AI, complete a personality questionnaire, and rate the AI's accuracy. This helps us
                understand if conversational AI can estimate Big Five personality traits.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="what-youll-do">
              <AccordionTrigger className="text-base font-medium">What You'll Do</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Complete 20 brief conversations with an AI chatbot on different topics</li>
                  <li>Take the standardized IPIP-50 personality questionnaire</li>
                  <li>Rate how accurate you think the AI's assessment was</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-collected">
              <AccordionTrigger className="text-base font-medium">Data We Collect</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Conversation transcripts with the AI</li>
                  <li>Your IPIP-50 questionnaire responses</li>
                  <li>Your ratings on the results</li>
                  <li>Basic demographics and email from your registration form</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-usage">
              <AccordionTrigger className="text-base font-medium">How We Use Your Data</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Research analysis for this study</li>
                  <li>
                    Possible publication of anonymized, aggregate results in our report: "Human-AI Collaboration in
                    Self-Understanding: Validating LLM-Based Personality Profiling"
                  </li>
                  <li>Disguised conversation excerpts may be quoted in publications</li>
                  <li>Conversations will be processed automatically but may be partially human-reviewed</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="privacy">
              <AccordionTrigger className="text-base font-medium">Privacy & Data Protection</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Data is accessible only to our research team and university supervisor</li>
                  <li>All identifying information will be removed from transcripts</li>
                  <li>All personal identifiers will be deleted by 31.01.2026</li>
                  <li>Fully anonymized data may be retained for further research purposes</li>
                  <li>Data handling is aligned with GDPR and University of Tartu ethical guidelines</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="your-rights">
              <AccordionTrigger className="text-base font-medium">Your Rights</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Participation is completely voluntary</li>
                  <li>You can withdraw anytime without penalty</li>
                  <li>
                    To withdraw or request removal of your personal identifiers from the dataset, please contact{" "}
                    <a href="mailto:andrius.matsenas@ut.ee" className="text-primary underline">
                      andrius.matsenas@ut.ee
                    </a>
                  </li>
                  <li>You can request a copy of your data or ask questions anytime</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="bg-muted p-4 rounded-lg space-y-4">
            <p className="text-sm font-medium">Your Consent</p>
            <p className="text-sm text-muted-foreground">By checking these boxes, I confirm that:</p>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consent-age"
                  checked={agreedAge}
                  onCheckedChange={(checked) => setAgreedAge(checked as boolean)}
                />
                <label
                  htmlFor="consent-age"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I am at least 18 years old
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consent-read"
                  checked={agreedRead}
                  onCheckedChange={(checked) => setAgreedRead(checked as boolean)}
                />
                <label
                  htmlFor="consent-read"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have read and understood this form
                </label>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConsent}
            disabled={!canProceed || loading || (!participant && isAdmin)}
            className="w-full"
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Survey
          </Button>

          {isAdmin && !participant && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Admin preview mode - no participant session active
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Consent;
