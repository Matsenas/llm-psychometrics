import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CartesianGrid,
  Label as AxisLabel,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ATTACHMENT_CUTOFF, classifyAttachment, getAttachmentStyleInfo } from "@/lib/attachmentClassification";
import type { AttachmentStyle } from "@/lib/attachmentClassification";

interface Scores {
  anxiety: number;
  avoidance: number;
}

interface Props {
  chatScores: Scores | null;
  selfScores: Scores | null;
}

interface PointDatum {
  x: number; // anxiety
  y: number; // avoidance
  label: string;
  method: "chat" | "self";
}

const CHAT_COLOR = "hsl(var(--primary))";
const SELF_COLOR = "hsl(45 93% 47%)";

const QUADRANTS: Array<{
  style: AttachmentStyle;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
}> = [
  { style: "secure", x1: 1, x2: ATTACHMENT_CUTOFF, y1: 1, y2: ATTACHMENT_CUTOFF, fill: "hsl(142 70% 88%)" },
  {
    style: "anxious_preoccupied",
    x1: ATTACHMENT_CUTOFF,
    x2: 7,
    y1: 1,
    y2: ATTACHMENT_CUTOFF,
    fill: "hsl(25 90% 90%)",
  },
  {
    style: "dismissive_avoidant",
    x1: 1,
    x2: ATTACHMENT_CUTOFF,
    y1: ATTACHMENT_CUTOFF,
    y2: 7,
    fill: "hsl(210 80% 90%)",
  },
  {
    style: "fearful_avoidant",
    x1: ATTACHMENT_CUTOFF,
    x2: 7,
    y1: ATTACHMENT_CUTOFF,
    y2: 7,
    fill: "hsl(0 80% 90%)",
  },
];

function scoreToPercent(score: number): number {
  // ECR scale 1..7 → 0..100
  return ((score - 1) / 6) * 100;
}

const AttachmentQuadrantOverview = ({ chatScores, selfScores }: Props) => {
  const hasAny = chatScores || selfScores;

  const chatPoint: PointDatum[] = chatScores
    ? [{ x: chatScores.anxiety, y: chatScores.avoidance, label: "Chat", method: "chat" }]
    : [];
  const selfPoint: PointDatum[] = selfScores
    ? [{ x: selfScores.anxiety, y: selfScores.avoidance, label: "Self", method: "self" }]
    : [];

  const chatStyle = chatScores ? classifyAttachment(chatScores) : null;
  const selfStyle = selfScores ? classifyAttachment(selfScores) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachment Overview</CardTitle>
        <CardDescription>
          {hasAny
            ? `Anxiety (horizontal) × Avoidance (vertical). Midpoint cutoff at ${ATTACHMENT_CUTOFF}. Chat (blue) vs ECR-R self-report (gold).`
            : "No assessment data available yet."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Complete the chat and the questionnaire to see your attachment overview.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  {QUADRANTS.map((q) => (
                    <ReferenceArea
                      key={q.style}
                      x1={q.x1}
                      x2={q.x2}
                      y1={q.y1}
                      y2={q.y2}
                      fill={q.fill}
                      fillOpacity={0.4}
                      stroke="none"
                    />
                  ))}
                  <ReferenceLine x={ATTACHMENT_CUTOFF} stroke="hsl(var(--foreground))" strokeOpacity={0.3} />
                  <ReferenceLine y={ATTACHMENT_CUTOFF} stroke="hsl(var(--foreground))" strokeOpacity={0.3} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[1, 7]}
                    ticks={[1, 2, 3, 4, 5, 6, 7]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  >
                    <AxisLabel value="Anxiety" position="insideBottom" offset={-15} fill="hsl(var(--foreground))" />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[1, 7]}
                    ticks={[1, 2, 3, 4, 5, 6, 7]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  >
                    <AxisLabel
                      value="Avoidance"
                      angle={-90}
                      position="insideLeft"
                      offset={-10}
                      fill="hsl(var(--foreground))"
                    />
                  </YAxis>
                  <ZAxis range={[140, 140]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(value: number, name) => [value.toFixed(2), name]}
                    labelFormatter={() => ""}
                  />
                  {chatScores && (
                    <Scatter name="Chat" data={chatPoint} fill={CHAT_COLOR} shape="circle" />
                  )}
                  {selfScores && (
                    <Scatter name="Self" data={selfPoint} fill={SELF_COLOR} shape="triangle" />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {chatScores && chatStyle && (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHAT_COLOR }} />
                      <span className="text-sm font-medium">Chat Assessment</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {getAttachmentStyleInfo(chatStyle).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Anxiety</span>
                        <span className="font-medium">{chatScores.anxiety.toFixed(2)}</span>
                      </div>
                      <Progress value={scoreToPercent(chatScores.anxiety)} className="h-2 mt-1 bg-progress-track" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Avoidance</span>
                        <span className="font-medium">{chatScores.avoidance.toFixed(2)}</span>
                      </div>
                      <Progress value={scoreToPercent(chatScores.avoidance)} className="h-2 mt-1 bg-progress-track" />
                    </div>
                  </div>
                </div>
              )}

              {selfScores && selfStyle && (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SELF_COLOR }} />
                      <span className="text-sm font-medium">ECR-R Self-Report</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {getAttachmentStyleInfo(selfStyle).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Anxiety</span>
                        <span className="font-medium">{selfScores.anxiety.toFixed(2)}</span>
                      </div>
                      <Progress value={scoreToPercent(selfScores.anxiety)} className="h-2 mt-1 bg-progress-track" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Avoidance</span>
                        <span className="font-medium">{selfScores.avoidance.toFixed(2)}</span>
                      </div>
                      <Progress value={scoreToPercent(selfScores.avoidance)} className="h-2 mt-1 bg-progress-track" />
                    </div>
                  </div>
                </div>
              )}

              {(chatStyle || selfStyle) && (
                <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-2">
                  {(() => {
                    const primary = selfStyle ?? chatStyle!;
                    const info = getAttachmentStyleInfo(primary);
                    return (
                      <>
                        <p className="font-medium">{info.label}</p>
                        <p className="text-muted-foreground">{info.longDescription}</p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttachmentQuadrantOverview;
