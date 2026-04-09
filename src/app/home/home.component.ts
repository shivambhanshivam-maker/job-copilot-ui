import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, CvName, MatchResult, GapItem, AdjustmentItem } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  cvNames: CvName[] = [];
  selectedCvId: string | null = null;
  cvText = '';
  jobTitle = '';
  companyName = '';
  jobDescription = '';
  matchResult: MatchResult | null = null;
  streamingText = '';
  streamingComplete = false;

  loadingCvNames = false;
  loadingCvText = false;
  loadingMatch = false;
  uploadingCv = false;
  showCvDropdown = false;

  gmailConnected = false;
  outlookConnected = false;
  checkingGmail = true;
  checkingOutlook = true;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('resultsSection') resultsSection?: ElementRef;

  private readonly ADD_CV_VALUE = '__add_cv__';

  userName = '';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.userName = this.authService.getUserName();
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
      return;
    }
    this.loadingCvText = true;
    this.apiService.getCvText(this.selectedCvId).subscribe({
      next: (text) => {
        this.cvText = text;
        this.loadingCvText = false;
      },
      error: () => {
        this.loadingCvText = false;
      }
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
        this.cvText = cv.contentText;
        this.uploadingCv = false;
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

    setTimeout(() => {
      this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    this.apiService.matchCvToJob(this.selectedCvId, this.jobDescription, this.jobTitle, this.companyName).subscribe({
      next: (chunk) => {
        this.streamingText += chunk;
        this.matchResult = this.tryParsePartialJson(this.streamingText);
        try {
          this.matchResult = JSON.parse(this.streamingText) as MatchResult;
          this.streamingComplete = true;
          this.loadingMatch = false;
        } catch { /* still incomplete */ }
      },
      error: () => {
        this.loadingMatch = false;
      },
      complete: () => {
        try {
          this.matchResult = JSON.parse(this.streamingText) as MatchResult;
        } catch {
          // keep last partial parse
        }
        this.streamingComplete = true;
        this.loadingMatch = false;
      }
    });
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
    this.selectedCvId = id;
    this.showCvDropdown = false;
    this.onCvSelect();
  }

  getSelectedCvName(): string {
    if (!this.selectedCvId) return 'Select a CV';
    return this.cvNames.find(c => c.id === this.selectedCvId)?.name || 'Select a CV';
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
