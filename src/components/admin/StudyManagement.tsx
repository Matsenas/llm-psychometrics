import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, CopyPlus, Loader2, Pencil, Rocket, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { StudyBlock, StudyConfig, StudySlug, STUDY_LABELS, isStudySlug } from "@/studies/registry";
import { replaceStudyBlock, validateStudyConfig } from "@/studies/studyConfigValidation";

interface StudyManagementProps {
  currentUserId: string;
}

interface StudyRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface StudyVersionRow {
  id: string;
  study_id: string;
  version_number: number;
  config: Json;
  is_published: boolean;
  created_at: string;
  created_by_user_id: string | null;
  published_at: string | null;
  supersedes_version_id: string | null;
  change_note: string | null;
}

interface StudyView {
  study: StudyRow;
  slug: StudySlug;
  versions: StudyVersionRow[];
}

export function StudyManagement({ currentUserId }: StudyManagementProps) {
  const [studies, setStudies] = useState<StudyView[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [selectedVersionByStudy, setSelectedVersionByStudy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [mutatingVersionId, setMutatingVersionId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const navigate = useNavigate();
  const params = useParams<{
    studySlug?: string;
    versionId?: string;
    blockId?: string;
  }>();
  const { toast } = useToast();

  useEffect(() => {
    loadStudies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVersion = useMemo(() => {
    if (!params.versionId) return null;
    for (const study of studies) {
      const version = study.versions.find((candidate) => candidate.id === params.versionId);
      if (version) return { study, version };
    }
    return null;
  }, [params.versionId, studies]);

  const selectedBlock = useMemo(() => {
    if (!params.blockId || !selectedVersion) return null;
    const parsed = validateStudyConfig(selectedVersion.version.config, selectedVersion.study.slug);
    return parsed.config?.blocks.find((block) => block.id === params.blockId) ?? null;
  }, [params.blockId, selectedVersion]);

  async function loadStudies() {
    try {
      setLoading(true);
      const [studiesResult, versionsResult, assignmentsResult] = await Promise.all([
        supabase.from("studies").select("*").order("created_at"),
        supabase.from("study_versions").select("*").order("version_number", { ascending: false }),
        supabase.from("participant_study_assignments").select("study_version_id"),
      ]);

      if (studiesResult.error) throw studiesResult.error;
      if (versionsResult.error) throw versionsResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      const counts: Record<string, number> = {};
      (assignmentsResult.data ?? []).forEach((assignment) => {
        counts[assignment.study_version_id] = (counts[assignment.study_version_id] ?? 0) + 1;
      });
      setAssignmentCounts(counts);

      const versions = (versionsResult.data ?? []) as StudyVersionRow[];
      const supportedStudies = ((studiesResult.data ?? []) as StudyRow[])
        .filter((study) => isStudySlug(study.slug))
        .map((study) => ({
          study,
          slug: study.slug as StudySlug,
          versions: versions.filter((version) => version.study_id === study.id),
        }));

      setStudies(supportedStudies);
      setSelectedVersionByStudy((current) => {
        const next = { ...current };
        supportedStudies.forEach((study) => {
          if (!next[study.study.id] && study.versions[0]) {
            next[study.study.id] = study.versions[0].id;
          }
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load studies";
      toast({ title: "Studies unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function cloneVersion(study: StudyView, version: StudyVersionRow) {
    setMutatingVersionId(version.id);
    try {
      const nextVersionNumber = Math.max(0, ...study.versions.map((candidate) => candidate.version_number)) + 1;
      const validation = validateStudyConfig(version.config, study.slug);
      if (!validation.config) throw new Error(validation.errors.join(" "));

      const clonedConfig = {
        ...validation.config,
        version: nextVersionNumber,
      } as Json;

      const { data, error } = await supabase
        .from("study_versions")
        .insert({
          study_id: study.study.id,
          version_number: nextVersionNumber,
          config: clonedConfig,
          is_published: false,
          created_by_user_id: currentUserId,
          supersedes_version_id: version.id,
          change_note: `Draft cloned from v${version.version_number}`,
        })
        .select("id")
        .single();
      if (error) throw error;

      toast({ title: "Draft created", description: `${study.study.name} v${nextVersionNumber} is ready to edit.` });
      await loadStudies();
      if (data?.id) {
        setSelectedVersionByStudy((current) => ({ ...current, [study.study.id]: data.id }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to clone version";
      toast({ title: "Clone failed", description: message, variant: "destructive" });
    } finally {
      setMutatingVersionId(null);
    }
  }

  async function publishVersion(study: StudyView, version: StudyVersionRow) {
    setMutatingVersionId(version.id);
    try {
      const validation = validateStudyConfig(version.config, study.slug);
      if (!validation.config) throw new Error(validation.errors.join(" "));

      const { error } = await supabase
        .from("study_versions")
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .eq("id", version.id);
      if (error) throw error;

      toast({ title: "Version published", description: `${study.study.name} v${version.version_number} can now be assigned.` });
      await loadStudies();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to publish version";
      toast({ title: "Publish failed", description: message, variant: "destructive" });
    } finally {
      setMutatingVersionId(null);
    }
  }

  async function deleteVersion(study: StudyView, version: StudyVersionRow) {
    const assignmentCount = assignmentCounts[version.id] ?? 0;
    if (assignmentCount > 0) {
      toast({
        title: "Setup is in use",
        description: `This setup has ${assignmentCount} participant assignment${assignmentCount === 1 ? "" : "s"} and cannot be deleted.`,
        variant: "destructive",
      });
      return;
    }

    setDeletingVersionId(version.id);
    try {
      const { error } = await supabase.from("study_versions").delete().eq("id", version.id);
      if (error) throw error;

      if (params.versionId === version.id) {
        navigate("/admin/studies", { replace: true });
      }

      setSelectedVersionByStudy((current) => {
        const next = { ...current };
        delete next[study.study.id];
        return next;
      });
      toast({ title: "Setup deleted", description: `${study.study.name} v${version.version_number} was permanently deleted.` });
      await loadStudies();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete study setup";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeletingVersionId(null);
    }
  }

  function openBlock(study: StudyView, version: StudyVersionRow, block: StudyBlock) {
    navigate(`/admin/studies/${study.slug}/versions/${version.id}/blocks/${block.id}`);
  }

  function closeBlock() {
    navigate("/admin/studies");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {studies.map((study) => {
        const version = study.versions.find((candidate) => candidate.id === selectedVersionByStudy[study.study.id])
          ?? study.versions[0]
          ?? null;
        const parsed = version ? validateStudyConfig(version.config, study.slug) : { config: null, errors: ["No version found."] };
        const config = parsed.config;
        const versionAssignmentCount = version ? assignmentCounts[version.id] ?? 0 : 0;
        const isVersionMutating = version ? mutatingVersionId === version.id || deletingVersionId === version.id : false;

        return (
          <Card key={study.study.id}>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{STUDY_LABELS[study.slug] ?? study.study.name}</CardTitle>
                    <Badge variant={study.study.is_active ? "default" : "secondary"}>
                      {study.study.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>{study.study.description ?? study.study.slug}</CardDescription>
                </div>
                {version && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={version.id}
                      onValueChange={(value) =>
                        setSelectedVersionByStudy((current) => ({ ...current, [study.study.id]: value }))
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {study.versions.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            v{candidate.version_number} {candidate.is_published ? "published" : "draft"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isVersionMutating}
                      onClick={() => cloneVersion(study, version)}
                    >
                      <CopyPlus className="h-4 w-4" />
                      New Draft
                    </Button>
                    {!version.is_published && (
                      <Button
                        size="sm"
                        disabled={isVersionMutating || parsed.errors.length > 0}
                        onClick={() => publishVersion(study, version)}
                      >
                        {mutatingVersionId === version.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Publish
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost-destructive"
                          size="sm"
                          disabled={isVersionMutating || versionAssignmentCount > 0}
                          title={
                            versionAssignmentCount > 0
                              ? "Assigned study setups cannot be deleted"
                              : "Delete this study setup"
                          }
                        >
                          {deletingVersionId === version.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete Setup
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this study setup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes {study.study.name} v{version.version_number}, including its
                            complete block configuration. This is only allowed for setups with no participant
                            assignments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deletingVersionId === version.id}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteVersion(study, version)}
                            disabled={deletingVersionId === version.id}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingVersionId === version.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {version ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <StudyMetric label="Version" value={`v${version.version_number}`} />
                    <StudyMetric label="State" value={version.is_published ? "Published" : "Draft"} />
                    <StudyMetric label="Assignments" value={`${versionAssignmentCount}`} />
                    <StudyMetric label="Blocks" value={`${config?.blocks.length ?? 0}`} />
                  </div>

                  {parsed.errors.length > 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        <XCircle className="h-4 w-4" />
                        Invalid study config
                      </div>
                      <ul className="list-disc pl-5">
                        {parsed.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Block</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Config Summary</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {config?.blocks.map((block) => (
                        <TableRow key={block.id}>
                          <TableCell className="font-mono text-sm">{block.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{block.type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[420px] truncate text-sm text-muted-foreground">
                            {summarizeConfig(block.config)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openBlock(study, version, block)}>
                              <Pencil className="h-4 w-4" />
                              {version.is_published ? "Open" : "Edit"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No versions found for this study.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {selectedVersion && selectedBlock && (
        <StudyBlockEditorDialog
          block={selectedBlock}
          study={selectedVersion.study}
          version={selectedVersion.version}
          open={!!params.blockId}
          onClose={closeBlock}
          onSaved={loadStudies}
        />
      )}
    </div>
  );
}

function StudyBlockEditorDialog({
  block,
  study,
  version,
  open,
  onClose,
  onSaved,
}: {
  block: StudyBlock;
  study: StudyView;
  version: StudyVersionRow;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(formatBlock(block));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDraft(formatBlock(block));
  }, [block]);

  async function saveBlock() {
    if (version.is_published) return;

    setSaving(true);
    try {
      const parsedBlock = JSON.parse(draft) as StudyBlock;
      const current = validateStudyConfig(version.config, study.slug);
      if (!current.config) throw new Error(current.errors.join(" "));

      const nextConfig = replaceStudyBlock(current.config as StudyConfig, parsedBlock);
      const validation = validateStudyConfig(nextConfig, study.slug);
      if (!validation.config) throw new Error(validation.errors.join(" "));

      const { error } = await supabase.from("study_versions").update({ config: nextConfig }).eq("id", version.id);
      if (error) throw error;

      toast({ title: "Block saved", description: `${block.id} updated in draft v${version.version_number}.` });
      await onSaved();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid block JSON";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {block.id} · v{version.version_number}
          </DialogTitle>
          <DialogDescription>
            {version.is_published
              ? "Published versions are read-only. Create a new draft to edit this block."
              : "Edit the draft block JSON. The full study config is validated before saving."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{block.type}</Badge>
            <Badge variant={version.is_published ? "default" : "secondary"}>
              {version.is_published ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-json">Block JSON</Label>
            <Textarea
              id="block-json"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              readOnly={version.is_published}
              className="min-h-[360px] font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!version.is_published && (
              <Button onClick={saveBlock} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Block
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function formatBlock(block: StudyBlock) {
  return JSON.stringify(block, null, 2);
}

function summarizeConfig(config: Record<string, unknown> | undefined) {
  if (!config) return "No config";
  const entries = Object.entries(config).slice(0, 4);
  if (entries.length === 0) return "Empty config";
  return entries.map(([key, value]) => `${key}: ${String(Array.isArray(value) ? value.join(", ") : value)}`).join(" · ");
}
