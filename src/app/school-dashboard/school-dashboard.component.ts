import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  SchoolBreakdownItem,
  SchoolContext,
  SchoolOverview,
  SchoolStudentApplications,
  SchoolStudentRoster,
  SchoolStudentRosterItem,
  SchoolSupportQueue,
  SupportQueueItem,
  SupportSignal
} from '../services/api.service';

type AdvisorStudentRow = SupportQueueItem | SchoolStudentRosterItem;

@Component({
  selector: 'app-school-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './school-dashboard.component.html',
  styleUrl: './school-dashboard.component.scss'
})
export class SchoolDashboardComponent implements OnInit {
  loading = true;
  activeView: 'supportQueue' | 'students' = 'supportQueue';
  context: SchoolContext | null = null;
  overview: SchoolOverview | null = null;
  supportQueue: SchoolSupportQueue | null = null;
  studentRoster: SchoolStudentRoster | null = null;
  rosterSearchTerm = '';
  selectedStudent: AdvisorStudentRow | null = null;
  applicationDetails: Record<string, SchoolStudentApplications> = {};
  applicationDetailsLoading: Record<string, boolean> = {};
  applicationDetailsError: Record<string, string> = {};
  queueActionLoading: Record<string, boolean> = {};
  queueActionState: Record<string, 'saving' | 'success'> = {};
  queueActionMessage: Record<string, string> = {};
  queueActionError = '';

  constructor(private apiService: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.activeView = data['schoolView'] === 'students' ? 'students' : 'supportQueue';
      this.selectedStudent = null;
      this.loadViewData();
    });
  }

  private loadViewData(): void {
    this.loading = true;
    if (this.activeView === 'students') {
      forkJoin({
        context: this.apiService.getSchoolContext(),
        studentRoster: this.apiService.getSchoolStudents()
      }).subscribe({
        next: ({ context, studentRoster }) => {
          this.context = context;
          this.studentRoster = studentRoster;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
      return;
    }

    forkJoin({
      context: this.apiService.getSchoolContext(),
      overview: this.apiService.getSchoolOverview(),
      supportQueue: this.apiService.getSchoolSupportQueue()
    }).subscribe({
      next: ({ context, overview, supportQueue }) => {
        this.context = context;
        this.overview = overview;
        this.supportQueue = supportQueue;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  asPercent(value: number | undefined): string {
    if (value == null) return '0%';
    return `${Math.round(value * 100)}%`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'No activity yet';
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  daysAgo(value: string | null | undefined): string {
    if (!value) return 'No activity';
    const diffMs = Date.now() - new Date(value).getTime();
    const days = Math.max(0, Math.floor(diffMs / 86400000));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  signalLabel(signal: SupportSignal): string {
    const labels: Record<string, string> = {
      HIGH_ACTIVITY_NO_RESPONSES: 'High activity, no responses',
      INTERVIEWS_NO_OFFERS: 'Interviews, no offers',
      STALE_APPLIED_PIPELINE: 'Stale applied pipeline',
      NO_RECENT_ACTIVITY: 'No recent activity'
    };
    return labels[signal.type] ?? signal.type;
  }

  visibilityLevel(item: AdvisorStudentRow): 'LIMITED' | 'FULL' {
    return item.advisorVisibilityLevel === 'FULL' ? 'FULL' : 'LIMITED';
  }

  visibilityLabel(item: AdvisorStudentRow): string {
    return this.visibilityLevel(item) === 'FULL' ? 'Full visibility' : 'Limited visibility';
  }

  visibilityCss(item: AdvisorStudentRow): string {
    return this.visibilityLevel(item).toLowerCase();
  }

  detailButtonLabel(item: AdvisorStudentRow): string {
    return this.visibilityLevel(item) === 'FULL' ? 'View applications' : 'View progress summary';
  }

  visibilityDescription(item: AdvisorStudentRow): string {
    return this.visibilityLevel(item) === 'FULL'
      ? 'Role titles, companies, statuses, and activity are visible.'
      : 'Progress and outcomes are visible; role titles and companies are hidden.';
  }

  openStudentDetails(item: AdvisorStudentRow): void {
    this.selectedStudent = item;
    if (this.visibilityLevel(item) === 'FULL' && !this.applicationDetails[item.studentUserId]) {
      this.loadStudentApplications(item.studentUserId);
    }
  }

  closeStudentDetails(): void {
    this.selectedStudent = null;
  }

  activeConsentedStudents(): number {
    if (this.activeView === 'supportQueue') {
      return this.supportQueue?.eligibleStudents ?? this.overview?.activeStudents ?? 0;
    }
    return this.studentRoster?.students.length ?? 0;
  }

  fullDetailsStudents(): number {
    return this.studentRoster?.students.filter(student => this.visibilityLevel(student) === 'FULL').length ?? 0;
  }

  limitedDetailsStudents(): number {
    return this.studentRoster?.students.filter(student => this.visibilityLevel(student) === 'LIMITED').length ?? 0;
  }

  studentsWithInterviews(): number {
    return this.studentRoster?.students.filter(student => student.summary.interviews > 0).length ?? 0;
  }

  studentsWithOffers(): number {
    return this.studentRoster?.students.filter(student => student.summary.offers > 0).length ?? 0;
  }

  onRosterSearch(value: string): void {
    this.rosterSearchTerm = value;
  }

  filteredStudentRoster(): SchoolStudentRosterItem[] {
    const students = this.studentRoster?.students ?? [];
    const query = this.rosterSearchTerm.trim().toLowerCase();
    if (!query) return students;

    return students.filter(student => {
      const searchableText = [
        student.studentName,
        student.studentEmail,
        student.programName,
        student.cohortName,
        student.jobSearchStatus,
        this.visibilityLabel(student),
        this.pipelineStage(student)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  pipelineStage(item: AdvisorStudentRow): string {
    if (item.summary.offers > 0) return 'Has offer';
    if (item.summary.interviews > 0) return 'Interviewing';
    if (item.summary.totalApplications > 0) return 'Applying';
    return 'No tracked apps';
  }

  pipelineCss(item: AdvisorStudentRow): string {
    if (item.summary.offers > 0) return 'offer';
    if (item.summary.interviews > 0) return 'interviewing';
    if (item.summary.totalApplications > 0) return 'applying';
    return 'empty';
  }

  private loadStudentApplications(studentUserId: string): void {
    this.applicationDetailsLoading[studentUserId] = true;
    this.applicationDetailsError[studentUserId] = '';
    this.apiService.getSchoolStudentApplications(studentUserId).subscribe({
      next: (details) => {
        this.applicationDetails[studentUserId] = details;
        this.applicationDetailsLoading[studentUserId] = false;
      },
      error: () => {
        this.applicationDetailsError[studentUserId] = 'Application details are not available for this student.';
        this.applicationDetailsLoading[studentUserId] = false;
      }
    });
  }

  supportSignalKey(item: SupportQueueItem, signal: SupportSignal): string {
    return `${item.studentUserId}:${signal.type}:${signal.fingerprint}`;
  }

  reviewSupportSignal(item: SupportQueueItem, signal: SupportSignal): void {
    const key = this.supportSignalKey(item, signal);
    this.queueActionLoading[key] = true;
    this.queueActionState[key] = 'saving';
    delete this.queueActionMessage[key];
    this.queueActionError = '';
    this.apiService.reviewSchoolSupportSignal({
      studentUserId: item.studentUserId,
      signalType: signal.type,
      signalFingerprint: signal.fingerprint
    }).subscribe({
      next: () => {
        this.queueActionLoading[key] = false;
        this.queueActionState[key] = 'success';
        this.queueActionMessage[key] = 'Reviewed';
        this.removeAfterAction(item, signal, key);
      },
      error: () => {
        this.queueActionLoading[key] = false;
        delete this.queueActionState[key];
        this.queueActionError = 'We could not update this support signal.';
      }
    });
  }

  snoozeSupportSignal(item: SupportQueueItem, signal: SupportSignal, days: string): void {
    const snoozeDays = Number(days);
    if (!snoozeDays) return;

    const key = this.supportSignalKey(item, signal);
    this.queueActionLoading[key] = true;
    this.queueActionState[key] = 'saving';
    delete this.queueActionMessage[key];
    this.queueActionError = '';
    this.apiService.snoozeSchoolSupportSignal({
      studentUserId: item.studentUserId,
      signalType: signal.type,
      signalFingerprint: signal.fingerprint,
      snoozeDays
    }).subscribe({
      next: () => {
        this.queueActionLoading[key] = false;
        this.queueActionState[key] = 'success';
        this.queueActionMessage[key] = `Snoozed for ${snoozeDays} days`;
        this.removeAfterAction(item, signal, key);
      },
      error: () => {
        this.queueActionLoading[key] = false;
        delete this.queueActionState[key];
        this.queueActionError = 'We could not snooze this support signal.';
      }
    });
  }

  private removeAfterAction(item: SupportQueueItem, signal: SupportSignal, key: string): void {
    window.setTimeout(() => {
      this.removeSupportSignal(item, signal);
      delete this.queueActionState[key];
      delete this.queueActionMessage[key];
    }, 850);
  }

  private removeSupportSignal(item: SupportQueueItem, signal: SupportSignal): void {
    if (!this.supportQueue) return;

    const items = this.supportQueue.items
      .map(queueItem => {
        if (queueItem.studentUserId !== item.studentUserId) return queueItem;

        const signals = queueItem.signals.filter(candidate => candidate.fingerprint !== signal.fingerprint);
        return {
          ...queueItem,
          signals,
          severity: this.highestSeverity(signals)
        };
      })
      .filter(queueItem => queueItem.signals.length > 0);

    this.supportQueue = { ...this.supportQueue, items };
  }

  private highestSeverity(signals: SupportSignal[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (signals.some(signal => signal.severity === 'HIGH')) return 'HIGH';
    if (signals.some(signal => signal.severity === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  trackBreakdown(_: number, item: SchoolBreakdownItem): string {
    return item.label;
  }

  trackQueueItem(_: number, item: SupportQueueItem): string {
    return item.studentUserId;
  }

  trackRosterItem(_: number, item: SchoolStudentRosterItem): string {
    return item.studentUserId;
  }
}
