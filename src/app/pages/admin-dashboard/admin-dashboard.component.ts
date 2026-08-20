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
  }

  get filteredRows(): DashboardRow[] {
    return this.rows.filter((row) => {
      return (
        (!this.selectedPhase || row.phase === this.selectedPhase) &&
        (!this.selectedQuestionType || row.questionType === this.selectedQuestionType) &&
        (!this.selectedConstructo || row.constructo === this.selectedConstructo) &&
        (!this.selectedFormat || row.presentationFormat === this.selectedFormat) &&
        (!this.selectedNewsSet || row.newsSet === this.selectedNewsSet) &&
        (!this.selectedParticipantId || row.participantId === this.selectedParticipantId)
      );
    });
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
    return this.average(this.numericScores(this.filteredRows));
  }

  get medianScore(): number | null {
    return this.median(this.numericScores(this.filteredRows));
  }

  get standardDeviation(): number | null {
    const values = this.numericScores(this.filteredRows);
    if (values.length === 0) {
      return null;
    }

    const mean = this.average(values);
    if (mean === null) {
      return null;
    }

    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
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
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.constructo, row })))
      .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity))
      .slice(0, 12);
  }

  get sdtBreakdown(): DistributionItem[] {
    const grouped = new Map<string, number>();

    for (const row of this.filteredRows) {
      const label = row.sdtCategory.trim();
      if (!label) {
        continue;
      }
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
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
        const scores = this.numericScores(rows);
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
          averageScore: this.average(this.numericScores(rows)),
          accuracyRate: evaluableRows.length > 0 ? (correct / evaluableRows.length) * 100 : null,
          percent: total > 0 ? (rows.length / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  }

}
