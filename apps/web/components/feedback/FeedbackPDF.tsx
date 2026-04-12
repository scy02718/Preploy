import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

interface AnswerAnalysis {
  question: string;
  answer_summary: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

interface TimelineEvent {
  timestamp_ms: number;
  event_type: "speech" | "code_change";
  summary: string;
}

interface FeedbackPDFProps {
  feedback: {
    overallScore: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    answerAnalyses: AnswerAnalysis[];
    codeQualityScore?: number;
    explanationQualityScore?: number;
    timelineAnalysis?: TimelineEvent[];
  };
  sessionType: "behavioral" | "technical";
  date: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 8, color: "#111" },
  scoreRow: { flexDirection: "row", gap: 20, marginBottom: 16 },
  scoreBox: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 6, padding: 12, alignItems: "center" },
  scoreValue: { fontSize: 24, fontWeight: "bold" },
  scoreLabel: { fontSize: 9, color: "#666", marginTop: 4 },
  summaryText: { fontSize: 11, lineHeight: 1.6, color: "#333", marginBottom: 12 },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  listItem: { flexDirection: "row", gap: 6, marginBottom: 4 },
  bullet: { color: "#666" },
  listText: { flex: 1, lineHeight: 1.5 },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 6, padding: 10, marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cardQuestion: { fontWeight: "bold", fontSize: 10, flex: 1 },
  cardScore: { fontSize: 10, fontWeight: "bold", color: "#666" },
  cardText: { fontSize: 9, color: "#444", lineHeight: 1.5, marginBottom: 4 },
  suggestion: { fontSize: 9, color: "#555", marginLeft: 8 },
  timelineItem: { flexDirection: "row", gap: 8, marginBottom: 4 },
  timelineTime: { width: 35, fontSize: 9, color: "#888", fontFamily: "Courier" },
  timelineIcon: { fontSize: 9 },
  timelineSummary: { flex: 1, fontSize: 9, color: "#444" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#aaa" },
});

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getScoreColor(score: number): string {
  if (score >= 9) return "#2563eb";
  if (score >= 7) return "#16a34a";
  if (score >= 4) return "#ca8a04";
  return "#dc2626";
}

export function FeedbackPDF({ feedback, sessionType, date }: FeedbackPDFProps) {
  const isTechnical = sessionType === "technical";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Preploy — Feedback Report</Text>
          <Text style={styles.subtitle}>
            {isTechnical ? "Technical" : "Behavioral"} Interview | {date}
          </Text>
        </View>

        {/* Scores */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { color: getScoreColor(feedback.overallScore) }]}>
              {feedback.overallScore.toFixed(1)}
            </Text>
            <Text style={styles.scoreLabel}>Overall Score</Text>
          </View>
          {isTechnical && feedback.codeQualityScore != null && (
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, { color: getScoreColor(feedback.codeQualityScore) }]}>
                {feedback.codeQualityScore.toFixed(1)}
              </Text>
              <Text style={styles.scoreLabel}>Code Quality</Text>
            </View>
          )}
          {isTechnical && feedback.explanationQualityScore != null && (
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, { color: getScoreColor(feedback.explanationQualityScore) }]}>
                {feedback.explanationQualityScore.toFixed(1)}
              </Text>
              <Text style={styles.scoreLabel}>Explanation Quality</Text>
            </View>
          )}
        </View>

        {/* Summary */}
        <Text style={styles.summaryText}>{feedback.summary}</Text>

        {/* Strengths & Weaknesses */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Strengths</Text>
            {feedback.strengths.map((s, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.bullet, { color: "#16a34a" }]}>+</Text>
                <Text style={styles.listText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Areas for Improvement</Text>
            {feedback.weaknesses.map((w, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.bullet, { color: "#ca8a04" }]}>!</Text>
                <Text style={styles.listText}>{w}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Answer Breakdown */}
        {feedback.answerAnalyses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isTechnical ? "Performance Analysis" : "Per-Answer Breakdown"}
            </Text>
            {feedback.answerAnalyses.map((a, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardQuestion}>{a.question}</Text>
                  <Text style={[styles.cardScore, { color: getScoreColor(a.score) }]}>
                    {a.score.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.cardText}>{a.answer_summary}</Text>
                <Text style={styles.cardText}>{a.feedback}</Text>
                {a.suggestions.map((s, j) => (
                  <Text key={j} style={styles.suggestion}>→ {s}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Timeline (technical only) */}
        {isTechnical && feedback.timelineAnalysis && feedback.timelineAnalysis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Timeline</Text>
            {feedback.timelineAnalysis.map((event, i) => (
              <View key={i} style={styles.timelineItem}>
                <Text style={styles.timelineTime}>{formatTime(event.timestamp_ms)}</Text>
                <Text style={styles.timelineIcon}>
                  {event.event_type === "speech" ? "S" : "C"}
                </Text>
                <Text style={styles.timelineSummary}>{event.summary}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by Preploy | {date}
        </Text>
      </Page>
    </Document>
  );
}
