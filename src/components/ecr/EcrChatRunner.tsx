import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, RefreshCw, ChevronLeft, Flag } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import confetti from "canvas-confetti";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_QUESTION =
  "Think of a recent moment in a close relationship — romantic, friendship, or family — where you felt a real difficulty. Could be a disagreement, a moment of distance, feeling unseen, or anything else that comes to mind. Share it at whatever depth feels right.";
const TOPIC_LABEL = "Relationship difficulty";
const MIN_TURNS_TO_FINISH = 4;

function triggerConfetti(): void {
  const end = Date.now() + 1500;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#2C5697", "#4A7BC7", "#FFD700", "#FFA500"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#2C5697", "#4A7BC7", "#FFD700", "#FFA500"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export function EcrChatRunner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading: participantLoading, session } = useParticipant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConversationComplete, setIsConversationComplete] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const canFinishEarly = userMessageCount >= MIN_TURNS_TO_FINISH;

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
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
      }
    };
    check();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (participant && !participantLoading) {
      setIsConversationComplete(false);
      initializeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, participantLoading]);

  const initializeSession = async () => {
    if (!participant) return;
    try {
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participant.id)
        .eq("session_number", 1)
        .maybeSingle();

      if (existingSession) {
        setSessionId(existingSession.id);
        const { data: existingMessages } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", existingSession.id)
          .order("created_at", { ascending: true });
        if (existingMessages) {
          setMessages(
            existingMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
        if (existingSession.is_complete) setIsConversationComplete(true);
      } else {
        const { data: newSession, error } = await supabase
          .from("chat_sessions")
          .insert({
            participant_id: participant.id,
            session_number: 1,
            big5_aspect: TOPIC_LABEL,
            initial_question: INITIAL_QUESTION,
          })
          .select()
          .single();
        if (error) throw error;
        setSessionId(newSession.id);
        setMessages([{ role: "assistant", content: INITIAL_QUESTION }]);
        await supabase.from("chat_messages").insert({
          session_id: newSession.id,
          role: "assistant",
          content: INITIAL_QUESTION,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const markSessionComplete = async (criteriaMet: boolean) => {
    if (!sessionId) return;
    await supabase
      .from("chat_sessions")
      .update({
        is_complete: true,
        completion_criteria_met: criteriaMet,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  };

  const sendMessage = async (retryMessage?: string) => {
    const messageToSend = retryMessage ?? input.trim();
    if (!messageToSend || !sessionId) return;

    if (!retryMessage) {
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    }
    setLoading(true);
    setLastFailedMessage(null);

    try {
      if (!retryMessage) {
        await supabase.from("chat_messages").insert({
          session_id: sessionId,
          role: "user",
          content: messageToSend,
        });
      }

      // Use direct fetch to get proper error handling
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relationship-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ sessionId, userMessage: messageToSend }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract error message from response body if available
        const errorMessage = data?.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!data || !data.response) {
        throw new Error("Invalid response from chat service");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: data.response,
      });

      if (data.shouldEnd) {
        await markSessionComplete(true);
        setIsConversationComplete(true);
        triggerConfetti();
        toast({
          title: "Conversation complete",
          description: "Thanks for sharing. Ready for the next step.",
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setLastFailedMessage(messageToSend);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorDetails = error?.message || error?.error || JSON.stringify(error);
      console.error("Full error details:", errorDetails);
      toast({
        title: "Connection Issue",
        description: `AI service error: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) sendMessage(lastFailedMessage);
  };

  const handleContinue = () => {
    navigate("/transition");
  };

  const handleFinishEarly = async () => {
    await markSessionComplete(false);
    setIsConversationComplete(true);
  };

  const handleRefreshSession = async () => {
    if (!sessionId) return;
    try {
      await supabase.from("chat_messages").delete().eq("session_id", sessionId);
      await supabase.from("chat_sessions").delete().eq("id", sessionId);
      setMessages([]);
      setSessionId(null);
      setIsConversationComplete(false);
      await initializeSession();
      toast({ title: "Session Refreshed", description: "Chat session has been reset" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (participantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md p-6">
          <h3 className="text-lg font-semibold text-destructive mb-2">No Session Found</h3>
          <p className="text-muted-foreground">
            Please use your unique session link to access the survey.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <ParticipantHeader />
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate("/start")}
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-sm text-muted-foreground">
            Relationship conversation • {userMessageCount} message{userMessageCount === 1 ? "" : "s"} sent
          </div>
          <div className="flex gap-2">
            {!isConversationComplete &&
              (canFinishEarly ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Flag className="h-3 w-3" />
                      End conversation
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End the conversation now?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>Your responses so far will be saved and used for the AI-based analysis.</p>
                        <p className="text-muted-foreground">
                          Ending early may lower the accuracy of your AI-based attachment scores.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep going</AlertDialogCancel>
                      <AlertDialogAction onClick={handleFinishEarly}>
                        End anyway
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" size="sm" disabled className="gap-1">
                        <Flag className="h-3 w-3" />
                        End conversation
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send at least {MIN_TURNS_TO_FINISH} messages before ending early.</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            {isAdmin && (
              <Button onClick={handleRefreshSession} variant="ghost" size="sm" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        <Card className="flex flex-col h-[65vh]">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                  <p className="text-sm leading-relaxed font-medium">{INITIAL_QUESTION}</p>
                </div>
              </div>
              {messages.slice(1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {isConversationComplete ? (
            <div className="border-t p-4">
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Thanks for sharing. Let's move on to the questionnaire.
                </p>
                <Button onClick={handleContinue} size="default">
                  Continue to Questionnaire
                </Button>
              </div>
            </div>
          ) : lastFailedMessage ? (
            <div className="border-t p-4">
              <div className="text-center space-y-3">
                <p className="text-sm text-destructive">
                  The AI service encountered an issue. What would you like to do?
                </p>
                <div className="flex justify-center gap-3">
                  <Button onClick={handleRetry} variant="default" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type your response..."
                  disabled={loading}
                />
                <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
