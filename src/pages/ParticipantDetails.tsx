import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, RotateCcw, CheckCircle, XCircle, ChevronDown, ChevronUp, Ban, UserCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import universityLogo from "@/assets/university-of-tartu-logo.png";
import { calculateBig5Scores } from "@/lib/calculateBig5";
import ComparisonOverview from "@/components/ComparisonOverview";
import AttachmentQuadrantOverview from "@/components/ecr/AttachmentQuadrantOverview";
import { getAttachmentStyleInfo, classifyAttachment } from "@/lib/attachmentClassification";
import type { AssessmentType } from "@/contexts/ParticipantContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ParticipantInfo {
  id: string;
  respondent_id: string;
  name: string | null;
  created_at: string;
  disabled: boolean;
  assessment_type: AssessmentType;
}

interface AttachmentMethodScore {
  anxiety: number;
  avoidance: number;
}

interface ProgressData {
  consent: boolean;
  started: boolean;
  sessions_complete: number;
  ipip_count: number;
  ecr_count: number;
  accuracy_count: number;
  accuracy_complete: boolean;
  survey_submitted: boolean;
}

interface PersonalityScore {
  score: number;
  confidence: string;
  key_evidence: string[];
  reasoning: string;
}

interface ChatScores {
  openness: PersonalityScore;
  conscientiousness: PersonalityScore;
  extraversion: PersonalityScore;
  agreeableness: PersonalityScore;
  neuroticism: PersonalityScore;
  overall_assessment: string | null;
}

interface IPIPScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface SurveyResults {
  overall_method_preference: number | null;
  feedback: string | null;
  submitted: boolean;
  submitted_at: string | null;
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

interface ChatSession {
  id: string;
  session_number: number;
  big5_aspect: string;
  initial_question: string;
  is_complete: boolean;
  completion_criteria_met: boolean | null;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const ParticipantDetails = () => {
  const { respondentId } = useParams<{ respondentId: string }>();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [chatScores, setChatScores] = useState<ChatScores | null>(null);
  const [ipipScores, setIpipScores] = useState<IPIPScores | null>(null);
  const [surveyResults, setSurveyResults] = useState<SurveyResults | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [attachmentLlm, setAttachmentLlm] = useState<AttachmentMethodScore | null>(null);
  const [attachmentSelf, setAttachmentSelf] = useState<AttachmentMethodScore | null>(null);
  const [expandedTraits, setExpandedTraits] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoad();
  }, [respondentId]);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        navigate("/");
        return;
      }

      await loadParticipantData();
    } catch (error) {
      console.error("Error:", error);
      navigate("/admin");
    }
  };

  const loadParticipantData = async () => {
    if (!respondentId) return;

    try {
      // Load participant info by respondent_id
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("respondent_id", respondentId)
        .maybeSingle();

      if (participantError || !participantData) {
        toast({
          title: "Error",
          description: "Participant not found",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      setParticipant({
        ...participantData,
        disabled: participantData.disabled ?? false,
        assessment_type: (participantData.assessment_type as AssessmentType) ?? "big5",
      });
      const participantId = participantData.id;

      // Load all data in parallel using the participant's internal ID.
      // ECR tables (ecr_responses, attachment_scores) are fetched regardless; they
      // return zero rows for Big Five participants.
      const [
        consent,
        anySessions,
        completedSessions,
        ipipResponses,
        results,
        llmScores,
        ipipStoredScores,
        sessionsData,
        ecrResponses,
        attachmentLlmResult,
        attachmentSelfResult,
      ] = await Promise.all([
        supabase.from("consent_responses").select("id").eq("participant_id", participantId).limit(1),
        supabase.from("chat_sessions").select("id").eq("participant_id", participantId).limit(1),
        supabase.from("chat_sessions").select("id").eq("participant_id", participantId).eq("is_complete", true),
        supabase.from("ipip_responses").select("*").eq("participant_id", participantId).order("item_number"),
        supabase.from("survey_results").select("*").eq("participant_id", participantId).maybeSingle(),
        supabase.from("personality_scores").select("*").eq("participant_id", participantId).eq("method", "llm").maybeSingle(),
        supabase.from("personality_scores").select("*").eq("participant_id", participantId).eq("method", "ipip").maybeSingle(),
        supabase.from("chat_sessions").select("*").eq("participant_id", participantId).order("session_number"),
        supabase.from("ecr_responses").select("id").eq("participant_id", participantId),
        supabase.from("attachment_scores").select("anxiety, avoidance").eq("participant_id", participantId).eq("method", "llm").maybeSingle(),
        supabase.from("attachment_scores").select("anxiety, avoidance").eq("participant_id", participantId).eq("method", "self").maybeSingle(),
      ]);

      const assessmentType = (participantData.assessment_type as AssessmentType) ?? "big5";
      const ecrCount = ecrResponses.data?.length || 0;

      if (attachmentLlmResult.data) {
        setAttachmentLlm({
          anxiety: Number(attachmentLlmResult.data.anxiety),
          avoidance: Number(attachmentLlmResult.data.avoidance),
        });
      }
      if (attachmentSelfResult.data) {
        setAttachmentSelf({
          anxiety: Number(attachmentSelfResult.data.anxiety),
          avoidance: Number(attachmentSelfResult.data.avoidance),
        });
      }

      // Accuracy completeness depends on assessment_type. Big Five: 10 ratings (5x2).
      // ECR: 4 ratings (2x2).
      const big5AccuracyFields = [
        results.data?.openness_chat_accuracy,
        results.data?.openness_ipip_accuracy,
        results.data?.conscientiousness_chat_accuracy,
        results.data?.conscientiousness_ipip_accuracy,
        results.data?.extraversion_chat_accuracy,
        results.data?.extraversion_ipip_accuracy,
        results.data?.agreeableness_chat_accuracy,
        results.data?.agreeableness_ipip_accuracy,
        results.data?.neuroticism_chat_accuracy,
        results.data?.neuroticism_ipip_accuracy,
      ];
      const ecrAccuracyFields = [
        results.data?.anxiety_chat_accuracy,
        results.data?.anxiety_self_accuracy,
        results.data?.avoidance_chat_accuracy,
        results.data?.avoidance_self_accuracy,
      ];
      const accuracyFields = assessmentType === "ecr" ? ecrAccuracyFields : big5AccuracyFields;
      const accuracyCount = accuracyFields.filter((v) => v !== null && v !== undefined).length;
      const accuracyTarget = assessmentType === "ecr" ? 4 : 10;
      const accuracyComplete = accuracyCount === accuracyTarget;

      setProgress({
        consent: (consent.data?.length || 0) > 0,
        started: (anySessions.data?.length || 0) > 0,
        sessions_complete: completedSessions.data?.length || 0,
        ipip_count: ipipResponses.data?.length || 0,
        ecr_count: ecrCount,
        accuracy_count: accuracyCount,
        accuracy_complete: accuracyComplete,
        survey_submitted: results.data?.submitted || false,
      });

      // Load IPIP scores from personality_scores (with fallback to calculation)
      if (ipipStoredScores.data) {
        setIpipScores({
          openness: (ipipStoredScores.data.openness as any).score,
          conscientiousness: (ipipStoredScores.data.conscientiousness as any).score,
          extraversion: (ipipStoredScores.data.extraversion as any).score,
          agreeableness: (ipipStoredScores.data.agreeableness as any).score,
          neuroticism: (ipipStoredScores.data.neuroticism as any).score,
        });
      } else if (ipipResponses.data && ipipResponses.data.length > 0) {
        // Fallback: calculate from responses
        const scores = calculateBig5Scores(ipipResponses.data);
        setIpipScores(scores);
      }

      // Load LLM chat assessment scores
      if (llmScores.data) {
        setChatScores({
          openness: llmScores.data.openness as unknown as PersonalityScore,
          conscientiousness: llmScores.data.conscientiousness as unknown as PersonalityScore,
          extraversion: llmScores.data.extraversion as unknown as PersonalityScore,
          agreeableness: llmScores.data.agreeableness as unknown as PersonalityScore,
          neuroticism: llmScores.data.neuroticism as unknown as PersonalityScore,
          overall_assessment: llmScores.data.overall_assessment,
        });
      }

      // Load survey results
      if (results.data) {
        setSurveyResults({
          overall_method_preference: results.data.overall_method_preference,
          feedback: results.data.feedback,
          submitted: results.data.submitted || false,
          submitted_at: results.data.submitted_at,
          openness_chat_accuracy: results.data.openness_chat_accuracy,
          openness_ipip_accuracy: results.data.openness_ipip_accuracy,
          conscientiousness_chat_accuracy: results.data.conscientiousness_chat_accuracy,
          conscientiousness_ipip_accuracy: results.data.conscientiousness_ipip_accuracy,
          extraversion_chat_accuracy: results.data.extraversion_chat_accuracy,
          extraversion_ipip_accuracy: results.data.extraversion_ipip_accuracy,
          agreeableness_chat_accuracy: results.data.agreeableness_chat_accuracy,
          agreeableness_ipip_accuracy: results.data.agreeableness_ipip_accuracy,
          neuroticism_chat_accuracy: results.data.neuroticism_chat_accuracy,
          neuroticism_ipip_accuracy: results.data.neuroticism_ipip_accuracy,
        });
      }

      // Load chat messages for each session
      if (sessionsData.data && sessionsData.data.length > 0) {
        const sessionsWithMessages = await Promise.all(
          sessionsData.data.map(async (session) => {
            const { data: messages } = await supabase
              .from("chat_messages")
              .select("*")
              .eq("session_id", session.id)
              .order("created_at");
            
            return {
              ...session,
              messages: messages || [],
            } as ChatSession;
          })
        );
        setChatSessions(sessionsWithMessages);
      }
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

  const resetParticipantSession = async () => {
    if (!participant) return;

    try {
      // Get counts before deletion
      const [sessionsCount, ipipCount, consentCount, scoresCount, surveyCount] = await Promise.all([
        supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
        supabase.from("ipip_responses").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
        supabase.from("consent_responses").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
        supabase.from("personality_scores").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
        supabase.from("survey_results").select("id", { count: "exact", head: true }).eq("participant_id", participant.id),
      ]);

      // Get chat sessions for message deletion
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("participant_id", participant.id);

      let messagesDeleted = 0;
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .in("session_id", sessionIds);
        messagesDeleted = count || 0;
        
        await supabase.from("chat_messages").delete().in("session_id", sessionIds);
        await supabase.from("chat_sessions").delete().eq("participant_id", participant.id);
      }

      // Delete remaining data (includes ECR-specific tables; no-op for Big Five participants).
      await Promise.all([
        supabase.from("survey_results").delete().eq("participant_id", participant.id),
        supabase.from("personality_scores").delete().eq("participant_id", participant.id),
        supabase.from("attachment_scores").delete().eq("participant_id", participant.id),
        supabase.from("ipip_responses").delete().eq("participant_id", participant.id),
        supabase.from("ecr_responses").delete().eq("participant_id", participant.id),
        supabase.from("consent_responses").delete().eq("participant_id", participant.id),
      ]);

      // Build deletion summary
      const deletedItems: string[] = [];
      if (sessionsCount.count) deletedItems.push(`${sessionsCount.count} chat sessions`);
      if (messagesDeleted) deletedItems.push(`${messagesDeleted} messages`);
      if (ipipCount.count) deletedItems.push(`${ipipCount.count} IPIP responses`);
      if (scoresCount.count) deletedItems.push(`${scoresCount.count} personality scores`);
      if (consentCount.count) deletedItems.push("consent");
      if (surveyCount.count) deletedItems.push("survey results");

      const summary = deletedItems.length > 0 
        ? `Deleted: ${deletedItems.join(", ")}`
        : "No data to delete";

      toast({
        title: "Session Reset Complete",
        description: summary,
      });

      await loadParticipantData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleParticipantAccess = async () => {
    if (!participant) return;

    const newDisabledState = !participant.disabled;
    
    try {
      const { error } = await supabase
        .from("participants")
        .update({ disabled: newDisabledState })
        .eq("id", participant.id);

      if (error) throw error;

      setParticipant({ ...participant, disabled: newDisabledState });
      
      toast({
        title: newDisabledState ? "Access Disabled" : "Access Enabled",
        description: newDisabledState 
          ? `${participant.name || participant.respondent_id} can no longer access the experiment.`
          : `${participant.name || participant.respondent_id} can now access the experiment.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const StatusIcon = ({ value }: { value: boolean }) => (
    value ? <CheckCircle className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-muted-foreground" />
  );


  const toggleTrait = (trait: string) => {
    setExpandedTraits(prev => ({ ...prev, [trait]: !prev[trait] }));
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant || !progress) {
    return null;
  }

  const isEcr = participant.assessment_type === "ecr";
  const chatTarget = isEcr ? 1 : 20;
  const questionnaireTarget = isEcr ? 36 : 50;
  const questionnaireCount = isEcr ? progress.ecr_count : progress.ipip_count;
  const accuracyTarget = isEcr ? 4 : 10;
  const steps = [
    { label: "Consent", complete: progress.consent },
    { label: "Started", complete: progress.started },
    {
      label: isEcr ? "Chat" : "Chats",
      complete: progress.sessions_complete === chatTarget,
      detail: `${progress.sessions_complete}/${chatTarget}`,
    },
    {
      label: isEcr ? "ECR-R" : "IPIP",
      complete: questionnaireCount === questionnaireTarget,
      detail: `${questionnaireCount}/${questionnaireTarget}`,
    },
    {
      label: "Accuracy",
      complete: progress.accuracy_complete,
      detail: `${progress.accuracy_count}/${accuracyTarget}`,
    },
    { label: "Submitted", complete: progress.survey_submitted },
  ];

  const completedSteps = steps.filter(s => s.complete).length;

  const traitData = [
    { key: "openness", label: "Openness" },
    { key: "conscientiousness", label: "Conscientiousness" },
    { key: "extraversion", label: "Extraversion" },
    { key: "agreeableness", label: "Agreeableness" },
    { key: "neuroticism", label: "Neuroticism" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-primary text-primary-foreground rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/admin")}
              className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
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
          <div className="flex items-center gap-2">
            {/* Access Toggle Button */}
            {participant.disabled ? (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={toggleParticipantAccess}
                className="bg-green-600/80 hover:bg-green-600 text-white border-0"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Enable Access
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={toggleParticipantAccess}
                className="bg-destructive/80 hover:bg-destructive text-white border-0"
              >
                <Ban className="h-4 w-4 mr-2" />
                Disable Access
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Participant Session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all data for participant "{participant.respondent_id}" including consent, chat sessions, questionnaire responses, and results.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={resetParticipantSession}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
            <CardDescription>
              {completedSteps} of {steps.length} steps completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Circles and connecting lines */}
            <div className="flex items-center">
              {steps.map((step, index) => (
                <div key={step.label} className="flex items-center" style={{ flex: index === steps.length - 1 ? 'none' : 1 }}>
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0
                    ${step.complete 
                      ? "bg-success text-success-foreground" 
                      : "bg-muted text-muted-foreground"
                    }
                  `}>
                    {step.complete ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 ${step.complete ? "bg-success" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
            {/* Labels */}
            <div className="flex mt-2">
              {steps.map((step, index) => (
                <div key={step.label} style={{ flex: index === steps.length - 1 ? 'none' : 1, width: index === steps.length - 1 ? '32px' : undefined }}>
                  <div className="w-8">
                    <span className={`text-xs block text-center ${step.complete ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="text-xs block text-center text-muted-foreground">
                        {step.detail}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assessment-type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Assessment:</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isEcr ? "bg-amber-100 text-amber-900" : "bg-primary/10 text-primary"
          }`}>
            {isEcr ? "ECR-R (Attachment)" : "Big Five (IPIP)"}
          </span>
        </div>

        {/* Assessment-specific overview */}
        {isEcr ? (
          <AttachmentQuadrantOverview chatScores={attachmentLlm} selfScores={attachmentSelf} />
        ) : (
          <ComparisonOverview
            chatScores={chatScores ? {
              openness: (chatScores.openness.score / 120) * 100,
              conscientiousness: (chatScores.conscientiousness.score / 120) * 100,
              extraversion: (chatScores.extraversion.score / 120) * 100,
              agreeableness: (chatScores.agreeableness.score / 120) * 100,
              neuroticism: (chatScores.neuroticism.score / 120) * 100,
            } : null}
            ipipScores={ipipScores}
          />
        )}

        {/* ECR-only: attachment scores detail card */}
        {isEcr && (attachmentLlm || attachmentSelf) && (
          <Card>
            <CardHeader>
              <CardTitle>Attachment Assessment Results</CardTitle>
              <CardDescription>
                Anxiety and avoidance scores on the native ECR-R 1–7 scale. Quadrant classification uses the scale midpoint cutoff of 4.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attachmentLlm && (
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Chat (LLM)</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {getAttachmentStyleInfo(classifyAttachment(attachmentLlm)).label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Anxiety <strong className="text-foreground">{attachmentLlm.anxiety.toFixed(2)}</strong> · Avoidance <strong className="text-foreground">{attachmentLlm.avoidance.toFixed(2)}</strong>
                  </div>
                </div>
              )}
              {attachmentSelf && (
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">ECR-R Self-Report</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {getAttachmentStyleInfo(classifyAttachment(attachmentSelf)).label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Anxiety <strong className="text-foreground">{attachmentSelf.anxiety.toFixed(2)}</strong> · Avoidance <strong className="text-foreground">{attachmentSelf.avoidance.toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat Assessment Results */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Assessment Results</CardTitle>
            <CardDescription>
              Big Five scores from AI analysis of chat conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chatScores ? (
              <div className="space-y-3">
                {traitData.map(({ key, label }) => {
                  const data = chatScores[key as keyof Omit<ChatScores, "overall_assessment">];
                  const normalizedScore = (data.score / 120) * 100;
                  const isExpanded = expandedTraits[`chat-${key}`];
                  
                  return (
                    <Collapsible
                      key={key}
                      open={isExpanded}
                      onOpenChange={() => toggleTrait(`chat-${key}`)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <div className="p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{label}</span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="text-2xl font-medium text-primary">
                                  {Math.round(normalizedScore)}
                                </span>
                            </div>
                            <Progress value={normalizedScore} className="h-2 bg-muted [&>div]:bg-primary" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0 space-y-3 border-t bg-muted/20">
                            <div className="flex items-center gap-2 pt-3">
                              <span className="text-sm font-medium">Confidence:</span>
                              <span className="text-sm text-muted-foreground">{data.confidence}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{data.reasoning}</p>
                            {data.key_evidence && data.key_evidence.length > 0 && (
                              <div className="text-xs">
                                <span className="font-medium">Evidence:</span>
                                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                  {data.key_evidence.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
                {chatScores.overall_assessment && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-2">Overall Assessment</h4>
                    <p className="text-sm text-muted-foreground">{chatScores.overall_assessment}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No chat assessment data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* IPIP-50 Results */}
        <Card>
          <CardHeader>
            <CardTitle>IPIP-50 Assessment Results</CardTitle>
            <CardDescription>
              Big Five scores from standardized questionnaire responses ({progress.ipip_count}/50 items completed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ipipScores ? (
              <div className="space-y-3">
                {traitData.map(({ key, label }) => {
                  const score = ipipScores[key as keyof IPIPScores];
                  
                  return (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{label}</span>
                        <span className="text-2xl font-medium text-[hsl(45,93%,47%)]">
                          {Math.round(score)}
                        </span>
                      </div>
                      <Progress value={score} className="h-2 bg-muted [&>div]:bg-[hsl(45,93%,47%)]" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No IPIP assessment data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Survey Results & Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Survey Results & Feedback</CardTitle>
            <CardDescription>
              Participant ratings and final feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            {surveyResults ? (
              <div className="space-y-4">
                {/* Overall Method Preference */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Overall Method Preference</p>
                  <p className="text-lg font-medium">
                    {surveyResults.overall_method_preference !== null ? (
                      {
                        1: "Chat was much more accurate",
                        2: "Chat was slightly more accurate",
                        3: "Both were equally accurate",
                        4: "IPIP was slightly more accurate",
                        5: "IPIP was much more accurate",
                      }[surveyResults.overall_method_preference] || `${surveyResults.overall_method_preference}/5`
                    ) : "N/A"}
                  </p>
                </div>

                {/* Trait-by-Trait Accuracy Ratings */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">Trait Accuracy Ratings (1-5)</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {[
                      { label: "Openness", chat: surveyResults.openness_chat_accuracy, ipip: surveyResults.openness_ipip_accuracy },
                      { label: "Conscientiousness", chat: surveyResults.conscientiousness_chat_accuracy, ipip: surveyResults.conscientiousness_ipip_accuracy },
                      { label: "Extraversion", chat: surveyResults.extraversion_chat_accuracy, ipip: surveyResults.extraversion_ipip_accuracy },
                      { label: "Agreeableness", chat: surveyResults.agreeableness_chat_accuracy, ipip: surveyResults.agreeableness_ipip_accuracy },
                      { label: "Neuroticism", chat: surveyResults.neuroticism_chat_accuracy, ipip: surveyResults.neuroticism_ipip_accuracy },
                    ].map(({ label, chat, ipip }) => (
                      <div key={label} className="flex items-center justify-between py-1 border-b last:border-0">
                        <span className="font-medium">{label}</span>
                        <div className="flex gap-4">
                          <span className="text-primary">Chat: {chat ?? "—"}</span>
                          <span className="text-[hsl(45,93%,47%)]">IPIP: {ipip ?? "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback */}
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Feedback</p>
                  <p className="text-sm">
                    {surveyResults.feedback || "No feedback provided"}
                  </p>
                </div>

                {/* Submission Status */}
                <div className="text-xs text-muted-foreground">
                  {surveyResults.submitted ? (
                    <span>Submitted: {surveyResults.submitted_at ? new Date(surveyResults.submitted_at).toLocaleString() : "Yes"}</span>
                  ) : (
                    <span>Not yet submitted</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No survey results available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Chat Transcripts - at the bottom */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Transcripts</CardTitle>
            <CardDescription>
              {chatSessions.length} of 20 conversations completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {chatSessions.length > 0 ? (
              chatSessions.map((session) => (
                <Collapsible
                  key={session.id}
                  open={expandedSessions[session.id]}
                  onOpenChange={() => toggleSession(session.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-sm font-medium w-8">#{session.session_number}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">{session.big5_aspect}</span>
                        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {session.initial_question}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.is_complete ? (
                          <span className="text-xs text-success">Complete</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">In progress</span>
                        )}
                        {session.completion_criteria_met === false && (
                          <span className="text-xs text-yellow-600">(Skipped)</span>
                        )}
                        {expandedSessions[session.id] ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 rounded-lg border bg-background space-y-3">
                      {session.messages.length > 0 ? (
                        session.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg text-sm ${
                              msg.role === "assistant"
                                ? "bg-muted/50 border-l-2 border-primary"
                                : "bg-primary/5 border-l-2 border-muted-foreground"
                            }`}
                          >
                            <div className="text-xs text-muted-foreground mb-1 font-medium">
                              {msg.role === "assistant" ? "AI" : "User"}
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No chat sessions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantDetails;
