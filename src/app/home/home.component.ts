import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, CvName, MatchResult, GapItem, AdjustmentItem, AdjustmentStatePayload } from '../services/api.service';
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
  jobDescription = '';
  matchResult: MatchResult | null = null;
  streamingText = '';
  streamingComplete = false;
  fitAnalysisId: string | null = null;
  previousFitScore: number | null = null;
  scoreDelta: number | null = null;

  loadingCvNames = false;
  loadingCvText = false;
  loadingMatch = false;
  uploadingCv = false;
  showCvDropdown = false;

  gmailConnected = false;
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
      next: (res) => { this.gmailConnected = res.connected; this.checkingGmail = false; },
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
    if (this.selectedCvId === null || !this.jobTitle.trim() || !this.companyName.trim() || !this.jobDescription.trim()) {
      return;
    }
    this.loadingMatch = true;
    this.matchResult = null;
    this.streamingText = '';
    this.streamingComplete = false;
    this.scoreDelta = null;
    this.adjustmentStates = {};
    this.cumulativeStates = {};
    this.jdDirty = false;
    this.cvEditorDirty = false;

    setTimeout(() => {
      this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    this.apiService.matchCvToJob(this.selectedCvId, this.jobDescription, this.jobTitle, this.companyName).subscribe({
      next: (chunk) => {
        if (chunk.startsWith('[SAVED:')) {
          this.fitAnalysisId = chunk.slice(7, -1);
          return;
        }
        this.streamingText += chunk;
        this.matchResult = this.tryParsePartialJson(this.streamingText);
        try {
          this.matchResult = JSON.parse(this.streamingText) as MatchResult;
          this.streamingComplete = true;
          this.loadingMatch = false;
        } catch { /* still incomplete */ }
      },
      error: () => { this.loadingMatch = false; },
      complete: () => {
        this.streamingComplete = true;
        this.loadingMatch = false;
      }
    });
  }

  runReanalyze(): void {
    if (!this.fitAnalysisId) { this.onMatch(); return; }
    this.previousFitScore = this.matchResult?.fitScore ?? null;

    Object.assign(this.cumulativeStates, this.adjustmentStates);
    const states = Object.values(this.cumulativeStates);

    this.loadingMatch = true;
    this.matchResult = null;
    this.streamingText = '';
    this.streamingComplete = false;
    this.scoreDelta = null;
    this.adjustmentStates = {};
    this.jdDirty = false;
    this.cvEditorDirty = false;

    setTimeout(() => {
      this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    this.apiService.reanalyze(this.fitAnalysisId, states.length ? states : undefined).subscribe({
      next: (chunk) => {
        this.streamingText += chunk;
        this.matchResult = this.tryParsePartialJson(this.streamingText);
        try {
          this.matchResult = JSON.parse(this.streamingText) as MatchResult;
          if (this.previousFitScore !== null && this.matchResult?.fitScore != null) {
            this.scoreDelta = this.matchResult.fitScore - this.previousFitScore;
          }
          this.streamingComplete = true;
          this.loadingMatch = false;
        } catch { /* still incomplete */ }
      },
      error: () => { this.loadingMatch = false; },
      complete: () => {
        this.streamingComplete = true;
        this.loadingMatch = false;
      }
    });
  }

  onNewAnalysis(): void {
    this.jobTitle = '';
    this.companyName = '';
    this.jobDescription = '';
    this.matchResult = null;
    this.fitAnalysisId = null;
    this.streamingText = '';
    this.streamingComplete = false;
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

  getSubScoreEntries(): { label: string; score: number; weight: number }[] {
    const ss = this.matchResult?.subScores;
    if (!ss) return [];
    return [
      { label: 'Skills Match',      score: ss.skillsMatch.score,     weight: ss.skillsMatch.weight },
      { label: 'Experience Match',  score: ss.experienceMatch.score,  weight: ss.experienceMatch.weight },
      { label: 'Domain Match',      score: ss.domainMatch.score,      weight: ss.domainMatch.weight },
      { label: 'Impact Match',      score: ss.impactMatch.score,      weight: ss.impactMatch.weight },
      { label: 'CV Presentation',   score: ss.cvPresentation.score,   weight: ss.cvPresentation.weight },
    ];
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

  private tryParsePartialJson(text: string): MatchResult | null {
    const repaired = this.repairJson(text);
    if (!repaired) return this.matchResult;
    try {
      return JSON.parse(repaired) as MatchResult;
    } catch {
      return this.matchResult;
    }
  }

  private repairJson(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let json = text.substring(start);

    json = json.replace(/,\s*$/, '');

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

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
    while (stack.length) { json += stack.pop(); }

    return json;
  }
}
