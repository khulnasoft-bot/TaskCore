import React, { useState } from "react";
import { Loader2, Send, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "../lib/utils";
import { api } from "../api/client";

interface Recommendation {
  suggestedProjectName: string;
  suggestedTaskTitle: string;
  suggestedTaskDescription: string;
  followUpQuestions: string[];
}

interface OnboardingInterviewProps {
  initialMission: string;
  onConfirm: (recommendation: Recommendation) => void;
}

export const OnboardingInterview: React.FC<OnboardingInterviewProps> = ({
  initialMission,
  onConfirm
}) => {
  const [mission, setMission] = useState(initialMission);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const handleGenerate = async () => {
    if (!mission.trim()) return;
    setLoading(true);
    try {
      const resp = await api.post<Recommendation>("/onboarding/recommendation", { mission });
      setRecommendation(resp);
    } catch (err) {
      console.error("Failed to get recommendation", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          Refine your mission
        </label>
        <div className="relative">
          <Textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="What do you want to achieve with TaskCore?"
            className="min-h-[100px] pr-12 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 transition-all"
          />
          <Button
            size="icon"
            onClick={handleGenerate}
            disabled={loading || !mission.trim()}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {recommendation && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              AI Recommendation
            </h4>
            
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Suggested Project</div>
              <div className="text-sm font-semibold text-slate-800">{recommendation.suggestedProjectName}</div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">First Task</div>
              <div className="text-sm font-semibold text-slate-800">{recommendation.suggestedTaskTitle}</div>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                {recommendation.suggestedTaskDescription}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Thinking deeper...</h5>
            <div className="grid gap-2">
              {recommendation.followUpQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setMission(prev => prev + " " + q)}
                  className="text-left p-3 text-xs text-slate-600 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xl shadow-slate-900/10 transition-all"
            onClick={() => onConfirm(recommendation)}
          >
            Accept and continue
          </Button>
        </div>
      )}
    </div>
  );
};
