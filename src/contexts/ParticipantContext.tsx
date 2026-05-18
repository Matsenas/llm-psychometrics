import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import {
  isStudySlug,
  parseStudyConfig,
} from "@/studies/registry";
import type { ActiveStudy } from "@/studies/registry";

interface Participant {
  id: string;
  respondent_id: string;
  name: string | null;
  email?: string | null;
  disabled?: boolean;
}

interface ParticipantContextType {
  participant: Participant | null;
  setParticipant: (participant: Participant | null) => void;
  clearParticipant: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  session: Session | null;
  user: User | null;
  activeStudy: ActiveStudy | null;
  bootstrapAuthenticatedParticipant: () => Promise<Participant | null>;
  reloadParticipant: () => Promise<Participant | null>;
}

const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

const STORAGE_KEY = "participant_session";

type ParticipantRow = Participant & {
  user_id?: string | null;
};

interface StudyJoin {
  id: string;
  slug: string | null;
  name: string | null;
}

interface StudyVersionJoin {
  id: string;
  version_number: number | null;
  config: Json;
  studies: StudyJoin | StudyJoin[] | null;
}

interface AssignmentJoin {
  id: string;
  status: string;
  study_id: string;
  study_version_id: string;
  study_versions: StudyVersionJoin | StudyVersionJoin[] | null;
}

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    respondent_id: row.respondent_id,
    name: row.name,
    email: row.email,
    disabled: row.disabled,
  };
}

export const ParticipantProvider = ({ children }: { children: ReactNode }) => {
  const [participant, setParticipantState] = useState<Participant | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeStudy, setActiveStudy] = useState<ActiveStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // If signed out, clear participant
        if (event === 'SIGNED_OUT') {
          setParticipantState(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        // If we have an auth session, try to get participant from database.
        // Creation/linking is handled explicitly by the auth callback bootstrap.
        if (existingSession?.user) {
          await loadParticipantForUser(existingSession.user.id);
        } else {
          // Fallback to localStorage for backward compatibility
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              setParticipantState(JSON.parse(stored));
            } catch {
              localStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const loadParticipantForUser = async (userId: string): Promise<Participant | null> => {
    const { data: participantData } = await supabase
      .from("participants")
      .select("id, respondent_id, name, email, disabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!participantData) {
      setParticipantState(null);
      setActiveStudy(null);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (participantData.disabled) {
      setIsDisabled(true);
      setParticipantState(null);
      setActiveStudy(null);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const study = await loadActiveStudy(participantData.id);
    const typed = toParticipant(participantData);

    setParticipantState(typed);
    setActiveStudy(study);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(typed));
    return typed;
  };

  const loadActiveStudy = async (participantId: string): Promise<ActiveStudy | null> => {
    const { data } = await supabase
      .from("participant_study_assignments")
      .select(`
        id,
        status,
        study_id,
        study_version_id,
        study_versions (
          id,
          version_number,
          config,
          studies (
            id,
            slug,
            name
          )
        )
      `)
      .eq("participant_id", participantId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const assignment = data as AssignmentJoin;
    const version = firstJoin(assignment.study_versions);
    const study = firstJoin(version?.studies);
    if (!version || !isStudySlug(study?.slug)) return null;

    const config = parseStudyConfig(version.config, study.slug);

    return {
      assignmentId: assignment.id,
      assignmentStatus: assignment.status,
      studyId: assignment.study_id,
      studyVersionId: assignment.study_version_id,
      slug: study.slug,
      name: study.name ?? study.slug,
      version: version.version_number ?? config.version,
      config,
    };
  };

  const bootstrapAuthenticatedParticipant = async (): Promise<Participant | null> => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    const authUser = currentSession?.user;
    if (!authUser) return null;

    const existing = await loadParticipantForUser(authUser.id);
    if (existing) return existing;

    const email = authUser.email?.trim().toLowerCase() || null;
    let participantData: ParticipantRow | null = null;

    if (email) {
      const { data } = await supabase
        .from("participants")
        .select("id, respondent_id, name, email, disabled, user_id")
        .ilike("email", email)
        .maybeSingle();
      participantData = data;
    }

    if (participantData && !participantData.user_id) {
      const { data, error } = await supabase
        .from("participants")
        .update({ user_id: authUser.id })
        .eq("id", participantData.id)
        .select("id, respondent_id, name, email, disabled")
        .single();
      if (error) throw error;
      participantData = data;
    }

    if (!participantData) {
      setParticipantState(null);
      setActiveStudy(null);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const study = await loadActiveStudy(participantData.id);
    const typed = toParticipant(participantData);
    setParticipantState(typed);
    setActiveStudy(study);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(typed));
    return typed;
  };

  const reloadParticipant = async (): Promise<Participant | null> => {
    if (!user) return null;
    return loadParticipantForUser(user.id);
  };

  const setParticipant = (p: Participant | null) => {
    setParticipantState(p);
    if (!p) setActiveStudy(null);
    if (p) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      void loadActiveStudy(p.id)
        .then(setActiveStudy)
        .catch((error) => console.error("Error loading active study:", error));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearParticipant = async () => {
    setParticipantState(null);
    setActiveStudy(null);
    localStorage.removeItem(STORAGE_KEY);
    // Sign out the anonymous user
    await supabase.auth.signOut();
  };

  return (
    <ParticipantContext.Provider value={{ 
      participant, 
      setParticipant, 
      clearParticipant, 
      isLoading,
      isDisabled,
      session,
      user,
      activeStudy,
      bootstrapAuthenticatedParticipant,
      reloadParticipant,
    }}>
      {children}
    </ParticipantContext.Provider>
  );
};

export const useParticipant = () => {
  const context = useContext(ParticipantContext);
  if (!context) {
    throw new Error("useParticipant must be used within a ParticipantProvider");
  }
  return context;
};
