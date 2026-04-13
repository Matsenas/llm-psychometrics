import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ParticipantProvider } from "@/contexts/ParticipantContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Session from "./pages/Session";
import Consent from "./pages/Consent";
import Start from "./pages/Start";
import Chat from "./pages/Chat";
import Transition from "./pages/Transition";
import Questionnaire from "./pages/Questionnaire";
import FeedbackIntro from "./pages/FeedbackIntro";
import Accuracy from "./pages/Accuracy";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
import ParticipantDetails from "./pages/ParticipantDetails";
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
            <Route path="/participant/:respondentId" element={<Session />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/start" element={<Start />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/transition" element={<Transition />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/feedback-intro" element={<FeedbackIntro />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/results" element={<Results />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/participant/:respondentId" element={<ParticipantDetails />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ParticipantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
