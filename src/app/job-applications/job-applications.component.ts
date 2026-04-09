import { Component, OnInit, HostListener, PLATFORM_ID, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import { ApiService, CvName, JobApplication, PendingAction, EmailTestResponse, PostApplicationInsight, PostApplicationInsightResult } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { FlatpickrDirective } from '../shared/flatpickr.directive';

const STATUSES = ['Referral Received', 'Applied', 'Interview', 'Offer', 'Rejected'];

@Component({
  selector: 'app-job-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, FlatpickrDirective, KeyValuePipe],
  templateUrl: './job-applications.component.html',
  styleUrl: './job-applications.component.scss'
})
export class JobApplicationsComponent implements OnInit {
  jobApplications: JobApplication[] = [];
  private pendingActions: PendingAction[] = [];
  expandedUpdatesIds = new Set<string>();
  expandedActionIds = new Set<string>();
  notesPopover: { id: string; top: number; left: number; draft: string } | null = null;
  timelineApp: JobApplication | null = null;
  roleCategories: string[] = [];
  cvNames: CvName[] = [];
  loading = false;

  searchQuery = '';
  filterStatus: string | null = null;
  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';

  editingCell: { id: string; field: string; originalValue: string } | null = null;
  statusDropdown: { id: string; top: number; left: number } | null = null;
  categoryDropdown: { id: string; top: number; left: number } | null = null;
  cvDropdown: { id: string; top: number; left: number } | null = null;
  cvUploadingId: string | null = null;
  savedRows = new Set<string>();
  errorRows = new Set<string>();
  savingRows = new Set<string>();
  deletingRows = new Set<string>();

  showAddModal = false;
  addForm = { company: '', jobTitle: '', roleCategory: '' };
  addFormTouched = false;
  addSaving = false;

  jdModal: { app: JobApplication } | null = null;
  jdForm = { url: '', text: '' };
  jdFormError: string | null = null;

  @ViewChild('cvFileInput') cvFileInput!: ElementRef<HTMLInputElement>;

  readonly statuses = STATUSES;
  isBrowser = false;

  // ── Email Test tab ───────────────────────────────────────
  activeTab: 'applications' | 'emailTest' = 'applications';
  emailForm = { subject: '', sender: '', body: '' };
  emailLoading = false;
  emailError: string | null = null;
  emailResult: EmailTestResponse | null = null;

  // ── Post-application fit check ────────────────────────────
  runningFitIds = new Set<string>();
  loadingInsightId: string | null = null;
  insightModal: { app: JobApplication; result: PostApplicationInsightResult | null; isStreaming: boolean } | null = null;

  constructor(
    private apiService: ApiService,
    private toastService: ToastService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadData();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.statusDropdown = null;
    this.categoryDropdown = null;
    this.cvDropdown = null;
    this.timelineApp = null;
    this.notesPopover = null;
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      apps: this.apiService.getJobApplications().pipe(catchError(() => of([]))),
      actions: this.apiService.getPendingActions().pipe(catchError(() => of([]))),
      categories: this.apiService.getRoleCategories().pipe(catchError(() => of([]))),
      cvNames: this.apiService.getCvNames().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ apps, actions, categories, cvNames }) => {
        this.jobApplications = apps.sort((a, b) =>
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        this.pendingActions = actions;
        this.roleCategories = categories.map(c => c.name);
        this.cvNames = cvNames;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  get filteredApps(): JobApplication[] {
    let apps = [...this.jobApplications];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      apps = apps.filter(a =>
        a.company?.toLowerCase().includes(q) ||
        a.jobTitle?.toLowerCase().includes(q) ||
        a.recruiterName?.toLowerCase().includes(q)
      );
    }

    if (this.filterStatus) {
      apps = apps.filter(a => a.applicationStatus === this.filterStatus);
    }

    if (this.sortField) {
      apps.sort((a, b) => {
        const av: string = (a as any)[this.sortField] || '';
        const bv: string = (b as any)[this.sortField] || '';
        const cmp = av.localeCompare(bv);
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return apps;
  }

  getPendingAction(app: JobApplication): PendingAction | undefined {
    return this.pendingActions.find(a => a.jobApplicationId === app.id);
  }

  getAppById(id: string): JobApplication | undefined {
    return this.jobApplications.find(a => a.id === id);
  }

  // ── Sort ────────────────────────────────────────────────
  setSort(field: string): void {
    if (this.sortField === field) {
      if (this.sortDir === 'asc') this.sortDir = 'desc';
      else this.sortField = '';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  // ── Filter ──────────────────────────────────────────────
  toggleFilter(status: string): void {
    this.filterStatus = this.filterStatus === status ? null : status;
  }

  // ── Inline edit ─────────────────────────────────────────
  startEdit(id: string, field: string, event: MouseEvent, currentValue: string = ''): void {
    event.stopPropagation();
    this.statusDropdown = null;
    this.editingCell = { id, field, originalValue: currentValue };
  }

  isEditing(id: string, field: string): boolean {
    return this.editingCell?.id === id && this.editingCell?.field === field;
  }

  finishEdit(app: JobApplication): void {
    const original = this.editingCell?.originalValue;
    const field = this.editingCell?.field;
    this.editingCell = null;
    if (field && (app as any)[field] !== original) {
      this.onFieldChange(app);
    }
  }

  // ── Category dropdown ────────────────────────────────────
  openCategoryMenu(app: JobApplication, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCell = null;
    this.statusDropdown = null;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.categoryDropdown = this.categoryDropdown?.id === app.id
      ? null
      : { id: app.id!, top: rect.bottom + 4, left: rect.left };
  }

  selectCategory(app: JobApplication, category: string): void {
    const original = app.roleCategory;
    app.roleCategory = category || undefined;
    this.categoryDropdown = null;
    if (app.roleCategory !== original) {
      this.onFieldChange(app);
    }
  }

  // ── Status dropdown ─────────────────────────────────────
  openStatusMenu(app: JobApplication, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCell = null;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (this.statusDropdown?.id === app.id) {
      this.statusDropdown = null;
    } else {
      this.statusDropdown = { id: app.id!, top: rect.bottom + 4, left: rect.left };
    }
  }

  selectStatus(app: JobApplication, status: string): void {
    app.applicationStatus = status;
    if (status !== 'Interview') {
      app.interviewDate = null;
    }
    this.onFieldChange(app);
    this.statusDropdown = null;
  }

  // ── CV dropdown ──────────────────────────────────────────
  openCvMenu(app: JobApplication, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCell = null;
    this.statusDropdown = null;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.cvDropdown = this.cvDropdown?.id === app.id
      ? null
      : { id: app.id!, top: rect.bottom + 4, left: rect.left };
  }

  selectCv(app: JobApplication, cvId: string): void {
    app.cvId = cvId || undefined;
    this.onFieldChange(app, true);
    this.cvDropdown = null;
  }

  triggerCvUpload(appId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.cvUploadingId = appId;
    this.cvFileInput.nativeElement.value = '';
    this.cvFileInput.nativeElement.click();
  }

  onCvFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.cvUploadingId) return;
    const app = this.getAppById(this.cvUploadingId);
    if (!app) return;
    this.apiService.uploadCv(file).subscribe({
      next: (cv) => {
        this.cvNames = [...this.cvNames, { id: cv.id, name: cv.name, isDefaultCv: false }];
        app.cvId = cv.id;
        this.onFieldChange(app, true);
        this.cvDropdown = null;
        this.cvUploadingId = null;
        this.toastService.show(`CV "${cv.name}" uploaded & attached`, 'info');
      },
      error: () => {
        this.toastService.show('CV upload failed', 'info');
        this.cvUploadingId = null;
      }
    });
  }

  // ── Action expand ────────────────────────────────────────
  toggleAction(id: string): void {
    if (this.expandedActionIds.has(id)) {
      this.expandedActionIds.delete(id);
    } else {
      this.expandedActionIds.add(id);
    }
  }

  getActionLabel(action: PendingAction): string {
    if (action.actionType === 'FOLLOW_UP_REFERRAL') return 'Referral Action';
    if (action.actionType === 'STALE_APPLICATION') {
      const app = this.getAppById(action.jobApplicationId);
      if (app?.updatedAt) {
        const days = Math.floor((Date.now() - new Date(app.updatedAt).getTime()) / 86_400_000);
        return `Stale (${days}D)`;
      }
      return 'Stale';
    }
    return 'Action Required';
  }

  getActionIcon(action: PendingAction): string {
    if (action.actionType === 'FOLLOW_UP_REFERRAL') return '⚠';
    return '⏱';
  }

  // ── Notes popover ────────────────────────────────────────
  openNotesPopover(app: JobApplication, event: MouseEvent): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (this.notesPopover?.id === app.id) {
      this.notesPopover = null;
      return;
    }
    this.notesPopover = { id: app.id!, top: rect.bottom + 6, left: rect.left - 252, draft: app.notes ?? '' };
  }

  saveNotesFromPopover(app: JobApplication): void {
    if (!this.notesPopover) return;
    app.notes = this.notesPopover.draft;
    this.notesPopover = null;
    this.onFieldChange(app);
  }

  // ── Updates expand ───────────────────────────────────────
  toggleUpdates(id: string): void {
    const app = this.getAppById(id);
    this.timelineApp = this.timelineApp?.id === id ? null : (app ?? null);
  }

  // ── Helpers ──────────────────────────────────────────────
  getInitials(name: string | undefined): string {
    if (!name?.trim()) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  }

  getCvName(cvId: string | undefined): string {
    if (!cvId) return '';
    return this.cvNames.find(c => c.id === cvId)?.name ?? '';
  }

  getStatusClass(status: string | undefined): string {
    return 'status-' + (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  toLocalDatetime(val: string | null | undefined): string {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  formatDisplayDate(val: string | null | undefined): string {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  onDateChange(app: JobApplication, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    app.interviewDate = val ? new Date(val).toISOString() : null;
    this.finishEdit(app);
  }

  onFlatpickrChange(app: JobApplication, isoValue: string | null): void {
    app.interviewDate = isoValue;
  }

  onFieldChange(app: JobApplication, affectsFit = false): void {
    if (!app.id) return;
    const id = app.id;
    this.errorRows.delete(id);
    this.savingRows.add(id);
    this.apiService.updateJobApplication(id, app).subscribe({
      next: (updated) => {
        app.updatedAt = updated.updatedAt;
        if (affectsFit && app.fitSummary) {
          app.fitSummary = { ...app.fitSummary, isStale: true };
        }
        this.savingRows.delete(id);
        this.savedRows.add(id);
        this.toastService.show('Changes saved', 'success', 2000);
        setTimeout(() => this.savedRows.delete(id), 1800);
      },
      error: () => {
        this.savingRows.delete(id);
        this.errorRows.add(id);
        this.toastService.show('Failed to save — please try again', 'error', 3000);
        setTimeout(() => this.errorRows.delete(id), 3000);
      }
    });
  }

  // ── Add modal ────────────────────────────────────────────
  addRow(): void {
    this.addForm = { company: '', jobTitle: '', roleCategory: '' };
    this.addFormTouched = false;
    this.showAddModal = true;
  }

  get addFormValid(): boolean {
    return !!this.addForm.company.trim() && !!this.addForm.jobTitle.trim() && !!this.addForm.roleCategory;
  }

  submitNewApp(): void {
    this.addFormTouched = true;
    if (!this.addFormValid) return;
    this.addSaving = true;
    const newApp: JobApplication = {
      company: this.addForm.company.trim(),
      jobTitle: this.addForm.jobTitle.trim(),
      recruiterName: '',
      roleCategory: this.addForm.roleCategory,
      applicationStatus: 'Applied',
      interviewDate: null
    };
    this.apiService.createJobApplication(newApp).subscribe({
      next: (created) => {
        this.jobApplications = [created, ...this.jobApplications];
        this.addSaving = false;
        this.showAddModal = false;
      },
      error: () => {
        this.addSaving = false;
      }
    });
  }

  deleteRow(app: JobApplication): void {
    if (!app.id) return;
    const id = app.id;
    this.deletingRows.add(id);
    this.apiService.deleteJobApplication(id).subscribe({
      next: () => {
        this.deletingRows.delete(id);
        this.jobApplications = this.jobApplications.filter(r => r.id !== id);
        this.pendingActions = this.pendingActions.filter(a => a.jobApplicationId !== id);
        this.toastService.show('Application deleted', 'info');
      },
      error: () => {
        this.deletingRows.delete(id);
        this.toastService.show('Failed to delete — please try again', 'error', 3000);
      }
    });
  }

  handleYes(action: PendingAction): void {
    const app = this.jobApplications.find(a => a.id === action.jobApplicationId);
    if (!app) return;
    app.applicationStatus = action.suggestedStatus;
    this.apiService.updateJobApplication(app.id!, app).subscribe({
      next: () => {
        this.pendingActions = this.pendingActions.filter(a => a.jobApplicationId !== action.jobApplicationId);
        this.expandedActionIds.delete(action.jobApplicationId);
      }
    });
  }

  handleRemindLater(action: PendingAction): void {
    this.apiService.snoozeJobApplication(action.jobApplicationId, action.snoozeDays).subscribe({
      next: () => {
        this.pendingActions = this.pendingActions.filter(a => a.jobApplicationId !== action.jobApplicationId);
        this.expandedActionIds.delete(action.jobApplicationId);
      }
    });
  }

  handleDeleteRecord(action: PendingAction): void {
    this.apiService.deleteJobApplication(action.jobApplicationId).subscribe({
      next: () => {
        this.jobApplications = this.jobApplications.filter(a => a.id !== action.jobApplicationId);
        this.pendingActions = this.pendingActions.filter(a => a.jobApplicationId !== action.jobApplicationId);
        this.expandedActionIds.delete(action.jobApplicationId);
        this.toastService.show('Application deleted', 'info');
      }
    });
  }

  // ── JD Modal ─────────────────────────────────────────────
  openJdModal(app: JobApplication, event: MouseEvent): void {
    event.stopPropagation();
    this.jdForm = { url: app.jobDescriptionUrl || '', text: app.jobDescriptionText || '' };
    this.jdFormError = null;
    this.jdModal = { app };
  }

  saveJd(): void {
    if (!this.jdModal) return;
    if (!this.jdForm.text.trim()) {
      this.jdFormError = 'Job description text is required.';
      return;
    }
    const app = this.jdModal.app;
    app.jobDescriptionUrl = this.jdForm.url.trim() || undefined;
    app.jobDescriptionText = this.jdForm.text.trim();
    this.jdModal = null;
    this.jdFormError = null;
    this.onFieldChange(app, true);
  }

  clearJd(): void {
    if (!this.jdModal) return;
    const app = this.jdModal.app;
    app.jobDescriptionUrl = undefined;
    app.jobDescriptionText = undefined;
    this.jdModal = null;
    this.onFieldChange(app, true);
  }

  hasJd(app: JobApplication): boolean {
    return !!(app.jobDescriptionUrl || app.jobDescriptionText);
  }

  canRunFit(app: JobApplication): boolean {
    return !!app.cvId && !!app.jobDescriptionText?.trim();
  }

  // ── Post-application fit check ────────────────────────────
  fitCheck(app: JobApplication): void {
    if (!app.id || !this.canRunFit(app)) return;
    this.streamPostMatch(app);
  }

  private streamPostMatch(app: JobApplication): void {
    if (!app.id) return;
    this.runningFitIds.add(app.id);
    this.insightModal = { app, result: null, isStreaming: true };
    let streamText = '';

    this.apiService.runPostMatch(app.id).subscribe({
      next: (chunk) => {
        streamText += chunk;
        const partial = this.tryParsePartialInsight(streamText);
        if (partial && this.insightModal) {
          let isStreaming = true;
          try {
            JSON.parse(streamText);
            isStreaming = false;
          } catch { /* still incomplete */ }
          this.insightModal = { ...this.insightModal, result: { insight: partial, isStale: false }, isStreaming };
        }
      },
      error: () => {
        this.runningFitIds.delete(app.id!);
        this.insightModal = null;
      },
      complete: () => {
        this.runningFitIds.delete(app.id!);
        try {
          const insight = JSON.parse(streamText) as PostApplicationInsight;
          app.fitSummary = { fitScore: insight.fitScore, isStale: false };
          this.insightModal = { app, result: { insight, isStale: false }, isStreaming: false };
        } catch {
          if (this.insightModal) {
            this.insightModal = { ...this.insightModal, isStreaming: false };
          }
        }
      }
    });
  }

  openInsightModal(app: JobApplication): void {
    if (!app.id) return;
    this.loadingInsightId = app.id;
    this.apiService.getPostMatch(app.id).subscribe({
      next: (result) => {
        app.fitSummary = { fitScore: result.insight.fitScore, isStale: result.isStale };
        this.loadingInsightId = null;
        this.insightModal = { app, result, isStreaming: false };
      },
      error: () => { this.loadingInsightId = null; }
    });
  }

  private tryParsePartialInsight(text: string): PostApplicationInsight | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let json = text.substring(start).replace(/,\s*$/, '');
    const stack: string[] = [];
    let inString = false, escaped = false;
    for (const ch of json) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    if (inString) json += '"';
    json = json.replace(/,?\s*"[^"]*"\s*:\s*$/, '');
    while (stack.length) json += stack.pop();
    try { return JSON.parse(json) as PostApplicationInsight; } catch { return null; }
  }

  rerunFitCheck(): void {
    if (!this.insightModal) return;
    const app = this.insightModal.app;
    this.insightModal = null;
    this.streamPostMatch(app);
  }

  getFitScoreColor(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 70) return '#0d9488';
    if (score >= 60) return '#ea580c';
    return '#dc2626';
  }

  getFitScoreBg(score: number): string {
    if (score >= 80) return '#dcfce7';
    if (score >= 70) return '#ccfbf1';
    if (score >= 60) return '#ffedd5';
    return '#fee2e2';
  }

  getPriorityClass(priority: 'High' | 'Medium' | 'Low'): string {
    return 'priority-' + priority.toLowerCase();
  }

  // ── Email Test ───────────────────────────────────────────
  processEmail(): void {
    if (!this.emailForm.subject.trim() && !this.emailForm.sender.trim() && !this.emailForm.body.trim()) return;
    this.emailLoading = true;
    this.emailError = null;
    this.emailResult = null;
    this.apiService.processEmailTest({
      subject: this.emailForm.subject,
      sender: this.emailForm.sender,
      body: this.emailForm.body
    }).subscribe({
      next: (result) => {
        this.emailResult = result;
        this.emailLoading = false;
      },
      error: () => {
        this.emailError = 'Request failed. Please check your inputs and try again.';
        this.emailLoading = false;
      }
    });
  }

  formatFieldKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const suffix = (() => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th';
      }
    })();
    return `${day}${suffix} ${date.toLocaleString('en-US', { month: 'long' })}, ${date.getFullYear()}`;
  }
}
