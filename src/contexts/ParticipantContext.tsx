import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface Participant {
  id: string;
  respondent_id: string;
  name: string | null;
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
}

const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

const STORAGE_KEY = "participant_session";

export const ParticipantProvider = ({ children }: { children: ReactNode }) => {
  const [participant, setParticipantState] = useState<Participant | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
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

        // If we have an auth session, try to get participant from database
        if (existingSession?.user) {
          const { data: participantData } = await supabase
            .from("participants")
            .select("id, respondent_id, name, disabled")
            .eq("user_id", existingSession.user.id)
            .maybeSingle();

          if (participantData) {
            if (participantData.disabled) {
              // Participant is disabled - clear session
              setIsDisabled(true);
              setParticipantState(null);
              localStorage.removeItem(STORAGE_KEY);
            } else {
              setParticipantState(participantData);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(participantData));
            }
          }
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

  const setParticipant = (p: Participant | null) => {
    setParticipantState(p);
    if (p) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearParticipant = async () => {
    setParticipantState(null);
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
      user
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
