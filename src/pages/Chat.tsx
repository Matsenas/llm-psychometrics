import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, RefreshCw, Trophy, ChevronLeft } from "lucide-react";
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
import { EcrChatRunner } from "@/components/ecr/EcrChatRunner";
import { assertNever } from "@/lib/assertNever";

// Milestone messages for encouragement
const MILESTONE_MESSAGES: Record<number, { title: string; message: string }> = {
  5: { title: "Quarter way done!", message: "Great start! Keep going, you're doing amazing." },
  10: { title: "Halfway there!", message: "You're crushing it! Just 10 more conversations to go." },
  15: { title: "Almost finished!", message: "So close! Only 5 more to go—you've got this!" },
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

// 20 Big Five questions grouped by trait (4 each)
const BIG5_QUESTIONS = [
  // Agreeableness (1-4)
  { aspect: "Agreeableness", question: "Tell me about the last time someone asked you for help or a favor." },
  { aspect: "Agreeableness", question: "Tell me about the last time you disagreed with someone. What happened?" },
  { aspect: "Agreeableness", question: "How do you usually respond when someone is upset or going through a tough time?" },
  { aspect: "Agreeableness", question: "Tell me about a time when you had to choose between your own interests and someone else's. What did you do?" },
  // Conscientiousness (5-8)
  { aspect: "Conscientiousness", question: "What's one important thing you had to get done this week? How did it go?" },
  { aspect: "Conscientiousness", question: "How do you keep track of your commitments and responsibilities?" },
  { aspect: "Conscientiousness", question: "Walk me through how you prepared for something important recently—maybe an exam, presentation, or event." },
  { aspect: "Conscientiousness", question: "How do you decide what to work on when you have multiple things competing for your attention?" },
  // Extraversion (9-12)
  { aspect: "Extraversion", question: "What does your ideal evening look like?" },
  { aspect: "Extraversion", question: "After a long, exhausting day, would you rather spend time alone or call a friend? Why?" },
  { aspect: "Extraversion", question: "When you meet new people at a social event, what's your typical approach?" },
  { aspect: "Extraversion", question: "How do you feel about being the center of attention?" },
  // Neuroticism (13-16)
  { aspect: "Neuroticism", question: "What's something that has annoyed or stressed you out in the past few days?" },
  { aspect: "Neuroticism", question: "Tell me about a recent mistake you made. How did you handle it?" },
  { aspect: "Neuroticism", question: "When you're facing something uncertain or unpredictable, how do you usually feel?" },
  { aspect: "Neuroticism", question: "How do you typically feel at the end of a busy day?" },
  // Openness (17-20)
  { aspect: "Openness", question: "What kind of conversations do you find most engaging?" },
  { aspect: "Openness", question: "Where would you like to travel to? Why that place?" },
  { aspect: "Openness", question: "Tell me about something new you tried recently. What drew you to it?" },
  { aspect: "Openness", question: "When you encounter an idea that challenges your current views, how do you usually react?" },
];

const MIN_MESSAGES_TO_SKIP = 2;

const Chat = () => {
  const { participant } = useParticipant();
  if (participant) {
    switch (participant.assessment_type) {
      case "ecr":
        return <EcrChatRunner />;
      case "big5":
        break; // fall through to the existing Big Five runner below
      default:
        return assertNever(participant.assessment_type);
    }
  }
  return <BigFiveChat />;
};

const BigFiveChat = () => {
  const [currentSession, setCurrentSession] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConversationComplete, setIsConversationComplete] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { participant, isLoading: participantLoading } = useParticipant();

  // Count user messages (excluding the initial assistant question)
  const userMessageCount = messages.filter(m => m.role === "user").length;
  const canSkip = userMessageCount >= MIN_MESSAGES_TO_SKIP;
  const isLastQuestion = currentSession === 20;

  const triggerConfetti = () => {
    const duration = 1500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#2C5697', '#4A7BC7', '#FFD700', '#FFA500'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#2C5697', '#4A7BC7', '#FFD700', '#FFA500'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkAdminStatus = async () => {
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

  useEffect(() => {
    if (participant && !participantLoading) {
      setIsConversationComplete(false);
      initializeSession();
    }
  }, [currentSession, participant, participantLoading]);

  const initializeSession = async () => {
    if (!participant) return;

    try {
      const questionData = BIG5_QUESTIONS[currentSession - 1];

      // Check if session exists
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participant.id)
        .eq("session_number", currentSession)
        .maybeSingle();

      if (existingSession) {
        setSessionId(existingSession.id);
        
        // Load existing messages
        const { data: existingMessages } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", existingSession.id)
          .order("created_at", { ascending: true });

        if (existingMessages) {
          setMessages(existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
        }

        if (existingSession.is_complete) {
          setIsConversationComplete(true);
        }
      } else {
        // Create new session
        const { data: newSession, error } = await supabase
          .from("chat_sessions")
          .insert({
            participant_id: participant.id,
            session_number: currentSession,
            big5_aspect: questionData.aspect,
            initial_question: questionData.question,
          })
          .select()
          .single();

        if (error) throw error;
        
        setSessionId(newSession.id);
        setMessages([{ role: "assistant", content: questionData.question }]);

        // Save initial question as message
        await supabase.from("chat_messages").insert({
          session_id: newSession.id,
          role: "assistant",
          content: questionData.question,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (retryMessage?: string) => {
    const messageToSend = retryMessage || input.trim();
    if (!messageToSend || !sessionId) return;

    if (!retryMessage) {
      setInput("");
      // Add user message to UI only if not a retry
      setMessages(prev => [...prev, { role: "user", content: messageToSend }]);
    }
    
    setLoading(true);
    setLastFailedMessage(null);

    try {
      // Save user message only if not a retry (already saved)
      if (!retryMessage) {
        await supabase.from("chat_messages").insert({
          session_id: sessionId,
          role: "user",
          content: messageToSend,
        });
      }

      // Call edge function for AI response
      const { data, error } = await supabase.functions.invoke("chat-conversation", {
        body: {
          sessionId,
          userMessage: messageToSend,
          sessionNumber: currentSession,
          big5Aspect: BIG5_QUESTIONS[currentSession - 1].aspect,
        },
      });

      if (error) throw error;

      // Add AI response to UI
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);

      // Save AI response
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: data.response,
      });

      // Check if conversation should end
      if (data.shouldEnd) {
        await supabase
          .from("chat_sessions")
          .update({ is_complete: true, completion_criteria_met: true, completed_at: new Date().toISOString() })
          .eq("id", sessionId);

        setIsConversationComplete(true);
        
        // Celebrate when last question is completed
        if (currentSession === 20) {
          triggerConfetti();
          toast({
            title: "🎉 All Conversations Complete!",
            description: "Amazing work! You've finished all 20 conversations. Ready for the questionnaire!",
          });
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setLastFailedMessage(messageToSend);
      toast({
        title: "Connection Issue",
        description: "The AI service is temporarily unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  const handleContinue = () => {
    if (currentSession < 20) {
      const nextSession = currentSession + 1;
      
      // Check if we hit a milestone (just completed session 5, 10, or 15)
      if (MILESTONE_MESSAGES[currentSession]) {
        const milestone = MILESTONE_MESSAGES[currentSession];
        triggerConfetti();
        toast({
          title: `🎉 ${milestone.title}`,
          description: milestone.message,
        });
      }
      
      setCurrentSession(nextSession);
      setMessages([]);
    } else {
      navigate("/transition");
    }
  };

  const handleSkip = async () => {
    if (!sessionId) return;

    try {
      // Mark as complete but completion_criteria_met remains false (tracks skip)
      await supabase
        .from("chat_sessions")
        .update({ 
          is_complete: true, 
          completion_criteria_met: false,
          completed_at: new Date().toISOString() 
        })
        .eq("id", sessionId);

      handleContinue();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRefreshSession = async () => {
    if (!sessionId) return;

    try {
      // Delete all messages for this session
      await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId);

      // Delete the session
      await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      // Reinitialize the session
      setMessages([]);
      setSessionId(null);
      setIsConversationComplete(false);
      await initializeSession();

      toast({
        title: "Session Refreshed",
        description: "Chat session has been reset",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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

  const progress = (currentSession / 20) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <ParticipantHeader />
        <div className="flex items-center gap-3">
          {currentSession > 1 && (
            <Button
              onClick={() => setCurrentSession(prev => Math.max(1, prev - 1))}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Progress value={progress} className="h-2 flex-1 bg-progress-track" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentSession} of 20
          </span>
          <div className="flex gap-2">
            {/* Skip button - available to all users after minimum messages */}
            {!isConversationComplete && (
              canSkip ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Skip
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Skip this conversation?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>You won't be able to return to this question later.</p>
                        <p className="text-destructive font-medium">
                          Skipping conversations may affect the accuracy of your personality assessment results.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continue Conversation</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSkip} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Skip Anyway
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" size="sm" disabled>
                        Skip
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send minimum of 2 messages to skip</p>
                  </TooltipContent>
                </Tooltip>
              )
            )}
            {/* Refresh button - admin only */}
            {isAdmin && (
              <Button onClick={handleRefreshSession} variant="ghost" size="sm" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Last question indicator */}
        {isLastQuestion && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 ring-2 ring-primary/50 rounded-lg animate-fade-in">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Final Question! You're almost done.</span>
          </div>
        )}

        <Card className="flex flex-col h-[65vh]">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {/* Question title at top of conversation */}
              <div className="flex justify-start">
                <div className={`max-w-[80%] rounded-lg p-4 ${isLastQuestion ? 'bg-primary/10 border border-primary/30' : 'bg-muted'}`}>
                  <p className="text-sm leading-relaxed font-medium">
                    {BIG5_QUESTIONS[currentSession - 1]?.question || `Conversation ${currentSession}`}
                  </p>
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
                  {isLastQuestion 
                    ? "🎉 Congratulations! You've completed all conversations!" 
                    : "This conversation is complete. Ready to continue?"}
                </p>
                <Button onClick={handleContinue} size="default" className={isLastQuestion ? 'bg-primary hover:bg-primary/90' : ''}>
                  {currentSession < 20 ? "Continue to Next Conversation" : "Proceed to Questionnaire"}
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
                  {canSkip && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline">Skip Question</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Skip this conversation?</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>You won't be able to return to this question later.</p>
                            <p className="text-destructive font-medium">
                              Skipping conversations may affect the accuracy of your personality assessment results.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleSkip} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Skip Anyway
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
};

export default Chat;
