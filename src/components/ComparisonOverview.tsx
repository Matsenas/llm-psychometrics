import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";

const BIG5_DESCRIPTIONS = [
  {
    trait: "Openness",
    description: "Reflects imagination, creativity, and intellectual curiosity. High scorers are open to new experiences, ideas, and unconventional values. Low scorers prefer routine and familiar approaches."
  },
  {
    trait: "Conscientiousness",
    description: "Measures organization, responsibility, and self-discipline. High scorers are reliable, planned, and achievement-oriented. Low scorers tend to be spontaneous and flexible."
  },
  {
    trait: "Extraversion",
    description: "Indicates sociability, assertiveness, and energy level. High scorers are outgoing, talkative, and energized by social interaction. Low scorers (introverts) prefer solitude and quiet environments."
  },
  {
    trait: "Agreeableness",
    description: "Reflects compassion, cooperation, and trust in others. High scorers are empathetic, helpful, and value harmony. Low scorers are more skeptical and competitive."
  },
  {
    trait: "Neuroticism",
    description: "Measures emotional stability and stress reactivity. High scorers experience more anxiety, mood swings, and emotional distress. Low scorers are calm, resilient, and emotionally stable."
  }
];

interface ChatScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface IPIPScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface ComparisonOverviewProps {
  chatScores: ChatScores | null;
  ipipScores: IPIPScores | null;
}

const ComparisonOverview = ({ chatScores, ipipScores }: ComparisonOverviewProps) => {
  const [selectedTrait, setSelectedTrait] = useState<string>("Openness");

  const hasAnyData = chatScores || ipipScores;

  const chartData = [
    { trait: "Openness", Chat: chatScores?.openness ?? 0, IPIP: ipipScores?.openness ?? 0 },
    { trait: "Conscientiousness", Chat: chatScores?.conscientiousness ?? 0, IPIP: ipipScores?.conscientiousness ?? 0 },
    { trait: "Extraversion", Chat: chatScores?.extraversion ?? 0, IPIP: ipipScores?.extraversion ?? 0 },
    { trait: "Agreeableness", Chat: chatScores?.agreeableness ?? 0, IPIP: ipipScores?.agreeableness ?? 0 },
    { trait: "Neuroticism", Chat: chatScores?.neuroticism ?? 0, IPIP: ipipScores?.neuroticism ?? 0 },
  ];

  const getTraitScores = (trait: string) => {
    const key = trait.toLowerCase() as keyof ChatScores;
    return {
      chat: chatScores?.[key] ?? null,
      ipip: ipipScores?.[key] ?? null,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparison Overview</CardTitle>
        <CardDescription>
          {hasAnyData 
            ? "Click on any trait to see detailed results. Chat (blue) vs IPIP (gold)."
            : "No assessment data available yet."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Complete at least one assessment to see comparison data.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Radar Chart */}
              <div>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={chartData} outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="trait" 
                      tick={({ x, y, payload, cx, cy }) => {
                        const isSelected = payload.value === selectedTrait;
                        const dx = x - cx;
                        const dy = y - cy;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const offset = 18;
                        const newX = x + (dx / distance) * offset;
                        const newY = y + (dy / distance) * offset;
                        return (
                          <text
                            x={newX}
                            y={newY}
                            fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                            fontSize={12}
                            fontWeight={isSelected ? 600 : 400}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ cursor: "pointer" }}
                            onClick={() => setSelectedTrait(payload.value)}
                          >
                            {payload.value}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    {chatScores && (
                      <Radar 
                        name="Chat Assessment" 
                        dataKey="Chat" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    )}
                    {ipipScores && (
                      <Radar 
                        name="IPIP Assessment" 
                        dataKey="IPIP" 
                        stroke="hsl(45 93% 47%)" 
                        fill="hsl(45 93% 47%)" 
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    )}
                    <Legend 
                      wrapperStyle={{ paddingTop: "10px" }}
                      iconType="line"
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Right: Selected Trait Details */}
              <div className="space-y-4">
                {(() => {
                  const description = BIG5_DESCRIPTIONS.find(d => d.trait === selectedTrait)?.description;
                  const { chat: chatScore, ipip: ipipScore } = getTraitScores(selectedTrait);
                  
                  return (
                    <>
                      <div>
                        <h3 className="text-xl font-medium mb-2">{selectedTrait}</h3>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                      
                      <div className="space-y-4 pt-2">
                        <div className="p-4 rounded-lg border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-primary">Chat Assessment</span>
                            <span className="text-2xl font-medium text-primary">
                              {chatScore !== null ? Math.round(chatScore) : "—"}
                            </span>
                          </div>
                          <Progress 
                            value={chatScore ?? 0} 
                            className="h-2 bg-muted [&>div]:bg-primary" 
                          />
                        </div>
                        
                        <div className="p-4 rounded-lg border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-[hsl(45,93%,47%)]">IPIP Assessment</span>
                            <span className="text-2xl font-medium text-[hsl(45,93%,47%)]">
                              {ipipScore !== null ? Math.round(ipipScore) : "—"}
                            </span>
                          </div>
                          <Progress 
                            value={ipipScore ?? 0} 
                            className="h-2 bg-muted [&>div]:bg-[hsl(45,93%,47%)]" 
                          />
                        </div>
                        
                        {chatScore !== null && ipipScore !== null && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Difference</span>
                              <span className={`text-lg font-medium ${
                                Math.abs(chatScore - ipipScore) > 15 ? "text-destructive" : "text-muted-foreground"
                              }`}>
                                {chatScore > ipipScore ? "+" : ""}{Math.round(chatScore - ipipScore)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            {/* Trait selector buttons */}
            <div className="flex flex-wrap gap-2 justify-center pt-4 border-t mt-6">
              {BIG5_DESCRIPTIONS.map((item) => (
                <button
                  key={item.trait}
                  onClick={() => setSelectedTrait(item.trait)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedTrait === item.trait
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {item.trait}
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export { ComparisonOverview, BIG5_DESCRIPTIONS };
export default ComparisonOverview;
