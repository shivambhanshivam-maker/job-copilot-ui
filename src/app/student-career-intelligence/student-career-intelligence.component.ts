import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PeerEvidenceCategory, PeerEvidencePattern, StudentInsight, StudentPrimaryFocus } from '../services/api.service';

type StudentSignalType = 'RECURRING_CAPABILITY_GAP' | 'ROLE_CATEGORY_FIT_COMPARISON' | 'ROLE_CATEGORY_TRACTION';

interface InsightEvidence {
  label: string;
  value: string;
}

interface RecurringGapExample {
  company?: string;
  jobTitle?: string;
  roleCategory?: string;
  rawGapText: string;
}

interface StudentSignalView {
  insight: StudentInsight;
  type: StudentSignalType;
  label: string;
  evidence: InsightEvidence[];
  examples: RecurringGapExample[];
}

interface RoleCategoryPerformanceView {
  category: string;
  fitScore: number | null;
  responseRate: number | null;
}

@Component({
  selector: 'app-student-career-intelligence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-career-intelligence.component.html',
  styleUrl: './student-career-intelligence.component.scss'
})
export class StudentCareerIntelligenceComponent implements OnInit {
  loading = true;
  signals: StudentSignalView[] = [];
  primaryFocus: StudentPrimaryFocus | null = null;
  peerEvidenceLoading = true;
  peerCategories: PeerEvidenceCategory[] = [];
  selectedPeerCategory = '';
  selectedPeerCapability = '';

  private readonly allowedTypes: StudentSignalType[] = [
    'RECURRING_CAPABILITY_GAP',
    'ROLE_CATEGORY_FIT_COMPARISON',
    'ROLE_CATEGORY_TRACTION'
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSignals();
    this.loadPeerEvidence();
  }

  loadSignals(): void {
    this.loading = true;
    this.apiService.getStudentInsights().subscribe({
      next: (response) => {
        this.primaryFocus = response.primaryFocus ?? null;
        this.signals = response.insights
          .filter((insight): insight is StudentInsight & { insightType: StudentSignalType } =>
            this.allowedTypes.includes(insight.insightType as StudentSignalType)
          )
          .map((insight) => this.toSignalView(insight));
        this.loading = false;
      },
      error: () => {
        this.primaryFocus = null;
        this.signals = [];
        this.loading = false;
      }
    });
  }

  loadPeerEvidence(): void {
    this.peerEvidenceLoading = true;
    this.apiService.getPeerEvidence().subscribe({
      next: (response) => {
        this.peerCategories = response.categories ?? [];
        this.selectedPeerCategory = this.peerCategories[0]?.roleCategory ?? '';
        this.selectedPeerCapability = this.peerCategories[0]?.patterns[0]?.capability ?? '';
        this.peerEvidenceLoading = false;
      },
      error: () => {
        this.peerCategories = [];
        this.selectedPeerCategory = '';
        this.selectedPeerCapability = '';
        this.peerEvidenceLoading = false;
      }
    });
  }

  get activePeerCategory(): PeerEvidenceCategory | undefined {
    return this.peerCategories.find((category) => category.roleCategory === this.selectedPeerCategory)
      ?? this.peerCategories[0];
  }

  get activePeerPattern(): PeerEvidencePattern | undefined {
    const category = this.activePeerCategory;
    return category?.patterns.find((pattern) => pattern.capability === this.selectedPeerCapability)
      ?? category?.patterns[0];
  }

  selectPeerCategory(roleCategory: string): void {
    this.selectedPeerCategory = roleCategory;
    const category = this.peerCategories.find((item) => item.roleCategory === roleCategory);
    this.selectedPeerCapability = category?.patterns[0]?.capability ?? '';
  }

  get recurringGapSignals(): StudentSignalView[] {
    return this.signalsFor('RECURRING_CAPABILITY_GAP');
  }

  get roleCategoryPerformance(): RoleCategoryPerformanceView[] {
    const categories = new Map<string, RoleCategoryPerformanceView>();
    const fitSignal = this.signals.find((signal) => signal.type === 'ROLE_CATEGORY_FIT_COMPARISON');
    const tractionSignal = this.signals.find((signal) => signal.type === 'ROLE_CATEGORY_TRACTION');

    if (fitSignal) {
      const evidence = this.parseEvidence(fitSignal.insight.evidenceJson);
      this.mergeRoleCategory(categories, evidence['bestCategory'], evidence['bestMedianFitScore'], null);
      this.mergeRoleCategory(categories, evidence['comparedCategory'], evidence['comparedMedianFitScore'], null);
    }

    if (tractionSignal) {
      const evidence = this.parseEvidence(tractionSignal.insight.evidenceJson);
      this.mergeRoleCategory(categories, evidence['bestCategory'], null, evidence['bestResponseRate']);
      this.mergeRoleCategory(categories, evidence['worstCategory'], null, evidence['worstResponseRate']);
    }

    return Array.from(categories.values());
  }

  get roleCategoryPerformanceSummary(): string {
    const performance = this.roleCategoryPerformance;
    const fitCategories = performance.filter((item) => item.fitScore !== null);
    const responseCategories = performance.filter((item) => item.responseRate !== null);

    if (fitCategories.length && responseCategories.length) {
      const strongestFit = fitCategories.reduce((best, item) =>
        (item.fitScore ?? -1) > (best.fitScore ?? -1) ? item : best
      );
      const strongestResponse = responseCategories.reduce((best, item) =>
        (item.responseRate ?? -1) > (best.responseRate ?? -1) ? item : best
      );

      if (strongestFit.category === strongestResponse.category) {
        return `${strongestFit.category} is currently stronger on both fit and recruiter response.`;
      }
      return 'Your fit and recruiter response are pointing to different role categories.';
    }

    if (fitCategories.length) {
      const strongestFit = fitCategories.reduce((best, item) =>
        (item.fitScore ?? -1) > (best.fitScore ?? -1) ? item : best
      );
      return `${strongestFit.category} is currently showing the strongest relative fit.`;
    }

    if (responseCategories.length) {
      const strongestResponse = responseCategories.reduce((best, item) =>
        (item.responseRate ?? -1) > (best.responseRate ?? -1) ? item : best
      );
      return `${strongestResponse.category} is currently showing stronger recruiter response.`;
    }

    return '';
  }

  recurringGapTitle(signal: StudentSignalView): string {
    return this.evidenceValue(signal, 'Capability') || signal.insight.title;
  }

  recurringGapContext(signal: StudentSignalView): string {
    const count = this.evidenceValue(signal, 'Seen across');
    const roleArea = this.evidenceValue(signal, 'Role area');
    const applicationText = count ? `Seen in ${count} applied roles` : 'Seen across multiple applied roles';
    return roleArea ? `${applicationText} in ${roleArea}` : applicationText;
  }

  peerCategoryTrack(_: number, category: PeerEvidenceCategory): string {
    return category.roleCategory;
  }

  peerPatternTrack(_: number, pattern: PeerEvidencePattern): string {
    return pattern.capability;
  }

  percentage(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  fitScore(value: number | null): string {
    return value === null ? '--' : String(Math.round(value));
  }

  responseRate(value: number | null): string {
    return value === null ? '--' : this.percentage(value);
  }

  lowercaseCapability(value: string | null | undefined): string {
    return value?.trim().toLowerCase() || 'this capability';
  }

  peerPatternLabel(pattern: PeerEvidencePattern): string {
    if (pattern.currentStudentEvidenceStatus === 'Missing'
      || pattern.currentStudentEvidenceRate === 0) {
      return 'Skill gap in your CV';
    }
    if (pattern.currentStudentEvidenceStatus === 'Partial') {
      return 'Strengthen this CV evidence';
    }
    if (pattern.currentStudentEvidenceStatus === 'Strong') {
      return 'This skill appears in your CV';
    }
    return 'CV evidence comparison';
  }

  interviewPeerEvidenceSummary(pattern: PeerEvidencePattern): string {
    if (pattern.interviewEvidenceRate >= 1) {
      return 'All interview-reached peers included this skill in their CV evidence.';
    }
    if (pattern.interviewEvidenceRate <= 0) {
      return 'No interview-reached peers included this skill in their CV evidence.';
    }
    return `${this.percentage(pattern.interviewEvidenceRate)} of interview-reached peers included this skill in their CV evidence.`;
  }

  currentStudentEvidenceSummary(pattern: PeerEvidencePattern): string {
    if (pattern.currentStudentApplicationsWithRequirement <= 0) {
      return 'This skill was not assessed in your linked fit analyses.';
    }
    if (pattern.currentStudentEvidenceRate <= 0) {
      return 'Your CV did not show this skill in any of your applied roles where it was assessed.';
    }
    if (pattern.currentStudentEvidenceRate >= 1) {
      return 'Your CV showed this skill in all of your applied roles where it was assessed.';
    }
    return `Your CV showed this skill in ${this.percentage(pattern.currentStudentEvidenceRate)} of your applied roles where it was assessed.`;
  }

  signalsFor(type: StudentSignalType): StudentSignalView[] {
    return this.signals.filter((signal) => signal.type === type);
  }

  hasSignalsFor(type: StudentSignalType): boolean {
    return this.signalsFor(type).length > 0;
  }

  severityClass(signal: StudentSignalView): string {
    return signal.insight.severity.toLowerCase();
  }

  trackSignal(_: number, signal: StudentSignalView): string {
    return signal.insight.id;
  }

  trackGapExample(_: number, example: RecurringGapExample): string {
    return `${example.company ?? ''}-${example.jobTitle ?? ''}-${example.rawGapText}`;
  }

  trackEvidence(_: number, evidence: InsightEvidence): string {
    return `${evidence.label}-${evidence.value}`;
  }

  trackRoleCategory(_: number, performance: RoleCategoryPerformanceView): string {
    return performance.category;
  }

  evidenceValue(signal: StudentSignalView, label: string): string {
    return signal.evidence.find((item) => item.label === label)?.value ?? '';
  }

  private toSignalView(insight: StudentInsight & { insightType: StudentSignalType }): StudentSignalView {
    return {
      insight,
      type: insight.insightType,
      label: this.typeLabel(insight.insightType),
      evidence: this.evidenceFor(insight),
      examples: this.examplesFor(insight)
    };
  }

  private typeLabel(type: StudentSignalType): string {
    const labels: Record<StudentSignalType, string> = {
      RECURRING_CAPABILITY_GAP: 'Recurring gap',
      ROLE_CATEGORY_FIT_COMPARISON: 'Role category fit',
      ROLE_CATEGORY_TRACTION: 'Search traction'
    };
    return labels[type];
  }

  private evidenceFor(insight: StudentInsight): InsightEvidence[] {
    const evidence = this.parseEvidence(insight.evidenceJson);

    if (insight.insightType === 'ROLE_CATEGORY_TRACTION') {
      return this.compactEvidence([
        ['Stronger signal', evidence['bestCategory']],
        ['Applications', evidence['bestApplications']],
        ['Response rate', this.asPercent(evidence['bestResponseRate'])],
        ['Compared with', evidence['worstCategory']]
      ]);
    }

    if (insight.insightType === 'ROLE_CATEGORY_FIT_COMPARISON') {
      return this.compactEvidence([
        ['Strongest category', evidence['bestCategory']],
        ['Median fit', evidence['bestMedianFitScore']],
        ['Compared with', evidence['comparedCategory']],
        ['Difference', this.points(evidence['fitScoreGap'])]
      ]);
    }

    return this.compactEvidence([
      ['Capability', evidence['capability'] ?? evidence['conceptName'] ?? evidence['concept']],
      ['Seen across', evidence['applicationCount'] ?? evidence['fitAnalysisCount'] ?? evidence['mentionCount']],
      ['Role area', evidence['roleCategory']]
    ]);
  }

  private examplesFor(insight: StudentInsight): RecurringGapExample[] {
    const evidence = this.parseEvidence(insight.evidenceJson);
    const structuredExamples = evidence['examples'];
    if (Array.isArray(structuredExamples)) {
      return structuredExamples
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          company: typeof item['company'] === 'string' ? item['company'] : undefined,
          jobTitle: typeof item['jobTitle'] === 'string' ? item['jobTitle'] : undefined,
          roleCategory: typeof item['roleCategory'] === 'string' ? item['roleCategory'] : undefined,
          rawGapText: typeof item['rawGapText'] === 'string' ? item['rawGapText'] : ''
        }))
        .filter((item) => item.rawGapText.trim().length > 0)
        .slice(0, 5);
    }

    const rawExamples = evidence['rawExamples'];
    if (!Array.isArray(rawExamples)) return [];
    return rawExamples
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 5)
      .map((rawGapText) => ({ rawGapText }));
  }

  private parseEvidence(raw: string): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private compactEvidence(items: [string, unknown][]): InsightEvidence[] {
    return items
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  private asPercent(value: unknown): string | null {
    if (typeof value !== 'number') return null;
    return `${Math.round(value * 100)}%`;
  }

  private points(value: unknown): string | null {
    if (typeof value !== 'number') return null;
    return `${value} points`;
  }

  private mergeRoleCategory(categories: Map<string, RoleCategoryPerformanceView>, categoryValue: unknown,
                            fitScoreValue: unknown, responseRateValue: unknown): void {
    if (typeof categoryValue !== 'string' || !categoryValue.trim()) return;

    const category = categoryValue.trim();
    const existing = categories.get(category) ?? { category, fitScore: null, responseRate: null };
    if (typeof fitScoreValue === 'number') existing.fitScore = fitScoreValue;
    if (typeof responseRateValue === 'number') existing.responseRate = responseRateValue;
    categories.set(category, existing);
  }
}
