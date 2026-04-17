import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Types (mirror the interfaces in apps/web/app/star/page.tsx)
// ---------------------------------------------------------------------------

export interface StarStoryForPDF {
  id: string;
  title: string;
  role: string;
  expectedQuestions: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  createdAt: string;
}

export interface StarAnalysisForPDF {
  id: string;
  storyId: string;
  scores: {
    persuasiveness_score: number;
    persuasiveness_justification: string;
    star_alignment_score: number;
    star_breakdown: {
      situation: number;
      task: number;
      action: number;
      result: number;
    };
    role_fit_score: number;
    role_fit_justification: string;
    question_fit_score: number;
    question_fit_justification: string;
  };
  suggestions: string[];
  model: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Local score-color helper (verbatim from FeedbackPDF.tsx).
// Scores here are 0–100 so divide by 10 before colour-bucketing.
// ---------------------------------------------------------------------------

function getScoreColor(score0to100: number): string {
  const s = score0to100 / 10;
  if (s >= 9) return "#2563eb";
  if (s >= 7) return "#16a34a";
  if (s >= 4) return "#ca8a04";
  return "#dc2626";
}

// ---------------------------------------------------------------------------
// Styles (mirror FeedbackPDF.tsx visual language)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 12,
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4, color: "#111" },
  headerSub: { fontSize: 9, color: "#666" },
  storyTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4, color: "#111" },
  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionBody: { fontSize: 10, lineHeight: 1.6, color: "#333" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginBottom: 10, marginTop: 4 },
  questionBullet: { flexDirection: "row", gap: 6, marginBottom: 3 },
  bulletDot: { color: "#666", fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5, color: "#333" },
  analysisBlock: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 12,
  },
  analysisTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8, color: "#111" },
  scoreRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  scoreBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  scoreValue: { fontSize: 18, fontWeight: "bold" },
  scoreLabel: { fontSize: 8, color: "#666", marginTop: 3, textAlign: "center" },
  breakdownRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  breakdownBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  breakdownValue: { fontSize: 14, fontWeight: "bold" },
  breakdownLabel: { fontSize: 7, color: "#888", marginTop: 2 },
  justRow: { marginBottom: 8 },
  justLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  justText: { fontSize: 9, color: "#444", lineHeight: 1.5 },
  suggestionItem: { flexDirection: "row", gap: 6, marginBottom: 3 },
  suggestionNum: { fontSize: 9, color: "#888", width: 14 },
  suggestionText: { flex: 1, fontSize: 9, color: "#555", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#aaa",
  },
});

// ---------------------------------------------------------------------------
// Single-story page renderer (reused in both exports)
// ---------------------------------------------------------------------------

function StarStoryPage({
  story,
  analyses,
  date,
}: {
  story: StarStoryForPDF;
  analyses: StarAnalysisForPDF[];
  date: string;
}) {
  const latestAnalysis = analyses.length > 0 ? analyses[0] : null;

  return (
    <Page size="A4" style={styles.page}>
      {/* Header band */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Preploy — STAR Story</Text>
        <Text style={styles.headerSub}>
          {story.role} | Generated {date}
        </Text>
      </View>

      {/* Story title */}
      <View style={styles.section}>
        <Text style={styles.storyTitle}>{story.title}</Text>
      </View>

      {/* Expected Questions */}
      {story.expectedQuestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Expected Questions</Text>
          <View style={styles.divider} />
          {story.expectedQuestions.map((q, i) => (
            <View key={i} style={styles.questionBullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{q}</Text>
            </View>
          ))}
        </View>
      )}

      {/* S/T/A/R blocks */}
      {(
        [
          ["SITUATION", story.situation],
          ["TASK", story.task],
          ["ACTION", story.action],
          ["RESULT", story.result],
        ] as const
      ).map(([label, body]) => (
        <View key={label} style={styles.section}>
          <Text style={styles.sectionLabel}>{label}</Text>
          <View style={styles.divider} />
          <Text style={styles.sectionBody}>{body}</Text>
        </View>
      ))}

      {/* Latest Analysis */}
      {latestAnalysis && (
        <View style={styles.analysisBlock}>
          <Text style={styles.analysisTitle}>Latest Analysis</Text>

          {/* Main score boxes */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getScoreColor(latestAnalysis.scores.persuasiveness_score) },
                ]}
              >
                {Math.round(latestAnalysis.scores.persuasiveness_score)}
              </Text>
              <Text style={styles.scoreLabel}>Persuasiveness</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getScoreColor(latestAnalysis.scores.star_alignment_score) },
                ]}
              >
                {Math.round(latestAnalysis.scores.star_alignment_score)}
              </Text>
              <Text style={styles.scoreLabel}>STAR Alignment</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getScoreColor(latestAnalysis.scores.role_fit_score) },
                ]}
              >
                {Math.round(latestAnalysis.scores.role_fit_score)}
              </Text>
              <Text style={styles.scoreLabel}>Role Fit</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getScoreColor(latestAnalysis.scores.question_fit_score) },
                ]}
              >
                {Math.round(latestAnalysis.scores.question_fit_score)}
              </Text>
              <Text style={styles.scoreLabel}>Question Fit</Text>
            </View>
          </View>

          {/* STAR breakdown sub-row */}
          <View style={styles.breakdownRow}>
            {(
              [
                ["S", latestAnalysis.scores.star_breakdown.situation],
                ["T", latestAnalysis.scores.star_breakdown.task],
                ["A", latestAnalysis.scores.star_breakdown.action],
                ["R", latestAnalysis.scores.star_breakdown.result],
              ] as const
            ).map(([letter, score]) => (
              <View key={letter} style={styles.breakdownBox}>
                <Text
                  style={[
                    styles.breakdownValue,
                    { color: getScoreColor(score) },
                  ]}
                >
                  {Math.round(score)}
                </Text>
                <Text style={styles.breakdownLabel}>{letter}</Text>
              </View>
            ))}
          </View>

          {/* Justification blocks */}
          <View style={styles.justRow}>
            <Text style={styles.justLabel}>Persuasiveness</Text>
            <Text style={styles.justText}>
              {latestAnalysis.scores.persuasiveness_justification}
            </Text>
          </View>
          <View style={styles.justRow}>
            <Text style={styles.justLabel}>Role Fit</Text>
            <Text style={styles.justText}>
              {latestAnalysis.scores.role_fit_justification}
            </Text>
          </View>
          <View style={styles.justRow}>
            <Text style={styles.justLabel}>Question Fit</Text>
            <Text style={styles.justText}>
              {latestAnalysis.scores.question_fit_justification}
            </Text>
          </View>

          {/* Suggestions */}
          {latestAnalysis.suggestions.length > 0 && (
            <View>
              <Text style={[styles.justLabel, { marginTop: 6, marginBottom: 4 }]}>
                Suggestions
              </Text>
              {latestAnalysis.suggestions.map((s, i) => (
                <View key={i} style={styles.suggestionItem}>
                  <Text style={styles.suggestionNum}>{i + 1}.</Text>
                  <Text style={styles.suggestionText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <Text style={styles.footer}>Generated by Preploy | {date}</Text>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------

export interface StarStoryPDFProps {
  story: StarStoryForPDF;
  analyses: StarAnalysisForPDF[];
  date: string;
}

/** Single-story, single-page PDF document. */
export function StarStoryPDF({ story, analyses, date }: StarStoryPDFProps) {
  return (
    <Document>
      <StarStoryPage story={story} analyses={analyses} date={date} />
    </Document>
  );
}

export interface StarStoriesBundlePDFProps {
  stories: Array<{ story: StarStoryForPDF; analyses: StarAnalysisForPDF[] }>;
  date: string;
}

/** Multi-story PDF — one Page per story inside one Document. */
export function StarStoriesBundlePDF({
  stories,
  date,
}: StarStoriesBundlePDFProps) {
  return (
    <Document>
      {stories.map(({ story, analyses }) => (
        <StarStoryPage
          key={story.id}
          story={story}
          analyses={analyses}
          date={date}
        />
      ))}
    </Document>
  );
}
