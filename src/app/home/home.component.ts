import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  ApiService,
  CvName,
  MatchResult,
  StrengthItem,
  GapItem,
  AdjustmentItem,
  FitRequirement,
  RequirementEvidence,
  AdjustmentStatePayload
} from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, MarkdownStorage } from 'tiptap-markdown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  cvNames: CvName[] = [];
  selectedCvId: string | null = null;
  cvText = '';
  jobTitle = '';
  companyName = '';
  roleCategory = '';
  roleCategories: string[] = [];
  loadingRoleCategories = false;
  jobDescription = '';
  matchResult: MatchResult | null = null;
  streamingComplete = false;
  streamingStage = 'Preparing analysis';
  fitAnalysisId: string | null = null;
  applicationId: string | null = null;
  markingApplied = false;
  previousFitScore: number | null = null;
  scoreDelta: number | null = null;
  loadingCvNames = false;
  loadingCvText = false;
  loadingMatch = false;
  private awaitingAuthoritativeResult = false;
  uploadingCv = false;
  showCvDropdown = false;

  gmailConnected = false;
  gmailNeedsReconnect = false;
  outlookConnected = false;
  checkingGmail = true;
  checkingOutlook = true;

  // CV editor
  cvEditor: Editor | null = null;
  cvHasMarkdown = false;
  cvEditorDirty = false;
  savingCv = false;
  downloadingDocx = false;

  // Focus mode
  focusMode = false;
  focusModeTab: 'adjustments' | 'jd' = 'adjustments';
  adjustmentStates: Record<string, AdjustmentStatePayload> = {};
  cumulativeStates: Record<string, AdjustmentStatePayload> = {};

  // Dirty tracking
  jdDirty = false;
  get analysisDirty(): boolean { return this.jdDirty || this.cvEditorDirty; }

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('resultsSection') resultsSection?: ElementRef;
  @ViewChild('cvEditorEl') cvEditorEl?: ElementRef<HTMLDivElement>;
  @ViewChild('focusCvEditorEl') focusCvEditorEl?: ElementRef<HTMLDivElement>;

  private readonly ADD_CV_VALUE = '__add_cv__';

  userName = '';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.userName = this.authService.getUserName();
  }

  ngOnDestroy(): void {
    this.cvEditor?.destroy();
  }

  get emailConnected(): boolean {
    return this.gmailConnected || this.outlookConnected;
  }

  get checkingEmail(): boolean {
    return this.checkingGmail || this.checkingOutlook;
  }

  ngOnInit(): void {
    this.loadCvNames();
    this.loadRoleCategories();
    this.checkEmailStatus();
    const gmailParam = this.route.snapshot.queryParamMap.get('gmail');
    const outlookParam = this.route.snapshot.queryParamMap.get('outlook');
    if (gmailParam === 'connected') {
      this.toastService.show('Gmail connected successfully', 'success');
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    } else if (gmailParam === 'error') {
      this.toastService.show('Failed to connect Gmail — please try again', 'error');
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
    if (outlookParam === 'connected') {
      this.toastService.show('Outlook connected successfully', 'success');
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    } else if (outlookParam === 'error') {
      this.toastService.show('Failed to connect Outlook — please try again', 'error');
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  checkEmailStatus(): void {
    this.apiService.getGmailStatus().subscribe({
      next: (res) => {
        this.gmailConnected = res.connected;
        this.gmailNeedsReconnect = res.status === 'REAUTH_REQUIRED';
        if (this.gmailNeedsReconnect) {
          this.toastService.show('Gmail needs to be reconnected', 'error');
        }
        this.checkingGmail = false;
      },
      error: () => { this.checkingGmail = false; }
    });
    this.apiService.getOutlookStatus().subscribe({
      next: (res) => { this.outlookConnected = res.connected; this.checkingOutlook = false; },
      error: () => { this.checkingOutlook = false; }
    });
  }

  connectGmail(): void {
    this.apiService.getGmailConnectUrl().subscribe({
      next: (res) => window.location.href = res.url,
      error: () => {}
    });
  }

  connectOutlook(): void {
    this.apiService.getOutlookConnectUrl().subscribe({
      next: (res) => window.location.href = res.url,
      error: () => {}
    });
  }

  loadCvNames(): void {
    this.loadingCvNames = true;
    this.apiService.getCvNames().subscribe({
      next: (names) => {
        this.cvNames = names;
        const isDefaultCv = names.find(c => c.isDefaultCv);
        if (isDefaultCv) {
          this.selectedCvId = isDefaultCv.id;
          this.onCvSelect();
        }
        this.loadingCvNames = false;
      },
      error: () => {
        this.loadingCvNames = false;
      }
    });
  }

  loadRoleCategories(): void {
    this.loadingRoleCategories = true;
    forkJoin({
      categories: this.apiService.getRoleCategories(),
      preferences: this.apiService.getPreferences()
    }).subscribe({
      next: ({ categories, preferences }) => {
        const saved = preferences.preferredRoleCategories || [];
        this.roleCategories = [...new Set([
          ...saved,
          ...categories.map(category => category.name)
        ])].sort((a, b) => a.localeCompare(b));
        this.loadingRoleCategories = false;
      },
      error: () => { this.loadingRoleCategories = false; }
    });
  }

  onCvSelect(): void {
    if (this.selectedCvId === this.ADD_CV_VALUE) {
      this.selectedCvId = null;
      this.fileInput.nativeElement.click();
      return;
    }
    if (this.selectedCvId === null) {
      this.cvText = '';
      this.cvEditor?.destroy();
      this.cvEditor = null;
      return;
    }
    this.loadingCvText = true;
    this.cvEditorDirty = false;
    this.cvEditor?.destroy();
    this.cvEditor = null;

    if (this.selectedCvIsPdf) {
      this.apiService.getCvText(this.selectedCvId).subscribe({
        next: (text) => {
          this.cvHasMarkdown = false;
          this.cvText = text;
          this.loadingCvText = false;
        },
        error: () => { this.loadingCvText = false; }
      });
      return;
    }

    this.apiService.getCvMarkdown(this.selectedCvId).subscribe({
      next: (markdown) => {
        this.cvHasMarkdown = true;
        this.cvText = markdown;
        this.loadingCvText = false;
        this.initCvEditor(markdown);
      },
      error: () => {
        this.apiService.getCvText(this.selectedCvId!).subscribe({
          next: (text) => {
            this.cvHasMarkdown = false;
            this.cvText = text;
            this.loadingCvText = false;
            this.initCvEditor(text);
          },
          error: () => { this.loadingCvText = false; }
        });
      }
    });
  }

  private createEditorOn(element: HTMLDivElement, content: string): void {
    this.cvEditor = new Editor({
      element,
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, tightLists: true, breaks: true })
      ],
      content: '',
      onUpdate: () => { this.cvEditorDirty = true; }
    });
    if (this.cvHasMarkdown) {
      this.cvEditor.commands.setContent(content);
    } else {
      this.cvEditor.commands.setContent(`<pre>${content}</pre>`);
    }
    // setContent triggers onUpdate — reset so initial load doesn't count as a change
    this.cvEditorDirty = false;
  }

  private initCvEditor(content: string): void {
    this.cvEditor?.destroy();
    this.cvEditor = null;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (!this.cvEditorEl?.nativeElement) return;
      this.createEditorOn(this.cvEditorEl.nativeElement, content);
    });
  }

  getCvContent(): string {
    if (!this.cvEditor) return this.cvText;
    const storage = this.cvEditor.storage as unknown as Record<string, MarkdownStorage>;
    return storage['markdown'].getMarkdown();
  }

  enterFocusMode(): void {
    const content = this.getCvContent();
    const wasDirty = this.cvEditorDirty;
    this.cvText = content;
    this.cvHasMarkdown = true;
    this.cvEditor?.destroy();
    this.cvEditor = null;
    this.focusMode = true;
    this.focusModeTab = 'adjustments';
    this.cdr.detectChanges();
    setTimeout(() => {
      if (!this.focusCvEditorEl?.nativeElement) return;
      this.createEditorOn(this.focusCvEditorEl.nativeElement, content);
      this.cvEditorDirty = wasDirty;
    });
  }

  exitFocusMode(): void {
    const content = this.getCvContent();
    const wasDirty = this.cvEditorDirty;
    this.cvText = content;
    this.cvHasMarkdown = true;
    this.cvEditor?.destroy();
    this.cvEditor = null;
    this.focusMode = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (!this.cvEditorEl?.nativeElement) return;
      this.createEditorOn(this.cvEditorEl.nativeElement, content);
      this.cvEditorDirty = wasDirty;
    });
  }

  private adjStateKey(item: AdjustmentItem): string {
    return item.cvPoint ?? item.adjustment;
  }

  markAdjustment(item: AdjustmentItem, status: 'applied' | 'dismissed'): void {
    const key = this.adjStateKey(item);
    if (this.adjustmentStates[key]?.state === status) {
      delete this.adjustmentStates[key];
    } else {
      this.adjustmentStates[key] = {
        state: status,
        cvPoint: item.cvPoint,
        suggestedText: item.suggestedText,
        adjustment: item.adjustment
      };
    }
  }

  getAdjustmentState(item: AdjustmentItem): 'applied' | 'dismissed' | 'pending' {
    return this.adjustmentStates[this.adjStateKey(item)]?.state ?? 'pending';
  }

  getPendingAdjustmentsCount(): number {
    const total = this.getSortedAdjustments().length;
    const done = Object.keys(this.adjustmentStates).length;
    return Math.max(0, total - done);
  }

  saveCv(): void {
    if (!this.cvEditor || !this.selectedCvId) return;
    this.savingCv = true;
    const markdown = this.getCvContent();
    this.cvText = markdown;
    this.apiService.updateCvContent(this.selectedCvId, markdown).subscribe({
      next: () => {
        this.savingCv = false;
        this.cvEditorDirty = false;
        this.cvHasMarkdown = true;
        this.toastService.show('CV saved', 'success');
      },
      error: () => {
        this.savingCv = false;
        this.toastService.show('Failed to save CV', 'error');
      }
    });
  }

  saveAndReAnalyze(): void {
    if (!this.cvEditor || !this.selectedCvId) return;
    this.savingCv = true;
    const markdown = this.getCvContent();
    this.cvText = markdown;
    // Exit focus mode before re-analysis so results are visible
    if (this.focusMode) {
      this.cvEditor?.destroy();
      this.cvEditor = null;
      this.cvHasMarkdown = true;
      this.focusMode = false;
      this.cdr.detectChanges();
      setTimeout(() => {
        if (this.cvEditorEl?.nativeElement) {
          this.createEditorOn(this.cvEditorEl.nativeElement, markdown);
        }
      });
    }
    this.apiService.updateCvContent(this.selectedCvId, markdown).subscribe({
      next: () => {
        this.savingCv = false;
        this.cvEditorDirty = false;
        this.cvHasMarkdown = true;
        this.runReanalyze();
      },
      error: () => {
        this.savingCv = false;
        this.toastService.show('Failed to save CV', 'error');
      }
    });
  }

  isCvEditorActive(name: string, attrs?: Record<string, unknown>): boolean {
    return this.cvEditor?.isActive(name, attrs) ?? false;
  }

  toggleCvBold(): void { this.cvEditor?.chain().focus().toggleBold().run(); }
  toggleCvItalic(): void { this.cvEditor?.chain().focus().toggleItalic().run(); }
  toggleCvH1(): void { this.cvEditor?.chain().focus().toggleHeading({ level: 1 }).run(); }
  toggleCvH2(): void { this.cvEditor?.chain().focus().toggleHeading({ level: 2 }).run(); }
  toggleCvH3(): void { this.cvEditor?.chain().focus().toggleHeading({ level: 3 }).run(); }
  toggleCvBulletList(): void { this.cvEditor?.chain().focus().toggleBulletList().run(); }
  toggleCvOrderedList(): void { this.cvEditor?.chain().focus().toggleOrderedList().run(); }

  downloadCvDocx(): void {
    if (!this.cvEditor || !this.selectedCvId) return;
    this.downloadingDocx = true;
    const storage = this.cvEditor.storage as unknown as Record<string, MarkdownStorage>;
    const markdown = storage['markdown'].getMarkdown();
    const lines = markdown.split('\n');
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (line.startsWith('### ')) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith('# ')) {
        children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
      } else if (line.startsWith('- ')) {
        children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
      } else if (line.trim() === '') {
        children.push(new Paragraph({ text: '' }));
      } else {
        const runs: TextRun[] = [];
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else {
            runs.push(new TextRun({ text: part }));
          }
        }
        children.push(new Paragraph({ children: runs }));
      }
    }

    const cvName = this.cvNames.find(c => c.id === this.selectedCvId)?.name ?? 'cv';
    const doc = new Document({ sections: [{ children }] });
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${cvName.replace(/\.[^.]+$/, '')}.docx`);
      this.downloadingDocx = false;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCv = true;
    this.cvText = '';
    this.apiService.uploadCv(file).subscribe({
      next: (cv) => {
        this.cvNames.push({ id: cv.id, name: cv.name, isDefaultCv: false });
        this.selectedCvId = cv.id;
        this.uploadingCv = false;
        this.onCvSelect();
      },
      error: () => {
        this.uploadingCv = false;
      }
    });

    // Reset so the same file can be re-selected
    input.value = '';
  }

  onMatch(): void {
    if (this.selectedCvId === null || !this.jobTitle.trim() || !this.companyName.trim()
      || !this.roleCategory.trim() || !this.jobDescription.trim()) {
      return;
    }
    this.loadingMatch = true;
    this.awaitingAuthoritativeResult = false;
    this.matchResult = null;
    this.fitAnalysisId = null;
    this.streamingComplete = false;
    this.streamingStage = 'Preparing analysis';
    this.applicationId = null;
    this.markingApplied = false;
    this.scoreDelta = null;
    this.adjustmentStates = {};
    this.cumulativeStates = {};
    this.jdDirty = false;
    this.cvEditorDirty = false;

    setTimeout(() => {
      this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    this.apiService.matchCvToJob(this.selectedCvId, this.jobDescription, this.jobTitle, this.companyName, this.roleCategory).subscribe({
      next: (chunk) => {
        if (chunk.startsWith('[SAVED:')) {
          const savedId = chunk.slice(7, -1);
          this.fitAnalysisId = savedId;
          this.awaitingAuthoritativeResult = true;
          this.loadAuthoritativeResult(savedId);
          return;
        }
        if (this.isFitStreamError(chunk)) {
          this.loadingMatch = false;
          this.streamingComplete = true;
          this.toastService.show('Fit analysis could not be completed. Please try again.', 'error');
          return;
        }
        this.applyStreamEvent(chunk);
      },
      error: () => { this.loadingMatch = false; },
      complete: () => {
        if (this.awaitingAuthoritativeResult) {
          this.streamingStage = 'Loading saved analysis';
          return;
        }
        this.streamingComplete = true;
        this.streamingStage = 'Finalizing analysis';
        this.loadingMatch = false;
      }
    });
  }

  runReanalyze(): void {
    if (!this.fitAnalysisId) { this.onMatch(); return; }
    if (this.cvEditorDirty && this.cvEditor && this.selectedCvId) {
      this.saveAndReAnalyze();
      return;
    }
    const analysisId = this.fitAnalysisId;
    this.previousFitScore = this.matchResult?.fitScore ?? null;

    Object.assign(this.cumulativeStates, this.adjustmentStates);
    const states = Object.values(this.cumulativeStates);

    this.loadingMatch = true;
    this.awaitingAuthoritativeResult = false;
    this.matchResult = null;
    this.streamingComplete = false;
    this.streamingStage = 'Preparing updated analysis';
    this.scoreDelta = null;
    this.adjustmentStates = {};
    this.jdDirty = false;
    this.cvEditorDirty = false;

    setTimeout(() => {
      this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    this.apiService.reanalyze(analysisId, states.length ? states : undefined, {
      cvId: this.selectedCvId!,
      jobDescription: this.jobDescription,
      jobTitle: this.jobTitle,
      companyName: this.companyName,
      roleCategory: this.roleCategory
    }).subscribe({
      next: (chunk) => {
        if (chunk.startsWith('[SAVED:')) {
          const savedId = chunk.slice(7, -1);
          this.fitAnalysisId = savedId;
          this.awaitingAuthoritativeResult = true;
          this.loadAuthoritativeResult(savedId, this.previousFitScore);
          return;
        }
        if (this.isFitStreamError(chunk)) {
          this.loadingMatch = false;
          this.streamingComplete = true;
          this.toastService.show('Updated fit analysis could not be completed. Please try again.', 'error');
          return;
        }
        this.applyStreamEvent(chunk);
      },
      error: () => { this.loadingMatch = false; },
      complete: () => {
        if (this.awaitingAuthoritativeResult) {
          this.streamingStage = 'Loading saved analysis';
          return;
        }
        this.streamingComplete = true;
        this.streamingStage = 'Finalizing analysis';
        this.loadingMatch = false;
      }
    });
  }

  private loadAuthoritativeResult(id: string, previousScore: number | null = null): void {
    this.apiService.getFitAnalysis(id).subscribe({
      next: (result) => {
        this.awaitingAuthoritativeResult = false;
        this.matchResult = result;
        this.streamingComplete = true;
        this.streamingStage = 'Analysis complete';
        this.loadingMatch = false;
        if (previousScore !== null && result.fitScore != null) {
          this.scoreDelta = result.fitScore - previousScore;
        }
      },
      error: () => {
        this.awaitingAuthoritativeResult = false;
        this.loadingMatch = false;
        this.toastService.show('The analysis was saved but could not be loaded', 'error');
      }
    });
  }

  markAsApplied(): void {
    if (!this.fitAnalysisId || this.markingApplied || this.applicationId) return;

    this.markingApplied = true;
    this.apiService.markFitAnalysisAsApplied(this.fitAnalysisId, this.roleCategory).subscribe({
      next: (application) => {
        this.applicationId = application.id ?? null;
        this.markingApplied = false;
        this.toastService.show('Application marked as applied', 'success');
      },
      error: () => {
        this.markingApplied = false;
        this.toastService.show('Could not mark this application as applied', 'error');
      }
    });
  }

  onNewAnalysis(): void {
    this.jobTitle = '';
    this.companyName = '';
    this.roleCategory = '';
    this.jobDescription = '';
    this.matchResult = null;
    this.fitAnalysisId = null;
    this.applicationId = null;
    this.markingApplied = false;
    this.streamingComplete = false;
    this.awaitingAuthoritativeResult = false;
    this.streamingStage = 'Preparing analysis';
    this.scoreDelta = null;
    this.previousFitScore = null;
    this.adjustmentStates = {};
    this.cumulativeStates = {};
    this.jdDirty = false;
  }

  get showResults(): boolean {
    return this.loadingMatch || !!this.matchResult;
  }

  onCvDropdownBlur(): void {
    setTimeout(() => this.showCvDropdown = false, 150);
  }

  selectCvFromDropdown(id: string): void {
    if (id === this.ADD_CV_VALUE) {
      this.showCvDropdown = false;
      this.fileInput.nativeElement.click();
      return;
    }
    if (id !== this.selectedCvId && this.fitAnalysisId) {
      this.cvEditorDirty = true;
    }
    this.selectedCvId = id;
    this.showCvDropdown = false;
    this.onCvSelect();
  }

  getSelectedCvName(): string {
    if (!this.selectedCvId) return 'Select a CV';
    return this.cvNames.find(c => c.id === this.selectedCvId)?.name || 'Select a CV';
  }

  get selectedCvIsPdf(): boolean {
    const name = this.cvNames.find(c => c.id === this.selectedCvId)?.name ?? '';
    return name.toLowerCase().endsWith('.pdf');
  }

  getScoreGradient(): string {
    const score = this.matchResult?.fitScore || 0;
    const color = score >= 80 ? '#16a34a' : score >= 70 ? '#0d9488' : score >= 60 ? '#ea580c' : '#dc2626';
    return `conic-gradient(${color} ${score}%, #e5e7eb 0%)`;
  }

  getScoreColor(): string {
    const score = this.matchResult?.fitScore || 0;
    if (score >= 80) return '#16a34a';
    if (score >= 70) return '#0d9488';
    if (score >= 60) return '#ea580c';
    return '#dc2626';
  }

  getScoreCategory(): string {
    const score = this.matchResult?.fitScore ?? 0;
    if (score >= 80) return 'high';
    if (score >= 70) return 'good';
    if (score >= 60) return 'med';
    return 'low';
  }

  getScoreDescription(): string {
    const score = this.matchResult?.fitScore ?? 0;
    if (score >= 80) return 'Great match for this role';
    if (score >= 70) return 'Strong fit with minor gaps';
    if (score >= 60) return 'Some gaps to bridge';
    return 'Significant gaps detected';
  }

  getScoreGlow(): string {
    const score = this.matchResult?.fitScore ?? 0;
    if (score >= 80) return '0 0 28px rgba(22,163,74,0.28), 0 4px 20px rgba(0,0,0,0.1)';
    if (score >= 70) return '0 0 28px rgba(13,148,136,0.28), 0 4px 20px rgba(0,0,0,0.1)';
    if (score >= 60) return '0 0 28px rgba(234,88,12,0.28), 0 4px 20px rgba(0,0,0,0.1)';
    return '0 0 28px rgba(220,38,38,0.28), 0 4px 20px rgba(0,0,0,0.1)';
  }

  getSubScoreEntries(): {
    label: string;
    requirementText: string;
    status: string;
    evidenceText: string | null;
    score: number;
    weight: number;
    suggestion: string | null;
  }[] {
    const requirements = this.matchResult?.jdRequirements ?? [];
    if (requirements.length) {
      const evidenceByKey = new Map(
        (this.matchResult?.requirementEvidence ?? []).map(evidence => [evidence.requirementKey, evidence])
      );
      const weights = this.getRequirementWeights(requirements);
      return requirements.map((requirement, index) => {
        const evidence = evidenceByKey.get(requirement.requirementKey);
        const status = evidence?.evidenceStatus ?? 'Missing';
        const normalizedStatus = status.toLowerCase();
        const score = normalizedStatus === 'strong' ? 100
          : normalizedStatus === 'good' ? 75
            : normalizedStatus === 'weak' ? 40
              : normalizedStatus === 'partial' ? 60
                : 0;
        return {
          label: requirement.capabilityPhrase || this.compactRequirement(requirement.requirementText),
          requirementText: requirement.requirementText || '',
          status,
          evidenceText: evidence?.evidenceText ?? null,
          score,
          weight: weights[index],
          suggestion: this.getLowScoreSuggestion(requirement, score)
        };
      });
    }

    const ss = this.matchResult?.subScores;
    if (!ss) return [];
    const entries = [
      { label: 'Skills Match', score: ss.skillsMatch?.score, weight: ss.skillsMatch?.weight },
      { label: 'Experience Match', score: ss.experienceMatch?.score, weight: ss.experienceMatch?.weight },
      { label: 'Domain Match', score: ss.domainMatch?.score, weight: ss.domainMatch?.weight },
      { label: 'Impact Match', score: ss.impactMatch?.score, weight: ss.impactMatch?.weight },
      { label: 'CV Presentation', score: ss.cvPresentation?.score, weight: ss.cvPresentation?.weight },
    ];

    return entries.filter(
      (entry): entry is { label: string; score: number; weight: number } =>
        typeof entry.score === 'number' && typeof entry.weight === 'number'
    ).map(entry => ({
      ...entry,
      requirementText: entry.label,
      status: entry.score >= 80 ? 'Strong' : entry.score >= 60 ? 'Good' : 'Missing',
      evidenceText: null,
      suggestion: entry.score === 0 || entry.score === 40
        ? this.getBasicLowScoreSuggestion(entry.label, entry.score)
        : null
    }));
  }

  private getLowScoreSuggestion(requirement: FitRequirement, score: number): string | null {
    if (score !== 0 && score !== 40) return null;

    const capability = requirement.capabilityPhrase ?? '';
    const target = `${capability} ${requirement.requirementText ?? ''}`.toLowerCase();
    const relatedAdjustment = this.getSortedAdjustments().find(item => {
      const gap = item.addressesGap?.toLowerCase() ?? '';
      return gap.length > 0 && (target.includes(gap) || (capability.length > 0 && gap.includes(capability.toLowerCase())));
    });
    return relatedAdjustment?.adjustment || this.getBasicLowScoreSuggestion(
      capability || this.compactRequirement(requirement.requirementText), score);
  }

  private getBasicLowScoreSuggestion(label: string, score: number): string {
    if (score === 0) {
      return `Add one truthful CV example that demonstrates ${label}, if you have that experience. Do not claim it if you do not.`;
    }
    return `Make the existing evidence for ${label} more concrete by showing the context, what you did, and the result.`;
  }

  private compactRequirement(text: string | null | undefined): string {
    const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'JD requirement';
    const firstSentence = normalized.split(/[.!?](?:\s|$)/)[0].trim();
    return firstSentence.length <= 72 ? firstSentence : `${firstSentence.slice(0, 69).trimEnd()}...`;
  }

  private getRequirementWeights(requirements: { importanceTier: string; relevanceMode?: string; weight?: number }[]): number[] {
    const configured = requirements.map(requirement => requirement.weight ?? 0);
    if (configured.reduce((total, weight) => total + weight, 0) === 100) return configured;

    const units = requirements.map(requirement => {
      if (requirement.relevanceMode?.toUpperCase() === 'INFERRED') return 1;
      switch (requirement.importanceTier?.toUpperCase()) {
        case 'CORE': return 3;
        case 'PREFERRED': return 2;
        case 'SUPPORTING': return 1;
        default: return 1;
      }
    });
    const totalUnits = units.reduce((total, unit) => total + unit, 0);
    let assigned = 0;
    return units.map((unit, index) => {
      const weight = index === units.length - 1
        ? 100 - assigned
        : Math.round(unit * 100 / totalUnits);
      assigned += weight;
      return weight;
    });
  }

  getSubScoreColor(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 70) return '#0d9488';
    if (score >= 60) return '#ea580c';
    return '#dc2626';
  }

  getSubScoreBg(score: number): string {
    if (score >= 80) return '#dcfce7';
    if (score >= 70) return '#ccfbf1';
    if (score >= 60) return '#ffedd5';
    return '#fee2e2';
  }

  getSortedGaps(): GapItem[] {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return [...(this.matchResult?.gaps ?? [])].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  copiedAdjustmentIndex: string | null = null;

  copyAdjustmentText(text: string | null, index: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedAdjustmentIndex = index;
      setTimeout(() => { this.copiedAdjustmentIndex = null; }, 2000);
    });
  }

  getSortedAdjustments(): AdjustmentItem[] {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return [...(this.matchResult?.cvAdjustments ?? [])].sort((a, b) => order[a.priority] - order[b.priority]);
  }

  getRecommendationClass(): string {
    const r = this.matchResult?.recommendation?.toLowerCase() ?? '';
    if (r === 'apply') return 'rec-apply';
    if (r.includes('apply')) return 'rec-changes';
    return 'rec-low';
  }

  getRecommendationIcon(): 'apply' | 'changes' | 'skip' {
    const r = this.matchResult?.recommendation?.toLowerCase() ?? '';
    if (r === 'apply') return 'apply';
    if (r.includes('apply')) return 'changes';
    return 'skip';
  }

  getConfidenceClass(): string {
    const c = this.matchResult?.confidence;
    if (c === 'High') return 'conf-high';
    if (c === 'Medium') return 'conf-med';
    return 'conf-low';
  }

  private applyStreamEvent(chunk: string): void {
    try {
      const event = JSON.parse(chunk) as FitStreamEvent;
      if (!event.type) return;

      const current = this.matchResult ?? {};
      switch (event.type) {
        case 'progress':
          this.streamingStage = event.stage ?? 'Analyzing';
          break;
        case 'score':
          this.streamingStage = 'Scoring fit';
          this.matchResult = {
            ...current,
            fitScore: event.fitScore,
            recommendation: event.recommendation,
            weightageReasoning: event.weightageReasoning
          };
          break;
        case 'strengths':
          this.streamingStage = 'Reviewing strengths';
          this.matchResult = {
            ...current,
            strengthAlignment: event.strengths ?? [],
            differentiation: event.differentiation ?? []
          };
          break;
        case 'gaps':
          this.streamingStage = 'Reviewing gaps';
          this.matchResult = { ...current, gaps: event.gaps ?? [] };
          break;
        case 'breakdown':
          this.streamingStage = 'Building score breakdown';
          this.matchResult = {
            ...current,
            jdRequirements: (event.items ?? []).map(item => item.requirement),
            requirementEvidence: (event.items ?? []).map(item => item.evidence)
          };
          break;
        case 'positioning':
          this.streamingStage = 'Writing positioning';
          this.matchResult = {
            ...current,
            positioningAngle: event.positioningAngle
          };
          break;
        case 'adjustments':
          this.streamingStage = 'Preparing CV adjustments';
          this.matchResult = { ...current, cvAdjustments: event.adjustments ?? [] };
          break;
      }
    } catch {
      // The authoritative saved result is loaded after the stream completes.
    }
  }

  private isFitStreamError(chunk: string): boolean {
    try {
      return (JSON.parse(chunk) as FitStreamEvent).type === 'error';
    } catch {
      return false;
    }
  }
}

interface FitStreamEvent {
  type?: 'progress' | 'score' | 'strengths' | 'gaps' | 'breakdown' | 'positioning' | 'adjustments' | 'error';
  fitScore?: number;
  recommendation?: MatchResult['recommendation'];
  weightageReasoning?: string;
  strengths?: StrengthItem[];
  differentiation?: string[];
  gaps?: GapItem[];
  items?: { requirement: FitRequirement; evidence: RequirementEvidence }[];
  adjustments?: AdjustmentItem[];
  positioningAngle?: string;
  stage?: string;
}
