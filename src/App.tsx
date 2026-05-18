import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ParticipantProvider } from "@/contexts/ParticipantContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Session from "./pages/Session";
import Consent from "./pages/Consent";
import Start from "./pages/Start";
import Chat from "./pages/Chat";
import Transition from "./pages/Transition";
import Questionnaire from "./pages/Questionnaire";
import FeedbackIntro from "./pages/FeedbackIntro";
import Accuracy from "./pages/Accuracy";
import AttachmentProfile from "./pages/AttachmentProfile";
import UsabilitySurvey from "./pages/UsabilitySurvey";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
import ParticipantDetails from "./pages/ParticipantDetails";
import NoStudy from "./pages/NoStudy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ParticipantProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/participant/:respondentId" element={<Session />} />
            <Route path="/no-study" element={<NoStudy />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/start" element={<Start />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/transition" element={<Transition />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/feedback-intro" element={<FeedbackIntro />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/attachment-profile" element={<AttachmentProfile />} />
            <Route path="/usability" element={<UsabilitySurvey />} />
            <Route path="/results" element={<Results />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/participants" element={<Admin />} />
            <Route path="/admin/studies" element={<Admin />} />
            <Route path="/admin/studies/:studySlug/versions/:versionId/blocks/:blockId" element={<Admin />} />
            <Route path="/admin/participant/:respondentId" element={<ParticipantDetails />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ParticipantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
