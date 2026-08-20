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
  averageScore: number | null;
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
  completed: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, GlassCardComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly adminExportService = inject(AdminExportService);

  isLoading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string> = signal('');

  username = '';
  password = '';
  isAuthenticated = false;
  rows: DashboardRow[] = [];

  selectedPhase = '';
  selectedQuestionType = '';
  selectedConstructo = '';
  selectedParticipantId = '';

  onLogin(): void {
    if (this.isLoading()) {
      return;
    }

    if (!this.username.trim() || !this.password) {
      this.errorMessage.set('Debes ingresar usuario y contraseña.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.adminExportService.fetchCsv(this.username.trim(), this.password).subscribe({
      next: (blob) => {
        void this.loadDashboard(blob);
      },
      error: (err) => {
        this.isLoading.set(false);

        if (err?.status === 401 || err?.status === 403) {
          this.errorMessage.set('Credenciales no autorizadas.');
          return;
        }

        if (err?.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión.');
          return;
        }

        this.errorMessage.set('No fue posible cargar los datos del dashboard.');
      },
    });
  }

  logout(): void {
    this.password = '';
    this.isAuthenticated = false;
    this.rows = [];
    this.clearFilters();
    this.errorMessage.set('');
  }

  clearFilters(): void {
    this.selectedPhase = '';
    this.selectedQuestionType = '';
    this.selectedConstructo = '';
    this.selectedParticipantId = '';
  }

  get totalRegistered(): number {
    return this.uniqueParticipants(this.rows).length;
  }

  get totalCompleted(): number {
    return this.uniqueParticipants(this.rows).filter((row) => this.isCompleted(row)).length;
  }

  get totalPending(): number {
    return Math.max(0, this.totalRegistered - this.totalCompleted);
  }

  get completionRate(): number {
    if (this.totalRegistered === 0) {
      return 0;
    }

    return (this.totalCompleted / this.totalRegistered) * 100;
  }

  get filteredRows(): DashboardRow[] {
    return this.rows.filter((row) => {
      return (
        (!this.selectedPhase || row.phase === this.selectedPhase) &&
        (!this.selectedQuestionType || row.questionType === this.selectedQuestionType) &&
        (!this.selectedConstructo || row.constructo === this.selectedConstructo) &&
        (!this.selectedParticipantId || row.participantId === this.selectedParticipantId)
      );
    });
  }

  get filteredParticipantCount(): number {
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
    const evaluableRows = this.filteredRows.filter((row) => {
      const value = row.isCorrect.toUpperCase();
      return row.questionType.toUpperCase() === 'NEWS' && (value === 'TRUE' || value === 'FALSE');
    });

    if (evaluableRows.length === 0) {
      return null;
    }

    const correct = evaluableRows.filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;
    return (correct / evaluableRows.length) * 100;
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
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.phase, row })));
  }

  get questionTypeBreakdown(): BreakdownItem[] {
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.questionType, row })));
  }

  get constructoBreakdown(): BreakdownItem[] {
    return this.buildBreakdown(this.filteredRows.map((row) => ({ label: row.constructo, row }))).slice(0, 12);
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
        const evaluableRows = rows.filter((row) => {
          const value = row.isCorrect.toUpperCase();
          return row.questionType.toUpperCase() === 'NEWS' && (value === 'TRUE' || value === 'FALSE');
        });
        const correct = evaluableRows.filter((row) => row.isCorrect.toUpperCase() === 'TRUE').length;
        const completionTimeSeconds = this.toNumber(first?.completionTimeSeconds ?? '');

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
          completionTimeSeconds,
          completed: completionTimeSeconds !== null && completionTimeSeconds > 0,
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
    const minutes = Math.floor(rounded / 60);
    const remainingSeconds = rounded % 60;

    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  private async loadDashboard(blob: Blob): Promise<void> {
    try {
      const csv = await blob.text();
      const parsedRows = this.parseCsv(csv);

      if (parsedRows.length === 0) {
        this.errorMessage.set('El servidor respondió correctamente, pero el CSV no contiene datos.');
        this.rows = [];
        this.isAuthenticated = false;
        return;
      }

      this.rows = parsedRows;
      this.isAuthenticated = true;
      this.password = '';
      this.clearFilters();
      this.errorMessage.set('');
    } catch {
      this.rows = [];
      this.isAuthenticated = false;
      this.errorMessage.set('El archivo recibido no pudo ser procesado como CSV.');
    } finally {
      this.isLoading.set(false);
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

  private isCompleted(row: DashboardRow): boolean {
    const completionTime = this.toNumber(row.completionTimeSeconds);
    return completionTime !== null && completionTime > 0;
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
      .map(([label, rows]) => ({
        label,
        count: rows.length,
        averageScore: this.average(this.numericScores(rows)),
        percent: total > 0 ? (rows.length / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  }
}
