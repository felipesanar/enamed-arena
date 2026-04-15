/**
 * Premium "Prova Revisada" PDF template using @react-pdf/renderer.
 * Renders a full exam review with cover page, questions, and analysis.
 */
import React from 'react';
import {
  Document, Page, Text, View, Image, Font, Svg, Defs,
  LinearGradient, Stop, Rect,
} from '@react-pdf/renderer';
import { StyleSheet } from '@react-pdf/renderer';
import type { Question } from '@/types';
import type { PerformanceBreakdown, QuestionResult } from '@/lib/resultHelpers';
import type { ExamState } from '@/types/exam';

// ─── Font Registration ───
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2', fontWeight: 700 },
  ],
});

Font.register({
  family: 'PlusJakarta',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2', fontWeight: 700 },
  ],
});

// ─── Colors ───
const C = {
  wineDark: '#421424',
  wine: '#7a1a32',
  wineLight: '#ffcbd8',
  wineMuted: '#9c4058',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  greenBg: '#F0FDF4',
  greenBorder: '#22C55E',
  greenDark: '#166534',
  redBg: '#FFF1F2',
  redBorder: '#F43F5E',
  redDark: '#991B1B',
  amberBg: '#FFFBEB',
  amberBorder: '#F59E0B',
  amberDark: '#92400E',
  explBg: '#F5F0F8',
  explBorder: '#C8B4DC',
};

function scoreColor(score: number): string {
  if (score >= 70) return C.greenDark;
  if (score >= 50) return C.amberDark;
  return C.redDark;
}

function scoreBg(score: number): string {
  if (score >= 70) return C.greenBg;
  if (score >= 50) return C.amberBg;
  return C.redBg;
}

// ─── Styles ───
const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: C.gray800, paddingTop: 40, paddingBottom: 50, paddingHorizontal: 36 },
  // Cover
  coverPage: { fontFamily: 'Inter', padding: 0 },
  coverBg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  coverContent: { paddingHorizontal: 48, paddingTop: 72, flex: 1, justifyContent: 'space-between', paddingBottom: 30 },
  coverTitle: { fontFamily: 'PlusJakarta', fontSize: 28, fontWeight: 700, color: C.white, marginBottom: 4 },
  coverSubtitle: { fontSize: 12, color: C.wineLight, marginBottom: 24 },
  coverCard: { backgroundColor: C.white, borderRadius: 12, padding: 24, marginBottom: 20 },
  coverName: { fontFamily: 'PlusJakarta', fontSize: 14, fontWeight: 600, color: C.gray800, textAlign: 'center', marginBottom: 10 },
  coverScore: { fontFamily: 'PlusJakarta', fontSize: 36, fontWeight: 700, color: C.wine, textAlign: 'center' },
  coverScoreSub: { fontSize: 9, color: C.gray500, textAlign: 'center', marginTop: 2 },
  coverStatsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  coverStat: { flex: 1, backgroundColor: C.gray50, borderRadius: 8, padding: 10, alignItems: 'center' },
  coverStatValue: { fontFamily: 'PlusJakarta', fontSize: 18, fontWeight: 700 },
  coverStatLabel: { fontSize: 7, color: C.gray500, marginTop: 2 },
  // Area bars on cover
  coverAreaTitle: { fontFamily: 'PlusJakarta', fontSize: 10, fontWeight: 600, color: C.wineLight, marginBottom: 8 },
  areaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  areaName: { fontSize: 7, color: C.wineLight, width: 120 },
  areaBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
  areaBarFill: { height: 5, borderRadius: 3 },
  areaScore: { fontSize: 7, fontWeight: 600, width: 28, textAlign: 'right' },
  // Footer
  footer: { position: 'absolute', bottom: 16, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.gray500 },
  // Question blocks
  qHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.gray50, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8, borderWidth: 0.5, borderColor: C.gray200 },
  qNumber: { fontFamily: 'PlusJakarta', fontSize: 11, fontWeight: 700, color: C.gray800 },
  qMeta: { fontSize: 7, color: C.gray500 },
  qBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, fontSize: 6, fontWeight: 700 },
  qText: { fontSize: 9, lineHeight: 1.5, color: C.gray700, marginBottom: 8 },
  qImage: { alignSelf: 'center', marginBottom: 8, borderRadius: 4 },
  // Options
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 6, borderWidth: 0.8, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 4, gap: 8 },
  optionCircle: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  optionLabel: { fontSize: 8, fontWeight: 700, color: C.white },
  optionText: { fontSize: 8.5, color: C.gray700, flex: 1, lineHeight: 1.4, marginTop: 2 },
  optionIcon: { fontSize: 10, fontWeight: 700, marginTop: 1 },
  // Explanation
  explBox: { backgroundColor: C.explBg, borderWidth: 0.8, borderColor: C.explBorder, borderRadius: 8, padding: 12, marginTop: 8 },
  explTitle: { fontFamily: 'PlusJakarta', fontSize: 8.5, fontWeight: 600, color: C.wine, marginBottom: 4 },
  explText: { fontSize: 8, lineHeight: 1.5, color: C.gray700 },
  // Analysis page
  analysisStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  analysisStat: { flex: 1, backgroundColor: C.gray50, borderRadius: 8, borderWidth: 0.5, borderColor: C.gray200, padding: 12, alignItems: 'center' },
  analysisStatValue: { fontFamily: 'PlusJakarta', fontSize: 20, fontWeight: 700 },
  analysisStatLabel: { fontSize: 7, color: C.gray500, marginTop: 2 },
  analysisAreaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  analysisAreaName: { fontSize: 8, color: C.gray700, width: 130 },
  analysisBarBg: { flex: 1, height: 8, backgroundColor: C.gray100, borderRadius: 4 },
  analysisBarFill: { height: 8, borderRadius: 4 },
  analysisAreaScore: { fontSize: 8, fontWeight: 600, width: 60, textAlign: 'right' },
  sectionTitle: { fontFamily: 'PlusJakarta', fontSize: 13, fontWeight: 700, color: C.gray800, marginBottom: 12 },
});

// ─── Types ───
export interface ProvaRevisadaDocProps {
  simuladoTitle: string;
  studentName: string;
  questions: Question[];
  examState: ExamState;
  breakdown: PerformanceBreakdown;
  imageMap: Map<string, string>;
}

// ─── Cover Page ───
function CoverPage({ simuladoTitle, studentName, overall, byArea }: {
  simuladoTitle: string;
  studentName: string;
  overall: PerformanceBreakdown['overall'];
  byArea: PerformanceBreakdown['byArea'];
}) {
  const stats = [
    { label: 'Acertos', value: overall.totalCorrect, color: C.greenDark },
    { label: 'Erros', value: overall.totalIncorrect, color: C.redDark },
    { label: 'Em branco', value: overall.totalUnanswered, color: C.amberDark },
  ];

  return (
    <Page size="A4" style={s.coverPage}>
      <Svg style={s.coverBg} viewBox="0 0 595 842">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="595" y2="842">
            <Stop offset="0%" stopColor="#2a0c17" />
            <Stop offset="50%" stopColor={C.wineDark} />
            <Stop offset="100%" stopColor="#5c1a2e" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="595" height="842" fill="url(#bg)" />
      </Svg>

      <View style={s.coverContent}>
        <View>
          <Text style={s.coverTitle}>Prova Revisada</Text>
          <Text style={s.coverSubtitle}>{simuladoTitle}</Text>

          <View style={s.coverCard}>
            <Text style={s.coverName}>{studentName || 'Aluno'}</Text>
            <Text style={s.coverScore}>{overall.percentageScore}%</Text>
            <Text style={s.coverScoreSub}>
              {overall.totalCorrect} de {overall.totalQuestions} questões corretas
            </Text>
            <View style={s.coverStatsRow}>
              {stats.map((st, i) => (
                <View key={i} style={s.coverStat}>
                  <Text style={[s.coverStatValue, { color: st.color }]}>{st.value}</Text>
                  <Text style={s.coverStatLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View>
          <Text style={s.coverAreaTitle}>Desempenho por Especialidade</Text>
          {byArea.slice(0, 8).map((area, i) => (
            <View key={i} style={s.areaRow}>
              <Text style={s.areaName}>{area.area}</Text>
              <View style={s.areaBarBg}>
                <View style={[s.areaBarFill, {
                  width: `${Math.max(2, area.score)}%`,
                  backgroundColor: area.score >= 70 ? '#86efac' : area.score >= 50 ? '#fbbf24' : '#fca5a5',
                }]} />
              </View>
              <Text style={[s.areaScore, { color: area.score >= 70 ? '#86efac' : area.score >= 50 ? '#fbbf24' : '#fca5a5' }]}>
                {area.score}%
              </Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Gerado em {new Date().toLocaleDateString('pt-BR')} · ENAMED Arena
        </Text>
      </View>
    </Page>
  );
}

// ─── Question Page ───
function QuestionBlock({ question, result, answer, imageBase64 }: {
  question: Question;
  result: QuestionResult;
  answer?: { selectedOption?: string | null };
  imageBase64?: string;
}) {
  const getBadgeStyle = () => {
    if (result.isCorrect) return { backgroundColor: C.greenBg, color: C.greenDark, text: 'ACERTOU' };
    if (result.wasAnswered) return { backgroundColor: C.redBg, color: C.redDark, text: 'ERROU' };
    return { backgroundColor: C.amberBg, color: C.amberDark, text: 'EM BRANCO' };
  };
  const badge = getBadgeStyle();

  return (
    <View wrap={false}>
      {/* Header */}
      <View style={s.qHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.qNumber}>Questão {question.number}</Text>
          <Text style={s.qMeta}>{question.area} · {question.theme}</Text>
        </View>
        <Text style={[s.qBadge, { backgroundColor: badge.backgroundColor, color: badge.color }]}>
          {badge.text}
        </Text>
      </View>

      {/* Text */}
      <Text style={s.qText}>{question.text}</Text>

      {/* Image */}
      {imageBase64 && (
        <Image src={imageBase64} style={[s.qImage, { maxWidth: 340, maxHeight: 200 }]} />
      )}

      {/* Options */}
      {question.options.map(opt => {
        const isCorrect = opt.id === result.correctOptionId;
        const isUserSelection = opt.id === result.selectedOptionId;
        const isWrong = isUserSelection && !isCorrect;

        let borderColor = C.gray200;
        let bgColor = C.white;
        let circleBg = C.gray300;

        if (isCorrect) { borderColor = C.greenBorder; bgColor = C.greenBg; circleBg = C.greenDark; }
        else if (isWrong) { borderColor = C.redBorder; bgColor = C.redBg; circleBg = C.redDark; }

        return (
          <View key={opt.id} style={[s.optionRow, { borderColor, backgroundColor: bgColor }]}>
            <View style={[s.optionCircle, { backgroundColor: circleBg }]}>
              <Text style={s.optionLabel}>{opt.label}</Text>
            </View>
            <Text style={s.optionText}>{opt.text}</Text>
            {isCorrect && <Text style={[s.optionIcon, { color: C.greenDark }]}>✓</Text>}
            {isWrong && <Text style={[s.optionIcon, { color: C.redDark }]}>✗</Text>}
          </View>
        );
      })}

      {/* Explanation */}
      {question.explanation && (
        <View style={s.explBox}>
          <Text style={s.explTitle}>Comentário do Professor</Text>
          <Text style={s.explText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Analysis Page ───
function AnalysisPage({ overall, byArea }: {
  overall: PerformanceBreakdown['overall'];
  byArea: PerformanceBreakdown['byArea'];
}) {
  const stats = [
    { label: 'Total', value: overall.totalQuestions, color: C.gray800 },
    { label: 'Respondidas', value: overall.totalAnswered, color: C.gray800 },
    { label: 'Acertos', value: overall.totalCorrect, color: C.greenDark },
    { label: 'Erros', value: overall.totalIncorrect, color: C.redDark },
    { label: 'Em branco', value: overall.totalUnanswered, color: C.amberDark },
    { label: 'Score', value: `${overall.percentageScore}%`, color: C.wine },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>Análise Estatística</Text>
      <View style={s.analysisStatsRow}>
        {stats.map((st, i) => (
          <View key={i} style={s.analysisStat}>
            <Text style={[s.analysisStatValue, { color: st.color }]}>{st.value}</Text>
            <Text style={s.analysisStatLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.sectionTitle, { fontSize: 11, marginBottom: 10 }]}>Desempenho por Especialidade</Text>
      {byArea.map((area, i) => (
        <View key={i} style={s.analysisAreaRow}>
          <Text style={s.analysisAreaName}>{area.area}</Text>
          <View style={s.analysisBarBg}>
            <View style={[s.analysisBarFill, {
              width: `${Math.max(1, area.score)}%`,
              backgroundColor: scoreColor(area.score),
            }]} />
          </View>
          <Text style={[s.analysisAreaScore, { color: scoreColor(area.score) }]}>
            {area.correct}/{area.questions} ({area.score}%)
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Footer Component ───
function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>ENAMED Arena · {new Date().toLocaleDateString('pt-BR')}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

// ─── Main Document ───
export function ProvaRevisadaDocument({
  simuladoTitle, studentName, questions, examState, breakdown, imageMap,
}: ProvaRevisadaDocProps) {
  const { overall, byArea } = breakdown;

  return (
    <Document
      title={`Prova Revisada - ${simuladoTitle}`}
      author="ENAMED Arena"
      subject={`Revisão do simulado ${simuladoTitle}`}
    >
      <CoverPage
        simuladoTitle={simuladoTitle}
        studentName={studentName}
        overall={overall}
        byArea={byArea}
      />

      {/* Questions — each on its own page */}
      {questions.map((q, i) => {
        const result = overall.questionResults[i];
        if (!result) return null;
        const answer = examState.answers[q.id];

        return (
          <Page key={q.id} size="A4" style={s.page}>
            <QuestionBlock
              question={q}
              result={result}
              answer={answer}
              imageBase64={imageMap.get(q.id)}
            />
            <PageFooter />
          </Page>
        );
      })}

      {/* Analysis page */}
      <Page size="A4" style={s.page}>
        <AnalysisPage overall={overall} byArea={byArea} />
        <PageFooter />
      </Page>
    </Document>
  );
}
