import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Plus, RotateCw, Eye, Copy, Check, Filter, ChevronDown, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUQ_ITEMS,
  PLAUSIBILITY_ITEM,
  RELATIONSHIP_USABILITY_REQUIRED_ITEMS,
  SUS_ITEMS,
  countRelationshipUsabilityRequiredResponses,
} from "@/lib/usabilityInstruments";
import { scoreCuq, scoreSus } from "@/lib/usabilityScoring";
import { appUrl } from "@/lib/appUrl";
import { AdminRoleManager } from "@/components/admin/AdminRoleManager";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ParticipantData {
  id: string;
  respondent_id: string;
  name: string | null;
  email: string | null;
  user_id: string | null;
  active_assignment_id: string | null;
  active_study_slug: string | null;
  active_study_name: string | null;
  active_study_version_id: string | null;
  assignment_status: string | null;
  consent: boolean;
  started: boolean;
  sessions_complete: number;
  ipip_count: number;
  usability_count: number;
  survey_submitted: boolean;
}

interface StudyOption {
  study_id: string;
  study_version_id: string;
  slug: string;
  name: string;
  version_number: number;
}

interface StudyJoin {
  slug?: string | null;
  name?: string | null;
}

interface StudyVersionOptionRow {
  id: string;
  version_number: number;
  study_id: string;
  studies: StudyJoin | StudyJoin[] | null;
}

interface AssignmentStudyVersionRow {
  version_number?: number | null;
  studies?: StudyJoin | StudyJoin[] | null;
}

interface ActiveAssignmentRow {
  id: string;
  status: string | null;
  study_version_id: string | null;
  study_versions: AssignmentStudyVersionRow | AssignmentStudyVersionRow[] | null;
}

interface CreatedAccountCredentials {
  email: string;
  name: string;
  temporaryPassword: string;
  respondentId?: string;
}

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function nestedScore(value: unknown): number | null {
  if (!value || typeof value !== "object" || !("score" in value)) return null;
  const score = (value as { score?: unknown }).score;
  return typeof score === "number" ? score : null;
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function functionErrorMessage(data: unknown, error: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }
  return errorMessage(error);
}

export function ParticipantsUserManagement({ currentUserId }: { currentUserId: string }) {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const [newRespondentId, setNewRespondentId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStudyVersionId, setNewStudyVersionId] = useState<string>("");
  const [createdParticipantAccount, setCreatedParticipantAccount] = useState<CreatedAccountCredentials | null>(null);
  const [studyOptions, setStudyOptions] = useState<StudyOption[]>([]);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<"all" | "not-submitted" | "in-progress" | "submitted">("all");
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const copySessionLink = (respondentId: string) => {
    const link = appUrl(`/participant/${respondentId}`);
    navigator.clipboard.writeText(link);
    setCopiedLink(`legacy-${respondentId}`);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({
      title: "Copied!",
      description: "Session link copied to clipboard",
    });
  };

  const copyEmailSignInLink = (participant: ParticipantData) => {
    navigator.clipboard.writeText(appUrl("/"));
    setCopiedLink(`email-${participant.id}`);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({
      title: "Copied!",
      description: `Sign-in URL copied for ${participant.email}`,
    });
  };

  const copyCreatedCredentials = () => {
    if (!createdParticipantAccount) return;
    navigator.clipboard.writeText(
      [
        `Sign in: ${appUrl("/")}`,
        `Email: ${createdParticipantAccount.email}`,
        `Temporary password: ${createdParticipantAccount.temporaryPassword}`,
      ].join("\n"),
    );
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2000);
    toast({
      title: "Copied!",
      description: "Participant sign-in details copied to clipboard",
    });
  };

  useEffect(() => {
    loadParticipants();
    loadStudyOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudyOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("study_versions")
        .select("id, version_number, study_id, studies(id, slug, name)")
        .eq("is_published", true)
        .order("version_number", { ascending: false });

      if (error) throw error;

      const options = ((data ?? []) as StudyVersionOptionRow[]).map((row) => {
        const study = firstJoin(row.studies);
        return {
          study_id: row.study_id,
          study_version_id: row.id,
          slug: study?.slug ?? "unknown",
          name: study?.name ?? study?.slug ?? "Unknown study",
          version_number: row.version_number,
        };
      });
      setStudyOptions(options);
      if (!newStudyVersionId && options.length > 0) {
        const relationship = options.find((option) => option.slug === "relationship_patterns_cuq_sus_plausibility");
        setNewStudyVersionId((relationship ?? options[0]).study_version_id);
      }
    } catch (error) {
      console.error("Error loading study options:", error);
    }
  };

  const loadParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from("participants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!participantsData) {
        setParticipants([]);
        return;
      }

      const enrichedData: ParticipantData[] = await Promise.all(
        participantsData.map(async (p) => {
          const [consent, anySessions, completedSessions, ipip, usability, results, assignment] = await Promise.all([
            supabase.from("consent_responses").select("id").eq("participant_id", p.id).limit(1),
            supabase.from("chat_sessions").select("id").eq("participant_id", p.id).limit(1),
            supabase.from("chat_sessions").select("id").eq("participant_id", p.id).eq("is_complete", true),
            supabase.from("ipip_responses").select("id").eq("participant_id", p.id),
            supabase.from("usability_responses").select("item_key, response_value").eq("participant_id", p.id),
            supabase.from("survey_results").select("submitted").eq("participant_id", p.id).limit(1),
            supabase
              .from("participant_study_assignments")
              .select("id, status, study_version_id, study_versions(version_number, studies(slug, name))")
              .eq("participant_id", p.id)
              .in("status", ["active", "completed"])
              .order("assigned_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
          const activeAssignment = assignment.data as ActiveAssignmentRow | null;
          const activeVersion = firstJoin(activeAssignment?.study_versions);
          const activeStudy = firstJoin(activeVersion?.studies);
          const usabilityCount = countRelationshipUsabilityRequiredResponses(usability.data ?? []);
          const isRelationshipStudy = activeStudy?.slug === "relationship_patterns_cuq_sus_plausibility";

          return {
            id: p.id,
            respondent_id: p.respondent_id,
            name: p.name,
            email: p.email ?? null,
            user_id: p.user_id ?? null,
            active_assignment_id: activeAssignment?.id ?? null,
            active_study_slug: activeStudy?.slug ?? null,
            active_study_name: activeStudy?.name ?? null,
            active_study_version_id: activeAssignment?.study_version_id ?? null,
            assignment_status: activeAssignment?.status ?? null,
            consent: (consent.data?.length || 0) > 0,
            started: (anySessions.data?.length || 0) > 0,
            sessions_complete: completedSessions.data?.length || 0,
            ipip_count: ipip.data?.length || 0,
            usability_count: usabilityCount,
            survey_submitted: isRelationshipStudy
              ? usabilityCount >= RELATIONSHIP_USABILITY_REQUIRED_ITEMS
              : results.data?.[0]?.submitted || activeAssignment?.status === "completed" || false,
          };
        })
      );

      setParticipants(enrichedData);
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createParticipantAccount = async () => {
    const normalizedEmail = newEmail.trim().toLowerCase();
    const name = newName.trim();
    const respondentId = newRespondentId.trim();

    if (!name) {
      toast({
        title: "Name required",
        description: "Enter the participant's name before creating an account.",
        variant: "destructive",
      });
      return;
    }

    if (!normalizedEmail) {
      toast({
        title: "Email required",
        description: "Participant accounts require an email address.",
        variant: "destructive",
      });
      return;
    }

    if (!newStudyVersionId) {
      toast({
        title: "Study required",
        description: "Choose a study assignment before creating the account.",
        variant: "destructive",
      });
      return;
    }

    setCreatingParticipant(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          kind: "participant",
          name,
          email: normalizedEmail,
          respondentId: respondentId || undefined,
          studyVersionId: newStudyVersionId,
        },
      });

      if (error) throw new Error(functionErrorMessage(data, error));

      const created = data as CreatedAccountCredentials;
      setCreatedParticipantAccount(created);

      toast({
        title: "Participant account created",
        description: `${created.email} can now sign in with the temporary password.`,
      });

      setNewRespondentId("");
      setNewName("");
      setNewEmail("");
      await loadParticipants();
    } catch (error) {
      toast({
        title: "Account creation failed",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCreatingParticipant(false);
    }
  };

  const assignStudy = async (
    participantId: string,
    studyVersionId: string,
    options: { quiet?: boolean } = {},
  ) => {
    const study = studyOptions.find((option) => option.study_version_id === studyVersionId);
    if (!study) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error: abandonError } = await supabase
      .from("participant_study_assignments")
      .update({ status: "abandoned" })
      .eq("participant_id", participantId)
      .eq("status", "active");
    if (abandonError) throw abandonError;

    const { error } = await supabase.from("participant_study_assignments").insert({
      participant_id: participantId,
      study_id: study.study_id,
      study_version_id: study.study_version_id,
      assigned_by_user_id: session?.user.id ?? null,
      status: "active",
    });
    if (error) throw error;

    if (!options.quiet) {
      toast({
        title: "Study assigned",
        description: `${study.name} assigned successfully.`,
      });
      loadParticipants();
    }
  };

  const exportData = async () => {
    try {
      // Fetch survey results, personality scores, study summaries, and participants.
      const [
        surveyRes,
        llmScoresRes,
        ipipScoresRes,
        classificationSummariesRes,
        usabilityResponsesRes,
      ] = await Promise.all([
        supabase.from("survey_results").select("*"),
        supabase.from("personality_scores").select("*").eq("method", "llm"),
        supabase.from("personality_scores").select("*").eq("method", "ipip"),
        supabase.from("attachment_classification_summaries").select("*"),
        supabase.from("usability_responses").select("*"),
      ]);

      const llmScoresMap = new Map(llmScoresRes.data?.map(s => [s.participant_id, s]) || []);
      const ipipScoresMap = new Map(ipipScoresRes.data?.map(s => [s.participant_id, s]) || []);
      const surveyResultsMap = new Map(surveyRes.data?.map(s => [s.participant_id, s]) || []);
      const classificationSummaryMap = new Map(
        classificationSummariesRes.data?.map((summary) => [summary.participant_id, summary]) || [],
      );
      const usabilityByParticipant = new Map<
        string,
        { responses: Record<string, number>; feedback: string }
      >();

      for (const response of usabilityResponsesRes.data ?? []) {
        const entry = usabilityByParticipant.get(response.participant_id) ?? { responses: {}, feedback: "" };
        if (typeof response.response_value === "number") {
          entry.responses[response.item_key] = response.response_value;
        }
        if (response.item_key === "free_text_feedback" && response.response_text) {
          entry.feedback = response.response_text;
        }
        usabilityByParticipant.set(response.participant_id, entry);
      }
      // Filter participants based on current filter state
      const filteredParticipants = participants.filter(p => {
        switch (participantFilter) {
          case "submitted":
            return p.survey_submitted;
          case "in-progress":
            return p.started && !p.survey_submitted;
          case "not-submitted":
            return !p.survey_submitted;
          case "all":
          default:
            return true;
        }
      });

      // Helper functions for scores
      const getLlmScore = (participantId: string, trait: string) => {
        const llmScores = llmScoresMap.get(participantId);
        if (!llmScores) return "";
        const score = nestedScore(llmScores[trait as keyof typeof llmScores]);
        return score ? ((score / 120) * 100).toFixed(1) : "";
      };

      const getIpipScore = (participantId: string, trait: string) => {
        const ipipScores = ipipScoresMap.get(participantId);
        if (!ipipScores) return "";
        const score = nestedScore(ipipScores[trait as keyof typeof ipipScores]);
        return score?.toFixed(1) ?? "";
      };

      // Single wide-format export with Big Five and relationship-project columns side by side.
      const headers = [
        "Respondent ID",
        "Name",
        "Email",
        "Study",
        // Big Five scores (chat and ipip), 0-100
        "Openness (Chat)",
        "Conscientiousness (Chat)",
        "Extraversion (Chat)",
        "Agreeableness (Chat)",
        "Neuroticism (Chat)",
        "Openness (IPIP)",
        "Conscientiousness (IPIP)",
        "Extraversion (IPIP)",
        "Agreeableness (IPIP)",
        "Neuroticism (IPIP)",
        // Big Five accuracy ratings (1-5)
        "Openness Chat Accuracy",
        "Openness IPIP Accuracy",
        "Conscientiousness Chat Accuracy",
        "Conscientiousness IPIP Accuracy",
        "Extraversion Chat Accuracy",
        "Extraversion IPIP Accuracy",
        "Agreeableness Chat Accuracy",
        "Agreeableness IPIP Accuracy",
        "Neuroticism Chat Accuracy",
        "Neuroticism IPIP Accuracy",
        // Relationship-pattern classifier and usability metrics
        "Attachment Prototype",
        "Mean Anxiety",
        "SD Anxiety",
        "Mean Avoidance",
        "SD Avoidance",
        "Completed Classifier Runs",
        "Displayed Narrative",
        "CUQ Score",
        "SUS Score",
        "Plausibility Rating",
        "Usability Feedback",
        // Overall preference and feedback
        "Overall Method Preference",
        "Feedback",
        "Submitted",
      ];

      const rows = filteredParticipants.map((p) => {
        const surveyResult = surveyResultsMap.get(p.id);
        const summary = classificationSummaryMap.get(p.id);
        const usability = usabilityByParticipant.get(p.id);
        const cuq = usability ? scoreCuq(CUQ_ITEMS, usability.responses) : null;
        const sus = usability ? scoreSus(SUS_ITEMS, usability.responses) : null;
        const plausibility = usability?.responses[PLAUSIBILITY_ITEM.itemKey] ?? "";
        const fmt = (n: unknown) =>
          typeof n === "number" ? n.toFixed(2) : (n ?? "");

        return [
          p.respondent_id,
          p.name || "",
          p.email || "",
          p.active_study_slug || "",
          // Big Five scores
          getLlmScore(p.id, "openness"),
          getLlmScore(p.id, "conscientiousness"),
          getLlmScore(p.id, "extraversion"),
          getLlmScore(p.id, "agreeableness"),
          getLlmScore(p.id, "neuroticism"),
          getIpipScore(p.id, "openness"),
          getIpipScore(p.id, "conscientiousness"),
          getIpipScore(p.id, "extraversion"),
          getIpipScore(p.id, "agreeableness"),
          getIpipScore(p.id, "neuroticism"),
          // Big Five accuracy ratings
          surveyResult?.openness_chat_accuracy ?? "",
          surveyResult?.openness_ipip_accuracy ?? "",
          surveyResult?.conscientiousness_chat_accuracy ?? "",
          surveyResult?.conscientiousness_ipip_accuracy ?? "",
          surveyResult?.extraversion_chat_accuracy ?? "",
          surveyResult?.extraversion_ipip_accuracy ?? "",
          surveyResult?.agreeableness_chat_accuracy ?? "",
          surveyResult?.agreeableness_ipip_accuracy ?? "",
          surveyResult?.neuroticism_chat_accuracy ?? "",
          surveyResult?.neuroticism_ipip_accuracy ?? "",
          // Relationship-pattern classifier and usability metrics
          summary?.modal_prototype ?? "",
          fmt(summary ? Number(summary.mean_anxiety) : ""),
          fmt(summary ? Number(summary.sd_anxiety) : ""),
          fmt(summary ? Number(summary.mean_avoidance) : ""),
          fmt(summary ? Number(summary.sd_avoidance) : ""),
          summary?.completed_runs ?? "",
          summary?.displayed_narrative ?? "",
          cuq !== null ? cuq.toFixed(1) : "",
          sus !== null ? sus.toFixed(1) : "",
          plausibility,
          usability?.feedback ?? "",
          // Overall preference and feedback
          surveyResult?.overall_method_preference ?? "",
          surveyResult?.feedback || "",
          p.survey_submitted,
        ];
      });

      const csv = [headers, ...rows].map(row => row.map(csvValue).join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filterLabel = participantFilter === "all" ? "All" : participantFilter === "submitted" ? "Submitted" : participantFilter === "in-progress" ? "InProgress" : "NotStarted";
      a.download = `Survey_Results_${filterLabel}_${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/ /g, '_')}.csv`;
      a.click();

      toast({
        title: "Success",
        description: `Exported ${filteredParticipants.length} participants (${filterLabel})`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  const getSessionLink = (respondentId: string) => {
    return appUrl(`/participant/${respondentId}`);
  };

  const filteredParticipantsList = participants.filter(p => {
    if (participantFilter === "submitted") return p.survey_submitted;
    if (participantFilter === "not-submitted") return !p.survey_submitted;
    if (participantFilter === "in-progress") return p.started && !p.survey_submitted;
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedParticipants(new Set(filteredParticipantsList.map(p => p.id)));
    } else {
      setSelectedParticipants(new Set());
    }
  };

  const handleSelectParticipant = (participantId: string, checked: boolean) => {
    const newSelected = new Set(selectedParticipants);
    if (checked) {
      newSelected.add(participantId);
    } else {
      newSelected.delete(participantId);
    }
    setSelectedParticipants(newSelected);
  };

  const isAllSelected = filteredParticipantsList.length > 0 &&
    filteredParticipantsList.every(p => selectedParticipants.has(p.id));

  const deleteSelectedParticipants = async () => {
    if (selectedParticipants.size === 0) return;

    setDeleting(true);
    try {
      const participantIds = Array.from(selectedParticipants);

      // Get all chat session IDs for these participants first
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id")
        .in("participant_id", participantIds);

      const sessionIds = sessions?.map(s => s.id) || [];

      // Delete in order respecting foreign key constraints
      // 1. Delete chat messages (references chat_sessions)
      if (sessionIds.length > 0) {
        const { error: messagesError } = await supabase
          .from("chat_messages")
          .delete()
          .in("session_id", sessionIds);
        if (messagesError) throw messagesError;
      }

      // 2. Delete chat sessions
      const { error: sessionsError } = await supabase
        .from("chat_sessions")
        .delete()
        .in("participant_id", participantIds);
      if (sessionsError) throw sessionsError;

      // 3. Delete consent responses
      const { error: consentError } = await supabase
        .from("consent_responses")
        .delete()
        .in("participant_id", participantIds);
      if (consentError) throw consentError;

      // 4. Delete ipip responses
      const { error: ipipError } = await supabase
        .from("ipip_responses")
        .delete()
        .in("participant_id", participantIds);
      if (ipipError) throw ipipError;

      // 5. Delete personality scores
      const { error: scoresError } = await supabase
        .from("personality_scores")
        .delete()
        .in("participant_id", participantIds);
      if (scoresError) throw scoresError;

      // 6. Delete survey results
      const { error: surveyError } = await supabase
        .from("survey_results")
        .delete()
        .in("participant_id", participantIds);
      if (surveyError) throw surveyError;

      await supabase.from("usability_responses").delete().in("participant_id", participantIds);
      await supabase.from("attachment_classification_runs").delete().in("participant_id", participantIds);
      await supabase.from("attachment_classification_summaries").delete().in("participant_id", participantIds);
      await supabase.from("participant_study_assignments").delete().in("participant_id", participantIds);

      // 7. Finally delete the participants themselves
      const { error: participantsError } = await supabase
        .from("participants")
        .delete()
        .in("id", participantIds);
      if (participantsError) throw participantsError;

      toast({
        title: "Success",
        description: `Deleted ${participantIds.length} participant(s) and all related data`,
      });

      setSelectedParticipants(new Set());
      setDeleteDialogOpen(false);
      loadParticipants();
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Participants</CardDescription>
              <CardTitle className="text-3xl">{participants.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Started Survey</CardDescription>
              <CardTitle className="text-3xl">
                {participants.filter(p => p.started).length}
                <span className="text-base font-normal text-muted-foreground ml-2">
                  ({participants.length > 0 ? Math.round((participants.filter(p => p.started).length / participants.length) * 100) : 0}%)
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed & Submitted</CardDescription>
              <CardTitle className="text-3xl">
                {participants.filter(p => p.survey_submitted).length}
                <span className="text-base font-normal text-muted-foreground ml-2">
                  ({participants.length > 0 ? Math.round((participants.filter(p => p.survey_submitted).length / participants.length) * 100) : 0}%)
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Collapsible open={participantsOpen} onOpenChange={setParticipantsOpen}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <CardTitle>Participants</CardTitle>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${participantsOpen ? '' : '-rotate-90'}`} />
                    </button>
                  </CollapsibleTrigger>
                  <Select value={participantFilter} onValueChange={(v) => setParticipantFilter(v as "all" | "not-submitted" | "in-progress" | "submitted")}>
                    <SelectTrigger className="w-[160px] h-8 text-sm">
                      <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({participants.length})</SelectItem>
                      <SelectItem value="submitted">Submitted ({participants.filter(p => p.survey_submitted).length})</SelectItem>
                      <SelectItem value="not-submitted">Not Submitted ({participants.filter(p => !p.survey_submitted).length})</SelectItem>
                      <SelectItem value="in-progress">In Progress ({participants.filter(p => p.started && !p.survey_submitted).length})</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <div className="flex items-center gap-2">
                {selectedParticipants.size > 0 && (
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedParticipants.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedParticipants.size} Participant(s)?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>This action is <strong>permanent and cannot be undone</strong>.</p>
                          <p>The following data will be deleted for each selected participant:</p>
                          <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                            <li>Participant record (ID, name)</li>
                            <li>All chat sessions and messages</li>
                            <li>Consent responses</li>
                            <li>IPIP questionnaire responses</li>
                            <li>Personality scores (LLM and IPIP)</li>
                            <li>Survey, usability, classification, and feedback data</li>
                          </ul>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteSelectedParticipants}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Permanently
                            </>
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refreshing}
                      onClick={async () => {
                        setRefreshing(true);
                        const minDelay = new Promise(resolve => setTimeout(resolve, 600));
                        await Promise.all([loadParticipants(), minDelay]);
                        setRefreshing(false);
                      }}
                    >
                      <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh participants</p>
                  </TooltipContent>
                </Tooltip>
                <Dialog
                  open={addParticipantOpen}
                  onOpenChange={(open) => {
                    setAddParticipantOpen(open);
                    if (!open) {
                      setCreatedParticipantAccount(null);
                      setCopiedCredentials(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add participant
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Participant Account</DialogTitle>
                      <DialogDescription>
                        Create an email/password account and assign it to a published study.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      {createdParticipantAccount ? (
                        <div className="space-y-4">
                          <div className="rounded-md border bg-muted/50 p-3 text-sm">
                            <div className="font-medium">Temporary sign-in details</div>
                            <div className="mt-3 grid gap-2">
                              <div>
                                <div className="text-xs text-muted-foreground">Sign-in URL</div>
                                <div className="font-mono text-xs">{appUrl("/")}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Email</div>
                                <div className="font-mono text-xs">{createdParticipantAccount.email}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Temporary password</div>
                                <div className="font-mono text-xs">{createdParticipantAccount.temporaryPassword}</div>
                              </div>
                            </div>
                          </div>
                          <Button type="button" variant="outline" onClick={copyCreatedCredentials} className="w-full">
                            {copiedCredentials ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            Copy Sign-In Details
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setCreatedParticipantAccount(null)}
                            className="w-full"
                          >
                            Add Another Participant
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="respondentId">Respondent ID (Optional)</Label>
                            <Input
                              id="respondentId"
                              value={newRespondentId}
                              onChange={(e) => setNewRespondentId(e.target.value)}
                              placeholder="Generated when blank"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                              id="name"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Participant name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="participant@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="studyAssignment">Study Assignment</Label>
                            <Select value={newStudyVersionId} onValueChange={setNewStudyVersionId}>
                              <SelectTrigger id="studyAssignment">
                                <SelectValue placeholder="Choose study" />
                              </SelectTrigger>
                              <SelectContent>
                                {studyOptions.map((study) => (
                                  <SelectItem key={study.study_version_id} value={study.study_version_id}>
                                    {study.name} v{study.version_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={createParticipantAccount} disabled={creatingParticipant} className="w-full">
                            {creatingParticipant ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="mr-2 h-4 w-4" />
                            )}
                            Create Participant Account
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button onClick={exportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all participants"
                    />
                  </TableHead>
                  <TableHead>Respondent ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Study</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Chats</TableHead>
                  <TableHead>Questionnaire</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipantsList.map((p) => (
                  <TableRow key={p.id} data-state={selectedParticipants.has(p.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedParticipants.has(p.id)}
                        onCheckedChange={(checked) => handleSelectParticipant(p.id, checked as boolean)}
                        aria-label={`Select ${p.name || p.respondent_id}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{p.respondent_id}</TableCell>
                    <TableCell>{p.name || "-"}</TableCell>
                    <TableCell>{p.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={p.active_study_version_id ?? ""}
                        onValueChange={(value) => assignStudy(p.id, value)}
                      >
                        <SelectTrigger className="w-[220px] h-8 text-xs">
                          <SelectValue placeholder="Assign study" />
                        </SelectTrigger>
                        <SelectContent>
                          {studyOptions.map((study) => (
                            <SelectItem key={study.study_version_id} value={study.study_version_id}>
                              {study.name} v{study.version_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {p.user_id && p.email ? (
                        <button
                          onClick={() => copyEmailSignInLink(p)}
                          className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          <code>Email sign-in</code>
                          {copiedLink === `email-${p.id}` ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => copySessionLink(p.respondent_id)}
                          className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          <code>/participant/{p.respondent_id}</code>
                          {copiedLink === `legacy-${p.respondent_id}` ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>{p.consent ? "✓" : "✗"}</TableCell>
                    <TableCell>{p.started ? "✓" : "✗"}</TableCell>
                    <TableCell>
                      {p.sessions_complete}/{p.active_study_slug === "relationship_patterns_cuq_sus_plausibility" ? 1 : 20}
                    </TableCell>
                    <TableCell>
                      {p.active_study_slug === "relationship_patterns_cuq_sus_plausibility"
                        ? `${p.usability_count}/${RELATIONSHIP_USABILITY_REQUIRED_ITEMS}`
                        : `${p.ipip_count}/50`}
                    </TableCell>
                    <TableCell>{p.survey_submitted ? "✓" : "✗"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/participant/${p.respondent_id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AdminRoleManager currentUserId={currentUserId} />
    </div>
  );
}
