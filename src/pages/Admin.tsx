import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Plus, LogOut, UserPlus, RotateCw, Eye, Copy, Check, Filter, ChevronDown, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QuestionsOverview from "@/components/QuestionsOverview";
import LLMPromptsOverview from "@/components/LLMPromptsOverview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ParticipantData {
  id: string;
  respondent_id: string;
  name: string | null;
  assessment_type: AssessmentType;
  consent: boolean;
  started: boolean;
  sessions_complete: number;
  ipip_count: number;
  ecr_count: number;
  survey_submitted: boolean;
}

const Admin = () => {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [newRespondentId, setNewRespondentId] = useState("");
  const [newName, setNewName] = useState("");
  const [newAssessmentType, setNewAssessmentType] = useState<AssessmentType>("ecr");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [participantFilter, setParticipantFilter] = useState<"all" | "not-submitted" | "in-progress" | "submitted">("all");
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const copySessionLink = (respondentId: string) => {
    const link = `https://ut-ani.lovable.app/participant/${respondentId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(respondentId);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({
      title: "Copied!",
      description: "Session link copied to clipboard",
    });
  };

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserEmail(session.user.email || null);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      loadParticipants();
      loadAdminEmails();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/auth");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const loadAdminEmails = async () => {
    try {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", adminRoles.map(r => r.user_id));

        if (profiles) {
          setAdminEmails(profiles.map(p => p.email));
        }
      }
    } catch (error) {
      console.error("Error loading admin emails:", error);
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
          const [consent, anySessions, completedSessions, ipip, ecr, results] = await Promise.all([
            supabase.from("consent_responses").select("id").eq("participant_id", p.id).limit(1),
            supabase.from("chat_sessions").select("id").eq("participant_id", p.id).limit(1),
            supabase.from("chat_sessions").select("id").eq("participant_id", p.id).eq("is_complete", true),
            supabase.from("ipip_responses").select("id").eq("participant_id", p.id),
            supabase.from("ecr_responses").select("id").eq("participant_id", p.id),
            supabase.from("survey_results").select("submitted").eq("participant_id", p.id).limit(1),
          ]);

          return {
            id: p.id,
            respondent_id: p.respondent_id,
            name: p.name,
            assessment_type: (p.assessment_type as AssessmentType) ?? "big5",
            consent: (consent.data?.length || 0) > 0,
            started: (anySessions.data?.length || 0) > 0,
            sessions_complete: completedSessions.data?.length || 0,
            ipip_count: ipip.data?.length || 0,
            ecr_count: ecr.data?.length || 0,
            survey_submitted: results.data?.[0]?.submitted || false,
          };
        })
      );

      setParticipants(enrichedData);
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

  const addSingleParticipant = async () => {
    if (!newRespondentId.trim()) {
      toast({
        title: "Error",
        description: "Respondent ID is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("participants")
        .insert({
          respondent_id: newRespondentId.trim(),
          name: newName.trim() || null,
          assessment_type: newAssessmentType,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Participant added successfully",
      });

      setNewRespondentId("");
      setNewName("");
      setNewAssessmentType("ecr");
      loadParticipants();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const importParticipants = async () => {
    if (!csvInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter CSV data",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const lines = csvInput.trim().split("\n");
      const parsedParticipants: { respondent_id: string; name: string | null }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip header row if present
        if (i === 0 && (line.toLowerCase().includes("respondent") || line.toLowerCase().includes("submission"))) {
          continue;
        }

        const parts = line.split(",").map(p => p.trim());
        
        // Handle Tally CSV format: Submission ID, Respondent ID, URL, Submitted at, Name, ...
        // Respondent ID is at index 1, Name is at index 4
        const respondentId = parts[1];
        const name = parts[4] || null;
        
        if (respondentId) {
          parsedParticipants.push({
            respondent_id: respondentId,
            name: name,
          });
        }
      }

      if (parsedParticipants.length === 0) {
        throw new Error("No valid participants found in CSV");
      }

      // Deduplicate parsed participants (keep first occurrence)
      const uniqueParsed = Array.from(
        new Map(parsedParticipants.map(p => [p.respondent_id, p])).values()
      );

      // Fetch existing participants to check for duplicates
      const { data: existingParticipants, error: fetchError } = await supabase
        .from("participants")
        .select("respondent_id");

      if (fetchError) throw fetchError;

      const existingIds = new Set(existingParticipants?.map(p => p.respondent_id) || []);
      
      // Filter out participants that already exist in database
      const newParticipants = uniqueParsed.filter(p => !existingIds.has(p.respondent_id));

      if (newParticipants.length === 0) {
        toast({
          title: "Info",
          description: `All ${parsedParticipants.length} participants already exist in the database`,
        });
        setCsvInput("");
        return;
      }

      const { error } = await supabase
        .from("participants")
        .insert(newParticipants);

      if (error) throw error;

      const duplicatesInCsv = parsedParticipants.length - uniqueParsed.length;
      const existingInDb = uniqueParsed.length - newParticipants.length;
      const skippedCount = duplicatesInCsv + existingInDb;
      toast({
        title: "Success",
        description: `Added ${newParticipants.length} new participants${skippedCount > 0 ? ` (skipped ${skippedCount}: ${existingInDb} existing, ${duplicatesInCsv} duplicates)` : ''}`,
      });

      setCsvInput("");
      loadParticipants();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const exportData = async () => {
    try {
      // Fetch survey results, personality/attachment scores, and participants.
      const [surveyRes, llmScoresRes, ipipScoresRes, attachmentScoresRes, participantsRes] = await Promise.all([
        supabase.from("survey_results").select("*"),
        supabase.from("personality_scores").select("*").eq("method", "llm"),
        supabase.from("personality_scores").select("*").eq("method", "ipip"),
        supabase.from("attachment_scores").select("*"),
        supabase.from("participants").select("*"),
      ]);

      const participantMap = new Map(participantsRes.data?.map(p => [p.id, p]) || []);
      const llmScoresMap = new Map(llmScoresRes.data?.map(s => [s.participant_id, s]) || []);
      const ipipScoresMap = new Map(ipipScoresRes.data?.map(s => [s.participant_id, s]) || []);
      const surveyResultsMap = new Map(surveyRes.data?.map(s => [s.participant_id, s]) || []);
      const attachmentLlmMap = new Map(
        (attachmentScoresRes.data ?? [])
          .filter((s) => s.method === "llm")
          .map((s) => [s.participant_id, s]),
      );
      const attachmentSelfMap = new Map(
        (attachmentScoresRes.data ?? [])
          .filter((s) => s.method === "self")
          .map((s) => [s.participant_id, s]),
      );

      // Filter participants based on current filter state
      const filteredParticipants = participants.filter(p => {
        switch (participantFilter) {
          case "submitted":
            return p.survey_submitted;
          case "in-progress":
            return p.started && !p.survey_submitted;
          case "not-submitted":
            return !p.started;
          case "all":
          default:
            return true;
        }
      });

      // Helper functions for scores
      const getLlmScore = (participantId: string, trait: string) => {
        const llmScores = llmScoresMap.get(participantId);
        if (!llmScores) return "";
        const score = (llmScores[trait as keyof typeof llmScores] as any)?.score;
        return score ? ((score / 120) * 100).toFixed(1) : "";
      };
      
      const getIpipScore = (participantId: string, trait: string) => {
        const ipipScores = ipipScoresMap.get(participantId);
        if (!ipipScores) return "";
        const score = (ipipScores[trait as keyof typeof ipipScores] as any)?.score;
        return score?.toFixed(1) ?? "";
      };

      // Single wide-format export with Big Five and ECR columns side by side.
      // Per-participant rows include only the data for their assessment_type; the
      // other assessment's columns are empty.
      const headers = [
        "Respondent ID",
        "Name",
        "Assessment Type",
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
        // ECR attachment scores (chat and self), native 1-7 scale
        "Anxiety (Chat)",
        "Avoidance (Chat)",
        "Anxiety (Self)",
        "Avoidance (Self)",
        // ECR accuracy ratings (1-5)
        "Anxiety Chat Accuracy",
        "Anxiety Self Accuracy",
        "Avoidance Chat Accuracy",
        "Avoidance Self Accuracy",
        // Overall preference and feedback
        "Overall Method Preference",
        "Feedback",
        "Submitted",
      ];

      const rows = filteredParticipants.map((p) => {
        const surveyResult = surveyResultsMap.get(p.id);
        const attachLlm = attachmentLlmMap.get(p.id);
        const attachSelf = attachmentSelfMap.get(p.id);
        const fmt = (n: unknown) =>
          typeof n === "number" ? n.toFixed(2) : (n ?? "");

        return [
          p.respondent_id,
          p.name || "",
          p.assessment_type,
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
          // ECR attachment scores
          fmt(attachLlm ? Number(attachLlm.anxiety) : ""),
          fmt(attachLlm ? Number(attachLlm.avoidance) : ""),
          fmt(attachSelf ? Number(attachSelf.anxiety) : ""),
          fmt(attachSelf ? Number(attachSelf.avoidance) : ""),
          // ECR accuracy ratings
          surveyResult?.anxiety_chat_accuracy ?? "",
          surveyResult?.anxiety_self_accuracy ?? "",
          surveyResult?.avoidance_chat_accuracy ?? "",
          surveyResult?.avoidance_self_accuracy ?? "",
          // Overall preference and feedback
          surveyResult?.overall_method_preference ?? "",
          `"${(surveyResult?.feedback || "").replace(/"/g, '""')}"`,
          surveyResult?.submitted ?? false,
        ];
      });

      const csv = [headers, ...rows].map(row => row.join(",")).join("\n");

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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSessionLink = (respondentId: string) => {
    return `${window.location.origin}/participant/${respondentId}`;
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost-destructive" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to logout from the admin dashboard?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleLogout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

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
                            <li>Survey results and feedback</li>
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
                <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Single Participant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="respondentId">Respondent ID</Label>
                        <Input
                          id="respondentId"
                          value={newRespondentId}
                          onChange={(e) => setNewRespondentId(e.target.value)}
                          placeholder="e.g., 447Xbbd"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Name (Optional)</Label>
                        <Input
                          id="name"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Participant name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assessmentType">Assessment Track</Label>
                        <Select
                          value={newAssessmentType}
                          onValueChange={(v) => setNewAssessmentType(v as AssessmentType)}
                        >
                          <SelectTrigger id="assessmentType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ecr">ECR-R (Attachment, 1 chat)</SelectItem>
                            <SelectItem value="big5">Big Five (IPIP, 20 chats)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => { addSingleParticipant(); setAddParticipantOpen(false); }} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Participant
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import from Tally CSV</DialogTitle>
                      <DialogDescription>
                        Upload or paste your Tally form export CSV. Existing participants (by Respondent ID) will be skipped.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Upload CSV file</label>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setCsvInput(event.target?.result as string || "");
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or paste CSV</span>
                        </div>
                      </div>
                      <Textarea
                        value={csvInput}
                        onChange={(e) => setCsvInput(e.target.value)}
                        placeholder="Submission ID,Respondent ID,URL,Submitted at,Name,Email address,...&#10;kd1VP9R,447Xbbd,https://...,2025-11-25,Andrius,m@tsenas.ee,..."
                        className="min-h-[100px] font-mono text-xs"
                      />
                      {csvInput && (
                        <p className="text-xs text-muted-foreground">
                          {csvInput.split("\n").filter(l => l.trim()).length - 1} rows detected
                        </p>
                      )}
                      <Button onClick={() => { importParticipants(); setBulkImportOpen(false); }} disabled={importing || !csvInput.trim()} className="w-full">
                        {importing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Import Participants
                      </Button>
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
                  <TableHead>Track</TableHead>
                  <TableHead>Session Link</TableHead>
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
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.assessment_type === "ecr" ? "bg-amber-100 text-amber-900" : "bg-primary/10 text-primary"
                      }`}>
                        {p.assessment_type === "ecr" ? "ECR-R" : "Big5"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copySessionLink(p.respondent_id)}
                        className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                      >
                        <code>/participant/{p.respondent_id}</code>
                        {copiedLink === p.respondent_id ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>{p.consent ? "✓" : "✗"}</TableCell>
                    <TableCell>{p.started ? "✓" : "✗"}</TableCell>
                    <TableCell>
                      {p.sessions_complete}/{p.assessment_type === "ecr" ? 1 : 20}
                    </TableCell>
                    <TableCell>
                      {p.assessment_type === "ecr"
                        ? `${p.ecr_count}/36`
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

        {/* Chat Assessment Section */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Assessment</CardTitle>
            <CardDescription>
              System prompts and questions for the conversational chat sessions (per track)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="big5">
              <TabsList>
                <TabsTrigger value="big5">Big Five (20 sessions)</TabsTrigger>
                <TabsTrigger value="ecr">ECR-R (1 session)</TabsTrigger>
              </TabsList>
              <TabsContent value="big5" className="space-y-6 pt-4">
                <LLMPromptsOverview type="chat" assessmentId="big5" />
                <QuestionsOverview assessmentId="big5" />
              </TabsContent>
              <TabsContent value="ecr" className="space-y-6 pt-4">
                <LLMPromptsOverview type="chat" assessmentId="ecr" />
                <QuestionsOverview assessmentId="ecr" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Scoring Section */}
        <Card>
          <CardHeader>
            <CardTitle>LLM Scoring</CardTitle>
            <CardDescription>
              System prompts used when scoring chat transcripts (per track)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="big5">
              <TabsList>
                <TabsTrigger value="big5">Big Five</TabsTrigger>
                <TabsTrigger value="ecr">ECR-R (Attachment)</TabsTrigger>
              </TabsList>
              <TabsContent value="big5" className="pt-4">
                <LLMPromptsOverview type="scoring" assessmentId="big5" />
              </TabsContent>
              <TabsContent value="ecr" className="pt-4">
                <LLMPromptsOverview type="scoring" assessmentId="ecr" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Admin Accounts</CardTitle>
                <CardDescription>
                  Manage administrator accounts
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" size="sm" disabled>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Admin
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Create admin users via the Supabase dashboard, then add a row to <code>user_roles</code> with role <code>admin</code>.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {adminEmails.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {adminEmails.map((email) => (
                  <span key={email} className="text-sm bg-muted px-3 py-1 rounded-md">
                    {email}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No admin accounts found</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Admin;
