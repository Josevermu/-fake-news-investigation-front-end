import { CommonModule } from '@angular/common';
import { Component, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminExportService } from '@services/admin/admin-export.service';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';

interface DashboardRow {
  participantId: string;
  alias: string;
  email: string;
  sex: string;
  age: string;
  region: string;
  feedbackTiming: string;
  presentationFormat: string;
  newsSet: string;
  completionTimeSeconds: string;
  registeredAt: string;
  questionCode: string;
  questionType: string;
  constructo: string;
  subCategory: string;
  subCategory2: string;
  itemText: string;
  correctAnswer: string;
  phase: string;
  category: string;
  novelty: string;
  score: string;
  questionOrder: string;
  answeredAt: string;
  answerType: string;
  isCorrect: string;
  sdtCategory: string;
}

interface BreakdownItem {
  label: string;
  count: number;
  participantCount: number;
  averageScore: number | null;
  accuracyRate: number | null;
  percent: number;
}

interface DistributionItem {
  label: string;
  count: number;
  percent: number;
}

interface SdtMetrics {
  group: string;
  phase: 'DETECCION' | 'MEMORIA';
  participantCount: number;

  hit: number;              // A
  falseAlarm: number;       // B
  miss: number;             // C
  correctResponse: number;  // D
  unsure: number;

  hitRate: number | null;
  falseAlarmRate: number | null;
  missRate: number | null;
  correctResponseRate: number | null;

  dPrime: number | null;
  criterionC: number | null;
}

interface ProfileConstructSexStat {
  sex: string;
  constructo: string;
  n: number;
  mean: number | null;
  standardDeviation: number | null;
  standardError: number | null;
}

interface ScaleHeatSegment {
  label: string;
  count: number;
  /** Real percentage of responses represented by this segment. */
  percent: number;
  /** CSS start position in a symmetric -100..0..+100 visual axis. */
  start: number;
  /** CSS width; half of the statistical percentage because the chart has two 100-point sides. */
  width: number;
  colorClass: string;
}

interface ScaleHeatRow {
  label: string;
  total: number;
  segments: ScaleHeatSegment[];
}

interface ParticipantSummary {
  participantId: string;
  alias: string;
  group: string;
  format: string;
  newsSet: string;
  responses: number;
  averageScore: number | null;
  medianScore: number | null;
  accuracyRate: number | null;
  completionTimeSeconds: number | null;
}

type LoadMode = 'login' | 'refresh';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, GlassCardComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly adminExportService = inject(AdminExportService);
  private readonly chartPalette = ['#ffb347', '#a855f7', '#2ecc71', '#4fa3ff', '#ff6b6b', '#00c2a8', '#ff8f70'];

  private authenticatedUsername = '';
  private authenticatedPassword = '';

  isLoading: WritableSignal<boolean> = signal(false);
  isRefreshing: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string> = signal('');
  refreshMessage: WritableSignal<string> = signal('');

  username = '';
  password = '';
  isAuthenticated = false;
  rows: DashboardRow[] = [];
  lastUpdatedAt: Date | null = null;

  selectedPhase = '';
  selectedQuestionType = '';
  selectedConstructo = '';
  selectedSex = '';
  selectedFormat = '';
  selectedNewsSet = '';
  selectedParticipantId = '';

  onLogin(): void {
    if (this.isLoading()) {
      return;
    }

    const username = this.username.trim();
    const password = this.password;

    if (!username || !password) {
      this.errorMessage.set('Debes ingresar usuario y contraseña.');
      return;
    }

    this.errorMessage.set('');
    this.refreshMessage.set('');
    this.isLoading.set(true);
    this.fetchDashboardData(username, password, 'login');
  }

  refreshData(): void {
    if (!this.isAuthenticated || this.isRefreshing()) {
      return;
    }

    if (!this.authenticatedUsername || !this.authenticatedPassword) {
      this.errorMessage.set('La sesión administrativa no tiene credenciales activas. Vuelve a iniciar sesión.');
      return;
    }

    this.errorMessage.set('');
    this.refreshMessage.set('');
    this.isRefreshing.set(true);
    this.fetchDashboardData(this.authenticatedUsername, this.authenticatedPassword, 'refresh');
  }

  logout(): void {
    this.authenticatedUsername = '';
    this.authenticatedPassword = '';
    this.password = '';
    this.isAuthenticated = false;
    this.rows = [];
    this.lastUpdatedAt = null;
    this.clearFilters();
    this.errorMessage.set('');
    this.refreshMessage.set('');
  }

  clearFilters(): void {
    this.selectedPhase = '';
    this.selectedQuestionType = '';
    this.selectedConstructo = '';
    this.selectedFormat = '';
    this.selectedNewsSet = '';
    this.selectedParticipantId = '';
    this.selectedSex = '';
  }

  get filteredRows(): DashboardRow[] {
    return this.rows.filter((row) => {
      return (
        (!this.selectedPhase || row.phase === this.selectedPhase) &&
        (!this.selectedQuestionType || row.questionType === this.selectedQuestionType) &&
        (!this.selectedConstructo || row.constructo === this.selectedConstructo) &&
        (!this.selectedSex || row.sex === this.selectedSex) &&
        (!this.selectedFormat || row.presentationFormat === this.selectedFormat) &&
        (!this.selectedNewsSet || row.newsSet === this.selectedNewsSet) &&
        (!this.selectedParticipantId || row.participantId === this.selectedParticipantId)
      );
    });
  }

  get sexOptions(): string[] {
  return this.uniqueValues(this.rows.map((row) => row.sex));
}

  /**
   * The current backend export contains completed experiments only.
   * Therefore this number is the number of completed participants represented
   * in the current filtered export, not the number of registered users.
   */
  get completedParticipantCount(): number {
    return this.uniqueParticipants(this.filteredRows).length;
  }

  get responseCount(): number {
    return this.filteredRows.filter((row) => this.hasResponse(row)).length;
  }

get averageScore(): number | null {
  return this.average(
    this.numericScores(
      this.filteredRows.filter(
        (row) => row.questionType.trim().toUpperCase() === 'PROFILE'
      )
    )
  );
}

  get subConstructBreakdown(): BreakdownItem[] {
    const profileRows = this.filteredRows.filter(
      (row) =>
        row.questionType.trim().toUpperCase() === 'PROFILE' &&
        row.constructo.trim() &&
        row.subCategory.trim()
    );

    return this.buildProfileParticipantBreakdown(
      profileRows,
      (row) => `${row.constructo.trim()} · ${row.subCategory.trim()}`
    )
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity))
      .slice(0, 12);
  }

  get subCategoryBreakdown(): BreakdownItem[] {
    const profileRows = this.filteredRows.filter(
      (row) =>
        row.questionType.trim().toUpperCase() === 'PROFILE' &&
        row.constructo.trim() &&
        row.subCategory.trim() &&
        row.subCategory2.trim()
    );

    return this.buildProfileParticipantBreakdown(
      profileRows,
      (row) =>
        `${row.constructo.trim()} · ${row.subCategory.trim()} · ${row.subCategory2.trim()}`
    )
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity))
      .slice(0, 12);
  }

get detectionScaleHeatByCategory(): ScaleHeatRow[] {
  return this.buildScaleHeatRows(
    this.getNewsRowsForPhase(this.filteredRows, 'DETECCION'),
    'DETECCION'
  );
}

get memoryScaleHeatByCategory(): ScaleHeatRow[] {
  return this.buildScaleHeatRows(
    this.getNewsRowsForPhase(this.filteredRows, 'MEMORIA'),
    'MEMORIA'
  );
}

get medianScore(): number | null {
  return this.median(
    this.numericScores(
      this.filteredRows.filter(
        (row) => row.questionType.trim().toUpperCase() === 'PROFILE'
      )
    )
  );
}

get standardDeviation(): number | null {
  return this.sampleStandardDeviation(
    this.numericScores(
      this.filteredRows.filter(
        (row) => row.questionType.trim().toUpperCase() === 'PROFILE'
      )
    )
  );
}

  get averageCompletionTimeSeconds(): number | null {
    const values = this.uniqueParticipants(this.filteredRows)
      .map((row) => this.toNumber(row.completionTimeSeconds))
      .filter((value): value is number => value !== null && value >= 0);

    return this.average(values);
  }

  get accuracyRate(): number | null {
    const evaluableRows = this.evaluableNewsRows(this.filteredRows);
    if (evaluableRows.length === 0) {
      return null;
    }

    const correct = evaluableRows.filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;
    return (correct / evaluableRows.length) * 100;
  }

  get correctNewsResponses(): number {
    return this.evaluableNewsRows(this.filteredRows).filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;
  }

  get incorrectNewsResponses(): number {
    return this.evaluableNewsRows(this.filteredRows).filter((row) => row.isCorrect.toUpperCase() === 'FALSE').length;
  }

  get phaseOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.phase));
  }

  get questionTypeOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.questionType));
  }

  get constructoOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.constructo));
  }

  get formatOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.presentationFormat));
  }

  get newsSetOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.newsSet));
  }

  get participantOptions(): string[] {
    return this.uniqueValues(this.rows.map((row) => row.participantId)).sort((a, b) => {
      const aNumber = Number(a);
      const bNumber = Number(b);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return a.localeCompare(b);
    });
  }

  get phaseBreakdown(): BreakdownItem[] {
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.phase, row })))
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity));
  }

  get formatBreakdown(): BreakdownItem[] {
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.presentationFormat, row })))
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity));
  }

  get newsSetBreakdown(): BreakdownItem[] {
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.newsSet, row })))
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity));
  }
  get constructoBreakdown(): BreakdownItem[] {
    const profileRows = this.filteredRows.filter(
      (row) =>
        row.questionType.trim().toUpperCase() === 'PROFILE' &&
        row.constructo.trim()
    );

    return this.buildProfileParticipantBreakdown(
      profileRows,
      (row) => row.constructo.trim()
    )
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity))
      .slice(0, 12);
  }

  /**
   * Legacy stacked SDT visual in the current HTML is labelled as MEMORIA,
   * therefore it must not aggregate DETECCION and MEMORIA together.
   */
  get sdtBreakdown(): DistributionItem[] {
    const grouped = new Map<string, number>();
    const memoryRows = this.getNewsRowsForPhase(this.filteredRows, 'MEMORIA');

    for (const row of memoryRows) {
      const normalized = this.normalizeSdtCategory(row.sdtCategory);
      if (!normalized) {
        continue;
      }

      grouped.set(normalized, (grouped.get(normalized) ?? 0) + 1);
    }

    const total = Array.from(grouped.values()).reduce((sum, count) => sum + count, 0);

    return Array.from(grouped.entries())
      .map(([label, count]) => ({
        label,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  get sexDistribution(): DistributionItem[] {
  const participants = this.uniqueParticipants(this.filteredRows);
  const grouped = new Map<string, number>();

  for (const participant of participants) {
    const sex = participant.sex.trim() || 'SIN_DATO';
    grouped.set(sex, (grouped.get(sex) ?? 0) + 1);
  }

  const total = participants.length;

  return Array.from(grouped.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

get profileConstructBySex(): ProfileConstructSexStat[] {
  const participantConstructs = new Map<
    string,
    {
      sex: string;
      constructo: string;
      scores: number[];
    }
  >();

  const profileRows = this.filteredRows.filter(
    (row) =>
      row.questionType.trim().toUpperCase() === 'PROFILE' &&
      row.participantId &&
      row.constructo
  );

  // Step 1:
  // Construct mean for EACH participant.
  for (const row of profileRows) {
    const score = this.toNumber(row.score);

    if (score === null || score < 0 || score > 100) {
      continue;
    }

    const sex = row.sex.trim() || 'SIN_DATO';
    const constructo = row.constructo.trim();

    const key = `${row.participantId}::${sex}::${constructo}`;

    const current = participantConstructs.get(key) ?? {
      sex,
      constructo,
      scores: [],
    };

    current.scores.push(score);
    participantConstructs.set(key, current);
  }

  // Step 2:
  // Group those participant means by Sex + Construct.
  const grouped = new Map<
    string,
    {
      sex: string;
      constructo: string;
      values: number[];
    }
  >();

  for (const participant of participantConstructs.values()) {
    const participantMean = this.average(participant.scores);

    if (participantMean === null) {
      continue;
    }

    const key = `${participant.sex}::${participant.constructo}`;

    const current = grouped.get(key) ?? {
      sex: participant.sex,
      constructo: participant.constructo,
      values: [],
    };

    current.values.push(participantMean);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const sd = this.sampleStandardDeviation(group.values);

      return {
        sex: group.sex,
        constructo: group.constructo,
        n: group.values.length,
        mean: this.average(group.values),
        standardDeviation: sd,
        standardError:
          sd !== null && group.values.length > 0
            ? sd / Math.sqrt(group.values.length)
            : null,
      };
    })
    .sort(
      (a, b) =>
        a.constructo.localeCompare(b.constructo, 'es') ||
        a.sex.localeCompare(b.sex, 'es')
    );
}

get detectionScaleDistribution(): DistributionItem[] {
  return this.buildScaleDistribution(
    this.getNewsRowsForPhase(
      this.filteredRows,
      'DETECCION'
    ),
    'DETECCION'
  );
}

get memoryScaleDistribution(): DistributionItem[] {
  return this.buildScaleDistribution(
    this.getNewsRowsForPhase(
      this.filteredRows,
      'MEMORIA'
    ),
    'MEMORIA'
  );
}

private buildScaleDistribution(
  rows: DashboardRow[],
  phase: 'DETECCION' | 'MEMORIA'
): DistributionItem[] {
  const labels =
    phase === 'DETECCION'
      ? [
          'Totalmente falsa',
          'Bastante falsa',
          'Poco falsa',
          'Incertidumbre',
          'Poco verdadera',
          'Bastante verdadera',
          'Totalmente verdadera',
        ]
      : [
          'Totalmente vieja',
          'Bastante vieja',
          'Poco vieja',
          'Incertidumbre',
          'Poco nueva',
          'Bastante nueva',
          'Totalmente nueva',
        ];

  const counts = new Map<string, number>(
    labels.map((label) => [label, 0])
  );

  for (const row of rows) {
    const score = this.toNumber(row.score);

    if (
      score === null ||
      score < -10 ||
      score > 10
    ) {
      continue;
    }

    const label =
      this.getScaleLabel(score, phase);

    if (label) {
      counts.set(
        label,
        (counts.get(label) ?? 0) + 1
      );
    }
  }

  const total = Array.from(counts.values())
    .reduce((sum, count) => sum + count, 0);

  return labels.map((label) => {
    const count = counts.get(label) ?? 0;

    return {
      label,
      count,
      percent:
        total > 0
          ? (count / total) * 100
          : 0,
    };
  });
}

private getScaleLabel(
  score: number,
  phase: 'DETECCION' | 'MEMORIA'
): string | null {
  const detection = phase === 'DETECCION';

  if (score <= -9) {
    return detection
      ? 'Totalmente falsa'
      : 'Totalmente vieja';
  }

  if (score <= -5) {
    return detection
      ? 'Bastante falsa'
      : 'Bastante vieja';
  }

  if (score <= -1) {
    return detection
      ? 'Poco falsa'
      : 'Poco vieja';
  }

  if (score === 0) {
    return 'Incertidumbre';
  }

  if (score <= 4) {
    return detection
      ? 'Poco verdadera'
      : 'Poco nueva';
  }

  if (score <= 8) {
    return detection
      ? 'Bastante verdadera'
      : 'Bastante nueva';
  }

  if (score <= 10) {
    return detection
      ? 'Totalmente verdadera'
      : 'Totalmente nueva';
  }

  return null;
}

  private buildScaleHeatRows(
    rows: DashboardRow[],
    phase: 'DETECCION' | 'MEMORIA'
  ): ScaleHeatRow[] {
    const grouped = new Map<string, DashboardRow[]>();

    for (const row of rows) {
      const label = row.category.trim() || 'SIN_CATEGORIA';
      const current = grouped.get(label) ?? [];
      current.push(row);
      grouped.set(label, current);
    }

    const bucketMeta =
      phase === 'DETECCION'
        ? [
            { label: 'Totalmente falsa', colorClass: 'scale-false-3', side: 'left' as const },
            { label: 'Bastante falsa', colorClass: 'scale-false-2', side: 'left' as const },
            { label: 'Poco falsa', colorClass: 'scale-false-1', side: 'left' as const },
            { label: 'Incertidumbre', colorClass: 'scale-neutral', side: 'center' as const },
            { label: 'Poco verdadera', colorClass: 'scale-true-1', side: 'right' as const },
            { label: 'Bastante verdadera', colorClass: 'scale-true-2', side: 'right' as const },
            { label: 'Totalmente verdadera', colorClass: 'scale-true-3', side: 'right' as const },
          ]
        : [
            { label: 'Totalmente vieja', colorClass: 'scale-false-3', side: 'left' as const },
            { label: 'Bastante vieja', colorClass: 'scale-false-2', side: 'left' as const },
            { label: 'Poco vieja', colorClass: 'scale-false-1', side: 'left' as const },
            { label: 'Incertidumbre', colorClass: 'scale-neutral', side: 'center' as const },
            { label: 'Poco nueva', colorClass: 'scale-true-1', side: 'right' as const },
            { label: 'Bastante nueva', colorClass: 'scale-true-2', side: 'right' as const },
            { label: 'Totalmente nueva', colorClass: 'scale-true-3', side: 'right' as const },
          ];

    return Array.from(grouped.entries())
      .map(([label, categoryRows]) => {
        const counts = new Map<string, number>(
          bucketMeta.map((item) => [item.label, 0])
        );

        for (const row of categoryRows) {
          const score = this.toNumber(row.score);

          if (score === null || score < -10 || score > 10) {
            continue;
          }

          const bucket = this.getScaleLabel(score, phase);

          if (bucket) {
            counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
          }
        }

        const total = Array.from(counts.values()).reduce(
          (sum, count) => sum + count,
          0
        );

        const leftBuckets = bucketMeta.filter((item) => item.side === 'left');
        const centerBucket = bucketMeta.find((item) => item.side === 'center');
        const rightBuckets = bucketMeta.filter((item) => item.side === 'right');

        if (!centerBucket) {
          return {
            label,
            total,
            segments: [],
          };
        }

        const percentOf = (bucketLabel: string): number => {
          const count = counts.get(bucketLabel) ?? 0;
          return total > 0 ? (count / total) * 100 : 0;
        };

        const leftTotal = leftBuckets.reduce(
          (sum, item) => sum + percentOf(item.label),
          0
        );
        const centerPercent = percentOf(centerBucket.label);

        const segments: ScaleHeatSegment[] = [];

        // CSS has a fixed zero line at 50%. Each half of the chart represents
        // 100 percentage points, so statistical percentages are divided by 2.
        const leftVisualWidth = leftTotal / 2;
        const centerVisualWidth = centerPercent / 2;

        let currentLeftStart =
          50 - centerVisualWidth / 2 - leftVisualWidth;

        for (const item of leftBuckets) {
          const count = counts.get(item.label) ?? 0;
          const percent = percentOf(item.label);
          const width = percent / 2;

          if (percent > 0) {
            segments.push({
              label: item.label,
              count,
              percent,
              start: currentLeftStart,
              width,
              colorClass: item.colorClass,
            });

            currentLeftStart += width;
          }
        }

        if (centerPercent > 0) {
          segments.push({
            label: centerBucket.label,
            count: counts.get(centerBucket.label) ?? 0,
            percent: centerPercent,
            start: 50 - centerVisualWidth / 2,
            width: centerVisualWidth,
            colorClass: centerBucket.colorClass,
          });
        }

        let currentRightStart = 50 + centerVisualWidth / 2;

        for (const item of rightBuckets) {
          const count = counts.get(item.label) ?? 0;
          const percent = percentOf(item.label);
          const width = percent / 2;

          if (percent > 0) {
            segments.push({
              label: item.label,
              count,
              percent,
              start: currentRightStart,
              width,
              colorClass: item.colorClass,
            });

            currentRightStart += width;
          }
        }

        return {
          label,
          total,
          segments,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
  }

formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
}


/**
 * Interprets the TDS decision criterion C using the sign convention in the
 * project's calculation guide.
 *
 * The guide does not define a numerical "neutral band". To avoid inventing
 * a research threshold, Neutral is used only when C rounds to 0.00 at the
 * same precision shown in the dashboard. Positive C = conservative;
 * negative C = liberal.
 */
criterionDecisionLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  const rounded = this.roundTo(value, 2);

  if (rounded === 0) {
    return 'Neutral';
  }

  return rounded > 0 ? 'Conservador' : 'Liberal';
}

criterionDecisionTendency(
  value: number | null,
  phase: 'DETECCION' | 'MEMORIA'
): string {
  const criterion = this.criterionDecisionLabel(value);

  if (criterion === '—') {
    return '—';
  }

  if (criterion === 'Neutral') {
    return 'Sin tendencia marcada';
  }

  if (phase === 'MEMORIA') {
    return criterion === 'Conservador'
      ? 'Tendencia a responder NUEVA'
      : 'Tendencia a responder VIEJA';
  }

  return criterion === 'Conservador'
    ? 'Tendencia a responder VERDADERA'
    : 'Tendencia a responder FALSA';
}

criterionDecisionClass(value: number | null): string {
  const criterion = this.criterionDecisionLabel(value);

  if (criterion === 'Conservador') {
    return 'criterion-conservative';
  }

  if (criterion === 'Liberal') {
    return 'criterion-liberal';
  }

  if (criterion === 'Neutral') {
    return 'criterion-neutral';
  }

  return 'criterion-unavailable';
}

/**
 * d′ is the discrimination index. The guide states that values above zero
 * indicate positive discrimination and values close to zero indicate
 * performance close to chance. It does not define cut points for low,
 * medium or high discrimination, so this dashboard does not invent them.
 */
discriminationInterpretation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  const rounded = this.roundTo(value, 2);

  if (rounded === 0) {
    return 'Cercana al azar';
  }

  return rounded > 0
    ? 'Discriminación positiva'
    : 'd′ negativo';
}

discriminationClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'discrimination-unavailable';
  }

  const rounded = this.roundTo(value, 2);

  if (rounded === 0) {
    return 'discrimination-neutral';
  }

  return rounded > 0
    ? 'discrimination-positive'
    : 'discrimination-negative';
}

private roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
  get accuracyDonutBackground(): string {
    const total = this.correctNewsResponses + this.incorrectNewsResponses;
    if (total === 0) {
      return 'conic-gradient(rgba(232, 223, 245, 0.12) 0% 100%)';
    }

    const correctPercent = (this.correctNewsResponses / total) * 100;
    return `conic-gradient(#2ecc71 0% ${correctPercent}%, #ff6b6b ${correctPercent}% 100%)`;
  }

  get participantSummaries(): ParticipantSummary[] {
    const grouped = new Map<string, DashboardRow[]>();

    for (const row of this.filteredRows) {
      if (!row.participantId) {
        continue;
      }

      const current = grouped.get(row.participantId) ?? [];
      current.push(row);
      grouped.set(row.participantId, current);
    }

    return Array.from(grouped.entries())
      .map(([participantId, rows]) => {
        const first = rows[0];
        const scores = this.numericScores(
          rows.filter(
            (row) =>
              row.questionType.trim().toUpperCase() === 'PROFILE'
          )
        );
        const evaluableRows = this.evaluableNewsRows(rows);
        const correct = evaluableRows.filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;

        return {
          participantId,
          alias: first?.alias ?? '',
          group: first?.feedbackTiming ?? '',
          format: first?.presentationFormat ?? '',
          newsSet: first?.newsSet ?? '',
          responses: rows.filter((row) => this.hasResponse(row)).length,
          averageScore: this.average(scores),
          medianScore: this.median(scores),
          accuracyRate: evaluableRows.length > 0 ? (correct / evaluableRows.length) * 100 : null,
          completionTimeSeconds: this.toNumber(first?.completionTimeSeconds ?? ''),
        };
      })
      .sort((a, b) => {
        const aNumber = Number(a.participantId);
        const bNumber = Number(b.participantId);

        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
          return aNumber - bNumber;
        }

        return a.participantId.localeCompare(b.participantId);
      });
  }

  chartColor(index: number): string {
    return this.chartPalette[index % this.chartPalette.length];
  }

  scorePercent(value: number | null): number {
    if (value === null || !Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, value));
  }

  formatNumber(value: number | null, decimals = 1): string {
    if (value === null || !Number.isFinite(value)) {
      return '—';
    }

    return value.toFixed(decimals);
  }

  formatPercent(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
      return '—';
    }

    return `${value.toFixed(1)}%`;
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) {
      return '—';
    }

    const rounded = Math.max(0, Math.round(seconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const remainingSeconds = rounded % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }

    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  private fetchDashboardData(username: string, password: string, mode: LoadMode): void {
    this.adminExportService.fetchCsv(username, password).subscribe({
      next: (blob) => {
        void this.loadDashboard(blob, mode, username, password);
      },
      error: (err) => {
        if (mode === 'login') {
          this.isLoading.set(false);
        } else {
          this.isRefreshing.set(false);
        }

        if (err?.status === 401 || err?.status === 403) {
          this.errorMessage.set('Credenciales no autorizadas.');
          return;
        }

        if (err?.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión.');
          return;
        }

        this.errorMessage.set(
          mode === 'refresh'
            ? 'No fue posible actualizar los datos. Se mantienen los datos cargados anteriormente.'
            : 'No fue posible cargar los datos del dashboard.'
        );
      },
    });
  }

  get sdtByPhase(): SdtMetrics[] {
    return (['DETECCION', 'MEMORIA'] as const)
      .map((phase) => this.calculateSdtMetrics(this.filteredRows, phase, 'TOTAL'))
      .filter((item) => this.hasSdtData(item));
  }

  get sdtBySex(): SdtMetrics[] {
    const sexes = this.uniqueValues(this.filteredRows.map((row) => row.sex));
    const results: SdtMetrics[] = [];

    for (const sex of sexes) {
      const sexRows = this.filteredRows.filter((row) => row.sex === sex);

      for (const phase of ['DETECCION', 'MEMORIA'] as const) {
        const metrics = this.calculateSdtMetrics(sexRows, phase, sex);

        if (this.hasSdtData(metrics)) {
          results.push(metrics);
        }
      }
    }

    return results;
  }

  get sdtDashboardRows(): SdtMetrics[] {
    return [...this.sdtByPhase, ...this.sdtBySex];
  }

  private calculateSdtMetrics(
  rows: DashboardRow[],
  phase: 'DETECCION' | 'MEMORIA',
  group: string
): SdtMetrics {
  const phaseRows = this.getNewsRowsForPhase(rows, phase);

  let hit = 0;
  let falseAlarm = 0;
  let miss = 0;
  let correctResponse = 0;
  let unsure = 0;

  for (const row of phaseRows) {
    const category = this.normalizeSdtCategory(row.sdtCategory);

    switch (category) {
      case 'HIT':
        hit += 1;
        break;

      case 'FALSE_ALARM':
        falseAlarm += 1;
        break;

      case 'MISS':
        miss += 1;
        break;

      case 'CORRECT_RESPONSE':
        correctResponse += 1;
        break;

      case 'UNSURE':
        unsure += 1;
        break;

      default:
        break;
    }
  }

  const signalN = hit + miss;
  const noiseN = falseAlarm + correctResponse;

  const hitRate =
    signalN > 0
      ? hit / signalN
      : null;

  const falseAlarmRate =
    noiseN > 0
      ? falseAlarm / noiseN
      : null;

  const missRate =
    signalN > 0
      ? miss / signalN
      : null;

  const correctResponseRate =
    noiseN > 0
      ? correctResponse / noiseN
      : null;

  let dPrime: number | null = null;
  let criterionC: number | null = null;

  if (
    hitRate !== null &&
    falseAlarmRate !== null
  ) {
    const correctedHitRate =
      this.correctExtremeRate(hitRate, signalN);

    const correctedFalseAlarmRate =
      this.correctExtremeRate(falseAlarmRate, noiseN);

    const zHit =
      this.inverseNormalCdf(correctedHitRate);

    const zFalseAlarm =
      this.inverseNormalCdf(correctedFalseAlarmRate);

    dPrime = zHit - zFalseAlarm;

    criterionC =
      -(zHit + zFalseAlarm) / 2;
  }

  return {
    group,
    phase,
    participantCount:
      this.uniqueParticipants(phaseRows).length,

    hit,
    falseAlarm,
    miss,
    correctResponse,
    unsure,

    hitRate,
    falseAlarmRate,
    missRate,
    correctResponseRate,

    dPrime,
    criterionC,
  };
}

private hasSdtData(metrics: SdtMetrics): boolean {
  return (
    metrics.hit +
      metrics.falseAlarm +
      metrics.miss +
      metrics.correctResponse +
      metrics.unsure >
    0
  );
}
  private getNewsRowsForPhase(
    rows: DashboardRow[],
    phase: 'DETECCION' | 'MEMORIA'
  ): DashboardRow[] {
    return rows.filter((row) => {
      if (row.questionType.trim().toUpperCase() !== 'NEWS') {
        return false;
      }

      const answerType = row.answerType.trim().toUpperCase();
      const rowPhase = row.phase.trim().toUpperCase();

      if (answerType === 'FAKE_DETECTION') {
        return phase === 'DETECCION';
      }

      if (answerType === 'MEMORY_TEST') {
        return phase === 'MEMORIA';
      }

      return rowPhase === phase;
    });
  }

  private sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const mean = this.average(values);

  if (mean === null) {
    return null;
  }

  const variance =
    values.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) /
    (values.length - 1);

  return Math.sqrt(variance);
}

private normalizeSdtCategory(
  value: string
):
  | 'HIT'
  | 'FALSE_ALARM'
  | 'MISS'
  | 'CORRECT_RESPONSE'
  | 'UNSURE'
  | null {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith('HIT') ||
    normalized === 'A'
  ) {
    return 'HIT';
  }

  if (
    normalized.startsWith('FALSE_ALARM') ||
    normalized === 'B'
  ) {
    return 'FALSE_ALARM';
  }

  if (
    normalized.startsWith('MISS') ||
    normalized === 'C'
  ) {
    return 'MISS';
  }

  if (
    normalized.startsWith('CORRECT_RESPONSE') ||
    normalized.startsWith('CORRECT_REJECTION') ||
    normalized === 'D'
  ) {
    return 'CORRECT_RESPONSE';
  }

  if (
    normalized.startsWith('UNSURE') ||
    normalized.includes('INCERT')
  ) {
    return 'UNSURE';
  }

  return null;
}

private correctExtremeRate(
  rate: number,
  n: number
): number {
  if (n <= 0) {
    return rate;
  }

  if (rate === 1) {
    return 1 - 1 / (2 * n);
  }

  if (rate === 0) {
    return 1 / (2 * n);
  }

  return rate;
}

private inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) {
    return Number.NaN;
  }

  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;

  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;

  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;

  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));

    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));

    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  const q = p - 0.5;
  const r = q * q;

  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) *
    q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

  private async loadDashboard(blob: Blob, mode: LoadMode, username: string, password: string): Promise<void> {
    try {
      const csv = await blob.text();
      const parsedRows = this.parseCsv(csv);

      if (parsedRows.length === 0) {
        this.errorMessage.set('El servidor respondió correctamente, pero el CSV no contiene datos.');

        if (mode === 'login') {
          this.rows = [];
          this.isAuthenticated = false;
        }
        return;
      }

      this.rows = parsedRows;
      this.lastUpdatedAt = new Date();
      this.isAuthenticated = true;
      this.errorMessage.set('');

      if (mode === 'login') {
        this.authenticatedUsername = username;
        this.authenticatedPassword = password;
        this.password = '';
        this.clearFilters();
      } else {
        this.keepOnlyValidFilters();
        this.refreshMessage.set('Datos actualizados correctamente desde el servidor.');
      }
    } catch {
      this.errorMessage.set(
        mode === 'refresh'
          ? 'La nueva respuesta no pudo procesarse como CSV. Se mantienen los datos anteriores.'
          : 'El archivo recibido no pudo ser procesado como CSV.'
      );

      if (mode === 'login') {
        this.rows = [];
        this.isAuthenticated = false;
      }
    } finally {
      if (mode === 'login') {
        this.isLoading.set(false);
      } else {
        this.isRefreshing.set(false);
      }
    }
  }

  private keepOnlyValidFilters(): void {
    if (this.selectedPhase && !this.phaseOptions.includes(this.selectedPhase)) {
      this.selectedPhase = '';
    }
    if (this.selectedQuestionType && !this.questionTypeOptions.includes(this.selectedQuestionType)) {
      this.selectedQuestionType = '';
    }
    if (this.selectedConstructo && !this.constructoOptions.includes(this.selectedConstructo)) {
      this.selectedConstructo = '';
    }
    if (this.selectedFormat && !this.formatOptions.includes(this.selectedFormat)) {
      this.selectedFormat = '';
    }
    if (this.selectedNewsSet && !this.newsSetOptions.includes(this.selectedNewsSet)) {
      this.selectedNewsSet = '';
    }
    if (this.selectedParticipantId && !this.participantOptions.includes(this.selectedParticipantId)) {
      this.selectedParticipantId = '';
    }
    if (this.selectedSex && !this.sexOptions.includes(this.selectedSex)) {
  this.selectedSex = '';
}
  }

  private parseCsv(text: string): DashboardRow[] {
    const normalizedText = text.replace(/^\uFEFF/, '');
    const delimiter = this.detectDelimiter(normalizedText);
    const matrix = this.parseDelimitedText(normalizedText, delimiter);

    if (matrix.length < 2) {
      return [];
    }

    const headers = matrix[0].map((header) => header.trim());

    return matrix
      .slice(1)
      .filter((values) => values.some((value) => value.trim().length > 0))
      .map((values) => {
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
          record[header] = (values[index] ?? '').trim();
        });

        const get = (key: string): string => record[key] ?? '';

        return {
          participantId: get('participantId'),
          alias: get('alias'),
          email: get('email'),
          sex: get('sex'),
          age: get('age'),
          region: get('region'),
          feedbackTiming: get('feedbackTiming'),
          presentationFormat: get('presentationFormat'),
          newsSet: get('newsSet'),
          completionTimeSeconds: get('completionTimeSeconds'),
          registeredAt: get('registeredAt'),
          questionCode: get('questionCode'),
          questionType: get('questionType'),
          constructo: get('constructo'),
          subCategory: get('subCategory'),
          subCategory2: get('subCategory2'),
          itemText: get('itemText'),
          correctAnswer: get('correctAnswer'),
          phase: get('phase'),
          category: get('category'),
          novelty: get('novelty'),
          score: get('score'),
          questionOrder: get('questionOrder'),
          answeredAt: get('answeredAt'),
          answerType: get('answerType'),
          isCorrect: get('isCorrect'),
          sdtCategory: get('sdtCategory'),
        };
      });
  }

  private detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const candidates = [',', ';', '\t'];

    let bestDelimiter = ',';
    let bestCount = -1;

    for (const candidate of candidates) {
      let count = 0;
      let inQuotes = false;

      for (let index = 0; index < firstLine.length; index += 1) {
        const char = firstLine[index];

        if (char === '"') {
          if (inQuotes && firstLine[index + 1] === '"') {
            index += 1;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }

        if (!inQuotes && char === candidate) {
          count += 1;
        }
      }

      if (count > bestCount) {
        bestCount = count;
        bestDelimiter = candidate;
      }
    }

    return bestDelimiter;
  }

  private parseDelimitedText(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (char === '"') {
        if (inQuotes && text[index + 1] === '"') {
          currentField += '"';
          index += 1;
          continue;
        }

        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if (!inQuotes && char === '\n') {
        currentRow.push(currentField.replace(/\r$/, ''));
        if (currentRow.some((value) => value.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        continue;
      }

      currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.replace(/\r$/, ''));
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  private uniqueParticipants(rows: DashboardRow[]): DashboardRow[] {
    const participants = new Map<string, DashboardRow>();

    for (const row of rows) {
      if (!row.participantId || participants.has(row.participantId)) {
        continue;
      }
      participants.set(row.participantId, row);
    }

    return Array.from(participants.values());
  }

  private uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }

  private numericScores(rows: DashboardRow[]): number[] {
    return rows
      .map((row) => this.toNumber(row.score))
      .filter((value): value is number => value !== null);
  }

private evaluableNewsRows(rows: DashboardRow[]): DashboardRow[] {
  return rows.filter((row) => this.correctnessStatus(row) !== null);
}


private correctnessStatus(row: DashboardRow): 'TRUE' | 'FALSE' | null {
  if (row.questionType.trim().toUpperCase() !== 'NEWS') {
    return null;
  }

  const value = row.isCorrect.trim().toUpperCase();

  return value === 'TRUE' || value === 'FALSE'
    ? value
    : null;
}

  private toNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private average(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private median(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  private hasResponse(row: DashboardRow): boolean {
    return Boolean(row.answeredAt || row.answerType || row.score);
  }


  /**
   * PROFILE summaries follow the guide's order of operations:
   * first average the relevant items for each participant, then average those
   * participant-level means across the selected sample.
   */
  private buildProfileParticipantBreakdown(
    rows: DashboardRow[],
    labelForRow: (row: DashboardRow) => string
  ): BreakdownItem[] {
    const grouped = new Map<string, Map<string, number[]>>();
    let validRowCount = 0;

    for (const row of rows) {
      const label = labelForRow(row).trim();
      const participantId = row.participantId.trim();
      const score = this.toNumber(row.score);

      if (!label || !participantId || score === null || score < 0 || score > 100) {
        continue;
      }

      validRowCount += 1;

      const byParticipant = grouped.get(label) ?? new Map<string, number[]>();
      const scores = byParticipant.get(participantId) ?? [];
      scores.push(score);
      byParticipant.set(participantId, scores);
      grouped.set(label, byParticipant);
    }

    return Array.from(grouped.entries()).map(([label, byParticipant]) => {
      const participantMeans = Array.from(byParticipant.values())
        .map((scores) => this.average(scores))
        .filter((value): value is number => value !== null);

      const count = Array.from(byParticipant.values()).reduce(
        (sum, scores) => sum + scores.length,
        0
      );

      return {
        label,
        count,
        participantCount: participantMeans.length,
        averageScore: this.average(participantMeans),
        accuracyRate: null,
        percent: validRowCount > 0 ? (count / validRowCount) * 100 : 0,
      };
    });
  }

  /**
   * Avoids mixing PROFILE (0..100) and NEWS (-10..10) in one mean.
   * If PROFILE rows exist in a grouping, the displayed average is PROFILE-only.
   * Otherwise it falls back to the NEWS-only mean for phase-specific legacy visuals.
   */
  private breakdownAverageScore(rows: DashboardRow[]): number | null {
    const profileRows = rows.filter(
      (row) => row.questionType.trim().toUpperCase() === 'PROFILE'
    );

    if (profileRows.length > 0) {
      return this.average(this.numericScores(profileRows));
    }

    const newsRows = rows.filter(
      (row) => row.questionType.trim().toUpperCase() === 'NEWS'
    );

    return this.average(this.numericScores(newsRows));
  }

  private buildBreakdown(items: Array<{ label: string; row: DashboardRow }>): BreakdownItem[] {
    const grouped = new Map<string, DashboardRow[]>();

    for (const item of items) {
      const label = item.label.trim();
      if (!label) {
        continue;
      }

      const rows = grouped.get(label) ?? [];
      rows.push(item.row);
      grouped.set(label, rows);
    }

    const total = Array.from(grouped.values()).reduce((sum, rows) => sum + rows.length, 0);

    return Array.from(grouped.entries())
      .map(([label, rows]) => {
        const evaluableRows = this.evaluableNewsRows(rows);
        const correct = evaluableRows.filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;

        return {
          label,
          count: rows.length,
          participantCount: this.uniqueParticipants(rows).length,
          averageScore: this.breakdownAverageScore(rows),
          accuracyRate: evaluableRows.length > 0 ? (correct / evaluableRows.length) * 100 : null,
          percent: total > 0 ? (rows.length / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  }

}
