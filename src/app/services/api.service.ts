import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CvName {
  id: string;
  name: string;
  isDefaultCv: boolean;
}

export interface Cv {
  id: string;
  name: string;
  contentText: string;
}

export interface SubScoreDetail {
  score: number;
  weight: number;
}

export interface StrengthItem {
  strength: string;
  category: string;
}

export interface GapItem {
  gap: string;
  category: string;
  severity: 'High' | 'Medium' | 'Low';
}

export interface AdjustmentItem {
  adjustment: string;
  priority: 'High' | 'Medium' | 'Low';
  addressesGap: string | null;
  action: 'rewrite' | 'add' | 'remove';
  cvPoint: string | null;
  suggestedText: string | null;
}

export interface AdjustmentStatePayload {
  state: 'applied' | 'dismissed';
  cvPoint: string | null;
  suggestedText: string | null;
  adjustment: string;
}

export interface ReanalysisInputs {
  cvId: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  roleCategory: string;
}

export interface FitRequirement {
  requirementKey: string;
  requirementText: string;
  capabilityPhrase: string;
  importanceTier: 'CORE' | 'SUPPORTING' | 'PREFERRED' | string;
  relevanceMode: 'DIRECT' | 'INFERRED' | string;
  evidenceType: string;
  sourceExcerpt: string;
  weight?: number;
}

export interface RequirementEvidence {
  requirementKey: string;
  evidenceStatus: 'Strong' | 'Good' | 'Weak' | 'Partial' | 'Missing' | string;
  evidenceType?: string | null;
  evidenceText?: string | null;
  artifact?: string | null;
  confidence?: 'High' | 'Medium' | 'Low' | string;
}

export interface MatchResult {
  id?: string;
  companyNameRaw?: string;
  companyNameCanonical?: string;
  roleCategory?: string;
  fitScore?: number;
  recommendation?: 'Apply' | 'Optimize & Apply' | 'Apply with changes' | 'Ignore' | 'Low priority' | 'Insufficient evidence';
  confidence?: 'High' | 'Medium' | 'Low';
  subScores?: {
    skillsMatch: SubScoreDetail;
    experienceMatch: SubScoreDetail;
    domainMatch: SubScoreDetail;
    impactMatch: SubScoreDetail;
    cvPresentation: SubScoreDetail;
  };
  weightageReasoning?: string;
  strengthAlignment?: StrengthItem[];
  differentiation?: string[];
  gaps?: GapItem[];
  positioningAngle?: string;
  cvAdjustments?: AdjustmentItem[];
  jdRequirements?: FitRequirement[];
  requirementEvidence?: RequirementEvidence[];
  previousAnalysisId?: string;
  revisionNumber?: number;
  scoringVersion?: string;
}

export interface ApplicationUpdate {
  summary: string;
  timestamp: string;
}

export interface FitSummary {
  fitScore: number;
  isStale: boolean;
}

export interface SkillGapItem {
  skill: string;
  priority: 'High' | 'Medium' | 'Low';
  action: string;
}

export interface RedFlagItem {
  gap: string;
  tip: string;
}

export interface PostApplicationInsight {
  id: string;
  jobApplicationId: string;
  cvId: string;
  fitScore: number;
  interviewAngle: string;
  skillGaps: SkillGapItem[];
  talkingPoints: string[];
  redFlags: RedFlagItem[];
  analyzedAt: string;
}

export interface PostApplicationInsightResult {
  insight: PostApplicationInsight;
  isStale: boolean;
}

export interface JobApplication {
  id?: string;
  company: string;
  companyNameRaw?: string;
  companyNameCanonical?: string;
  jobTitle: string;
  recruiterName: string;
  roleCategory?: string;
  cvId?: string;
  jobDescriptionText?: string | null;
  jobDescriptionUrl?: string | null;
  fitAnalysisStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  fitAnalysisError?: string;
  applicationStatus: string;
  interviewDate: string | null;
  updatedAt?: string;
  updates?: ApplicationUpdate[];
  fitSummary?: FitSummary | null;
  notes?: string;
}

export interface EmailReviewCandidate {
  id: string;
  company: string;
  jobTitle: string;
  applicationStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailReview {
  id: string;
  companyNameRaw?: string;
  companyNameCanonical?: string;
  jobTitle?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  applicationStatus?: string;
  referral?: string;
  roleCategory?: string;
  interviewDateAndTime?: string;
  updateSummary?: string;
  reviewReason?: string;
  createdAt: string;
  candidates: EmailReviewCandidate[];
}

export interface PendingAction {
  jobApplicationId: string;
  company: string;
  jobTitle: string;
  message: string;
  suggestedStatus: string;
  actionType: 'FOLLOW_UP_REFERRAL' | 'STALE_APPLICATION';
  snoozeDays: number;
}

export interface StudentInsight {
  id: string;
  insightType: 'UPCOMING_INTERVIEW' | 'RECURRING_CAPABILITY_GAP' | 'ROLE_CATEGORY_FIT_COMPARISON' | 'ROLE_CATEGORY_TRACTION' | 'HIGH_FIT_LOW_RESPONSE' | 'INTERVIEW_BUT_NO_OFFER' | 'STALE_APPLICATION_FOLLOWUP';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  summary: string;
  recommendation: string;
  evidenceJson: string;
  generatedAt: string;
}

export interface StudentPrimaryFocus {
  type: 'UPCOMING_INTERVIEW' | 'RECURRING_CAPABILITY_GAP' | 'ROLE_CATEGORY_IMPROVEMENT' | 'ROLE_CATEGORY_PRIORITY';
  title: string;
  action: string;
  reason: string;
}

export interface StudentInsightResponse {
  primaryFocus: StudentPrimaryFocus | null;
  insights: StudentInsight[];
}

export interface PeerEvidencePatternResponse {
  schoolId: string;
  schoolName: string;
  peerStudentsIncluded: number;
  categories: PeerEvidenceCategory[];
}

export interface PeerEvidenceCategory {
  roleCategory: string;
  interviewApplications: number;
  interviewStudents: number;
  nonInterviewApplications: number;
  nonInterviewStudents: number;
  patterns: PeerEvidencePattern[];
}

export interface PeerEvidencePattern {
  capability: string;
  interviewApplicationsWithRequirement: number;
  interviewStudentsWithRequirement: number;
  interviewStudentsWithEvidence: number;
  interviewEvidenceRate: number;
  nonInterviewApplicationsWithRequirement: number;
  nonInterviewStudentsWithRequirement: number;
  nonInterviewStudentsWithEvidence: number;
  nonInterviewEvidenceRate: number;
  differencePercentagePoints: number;
  currentStudentEvidenceStatus: 'Strong' | 'Partial' | 'Missing' | 'Mixed' | 'Not assessed';
  currentStudentApplicationsWithRequirement: number;
  currentStudentEvidenceRate: number;
}

export interface RoleCategory {
  id: string;
  name: string;
}

export interface PreferredLocation {
  cityName: string;
  countryCode: string;
  displayName: string;
}

export interface UserPreferences {
  id: string;
  experienceLevel: 'EARLY_CAREER' | 'EXPERIENCED';
  preferredRoleCategories: string[];
  preferredLocations: PreferredLocation[];
}

export interface UserPreferencesRequest {
  experienceLevel: 'EARLY_CAREER' | 'EXPERIENCED';
  preferredRoleCategories: string[];
  preferredLocations: PreferredLocation[];
}

export interface FitAnalysisSummary {
  id: string;
  fitScore: number;
  recommendation?: 'Apply' | 'Optimize & Apply' | 'Apply with changes' | 'Ignore' | 'Low priority' | 'Insufficient evidence';
  confidence?: 'High' | 'Medium' | 'Low';
  strengths: StrengthItem[];
  gaps: GapItem[];
  positioningAngle: string;
  cvAdjustments: AdjustmentItem[];
}

export interface JobListing {
  id: string;
  employerName: string;
  jobTitle: string;
  jobLocation: string;
  jobApplyLink: string;
  jobPostedAt: string;
  roleCategory: string;
  qualifications: string[];
  responsibilities: string[];
  fitAnalysis: FitAnalysisSummary | null;
}

export interface ApiToken {
  token: string;
  createdAt: string;
}

export interface ChannelEffectiveness {
  referralApplications: number;
  referralInterviews: number;
  referralYield: number;
  directApplications: number;
  directInterviews: number;
  directYield: number;
  multiplier: number;
  industryBenchmark?: number;
  benchmarkMultiplier?: number;
}

export interface FunnelConversion {
  resolvedApplications: number;
  interviews: number;
  appliedToInterviewRate: number;
  appliedToInterviewLast30Days: number | null;
  offers: number;
  interviewToOfferRate: number;
  interviewToOfferLast30Days: number | null;
}

export interface ApplicationVelocity {
  weeks: { label: string; count: number }[];
  avgPerWeek: number;
}

export interface StatusPipeline {
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
}

export interface PerformanceMetrics {
  responseRate: number;
  responseRateLast30Days: number | null;
  avgResponseTimeDays: number;
  ghostingRate: number;
}

export interface EmailTestRequest {
  subject: string;
  sender: string;
  body: string;
  messageId?: string;
}

export interface EmailClassification {
  company: string;
  companyNameRaw?: string;
  companyNameCanonical?: string;
  jobTitle: string;
  applicationStatus: string;
  recruiterName?: string;
  recruiterEmail?: string;
  referral?: string;
  roleCategory?: string;
  interviewDateAndTime?: string;
  updateSummary?: string;
}

export interface EmailCandidate {
  id: string;
  jobTitle: string;
  applicationStatus: string;
  updatedAt: string;
}

export interface EmailMergeDecision {
  action: 'CREATE' | 'UPDATE' | 'IGNORE' | 'UNRESOLVED';
  applicationId?: string;
  reasoning: string;
  fieldsToSet: Record<string, string>;
  fieldsToClear: string[];
}

export interface EmailTestResponse {
  classification: EmailClassification | null;
  candidatesFound: EmailCandidate[];
  mergeDecision: EmailMergeDecision;
}

export interface SchoolContext {
  advisorId: string;
  advisorName: string;
  advisorEmail: string;
  advisorTitle: string;
  advisorRole: 'CAREER_ADVISOR' | 'PROGRAM_ADMIN' | 'SCHOOL_ADMIN';
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  schoolDomain: string;
}

export interface SchoolBreakdownItem {
  label: string;
  count: number;
}

export interface SchoolOverview {
  schoolId: string;
  schoolName: string;
  activeStudents: number;
  applicationsTracked: number;
  recruiterResponses: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  latestActivityAt: string | null;
  topRoleCategories: SchoolBreakdownItem[];
  topEmployers: SchoolBreakdownItem[];
}

export interface SupportSignal {
  type: 'HIGH_ACTIVITY_NO_RESPONSES' | 'INTERVIEWS_NO_OFFERS' | 'STALE_APPLIED_PIPELINE' | 'NO_RECENT_ACTIVITY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  evidence: string[];
  suggestedAction: string;
  fingerprint: string;
}

export interface SupportQueueItem {
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  advisorVisibilityLevel?: 'NONE' | 'LIMITED' | 'FULL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  lastActivityAt: string | null;
  summary: SupportSummary;
  signals: SupportSignal[];
}

export interface SupportSummary {
  totalApplications: number;
  applicationsLast30Days: number;
  responsesLast30Days: number;
  interviews: number;
  offers: number;
  latestActivityAt: string | null;
  roleCategories: SchoolBreakdownItem[];
  statuses: SchoolBreakdownItem[];
}

export interface SchoolSupportQueue {
  schoolId: string;
  schoolName: string;
  eligibleStudents: number;
  items: SupportQueueItem[];
}

export interface SchoolStudentRosterItem {
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  programName: string | null;
  cohortName: string | null;
  jobSearchStatus: string | null;
  advisorVisibilityLevel?: 'NONE' | 'LIMITED' | 'FULL';
  highestSeverity: 'NONE' | 'HIGH' | 'MEDIUM' | 'LOW';
  supportSignalCount: number;
  lastActivityAt: string | null;
  summary: SupportSummary;
}

export interface SchoolStudentRoster {
  schoolId: string;
  schoolName: string;
  students: SchoolStudentRosterItem[];
}

export interface SchoolStudentApplication {
  id: string;
  company: string;
  jobTitle: string;
  roleCategory: string;
  applicationStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  firstRespondedAt: string | null;
  interviewDate: string | null;
}

export interface SchoolStudentApplications {
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  applications: SchoolStudentApplication[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = `${environment.apiUrl}/`;

  private preferencesCache$: Observable<UserPreferences> | null = null;
  private roleCategoriesCache$: Observable<RoleCategory[]> | null = null;

  constructor(private http: HttpClient, private zone: NgZone) {}

  getCvNames(): Observable<CvName[]> {
    return this.http.get<CvName[]>(`${this.baseUrl}cvs/names`);
  }

  getCvText(cvId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}cvs/${cvId}/text`, { responseType: 'text' });
  }

  getCvMarkdown(cvId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}cvs/${cvId}/markdown`, { responseType: 'text' });
  }

  updateCvContent(cvId: string, contentMarkdown: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}cvs/${cvId}/content`, { contentMarkdown });
  }

  uploadCv(file: File, name?: string): Observable<Cv> {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }
    return this.http.post<Cv>(`${this.baseUrl}cvs`, formData);
  }

  // Job Applications CRUD
  getJobApplications(): Observable<JobApplication[]> {
    return this.http.get<JobApplication[]>(`${this.baseUrl}job-applications`);
  }

  getEmailReviews(): Observable<EmailReview[]> {
    return this.http.get<EmailReview[]>(`${this.baseUrl}job-applications/email-reviews`);
  }

  resolveEmailReview(reviewId: string, applicationId: string): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.baseUrl}job-applications/email-reviews/${reviewId}/resolve`, { applicationId });
  }

  ignoreEmailReview(reviewId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}job-applications/email-reviews/${reviewId}/ignore`, {});
  }

  createJobApplication(app: JobApplication): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.baseUrl}job-applications`, app);
  }

  retryJobApplicationFitAnalysis(id: string): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.baseUrl}job-applications/${id}/fit-analysis/retry`, {});
  }

  updateJobApplication(id: string, app: JobApplication): Observable<JobApplication> {
    return this.http.put<JobApplication>(`${this.baseUrl}job-applications/${id}`, app);
  }

  deleteJobApplication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}job-applications/${id}`);
  }

  snoozeJobApplication(id: string, days: number): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.baseUrl}job-applications/${id}/snooze?days=${days}`, {});
  }

  getPendingActions(): Observable<PendingAction[]> {
    return this.http.get<PendingAction[]>(`${this.baseUrl}job-applications/pending-actions`);
  }

  getStudentInsights(): Observable<StudentInsightResponse> {
    return this.http.get<StudentInsightResponse>(`${this.baseUrl}student/insights`);
  }

  getPeerEvidence(): Observable<PeerEvidencePatternResponse> {
    return this.http.get<PeerEvidencePatternResponse>(`${this.baseUrl}student/peer-evidence`);
  }

  setDefaultCv(id: string): Observable<Cv> {
    return this.http.post<Cv>(`${this.baseUrl}cvs/${id}/default`, {});
  }

  getRoleCategories(): Observable<RoleCategory[]> {
    if (!this.roleCategoriesCache$) {
      this.roleCategoriesCache$ = this.http.get<RoleCategory[]>(`${this.baseUrl}role-categories`).pipe(shareReplay(1));
    }
    return this.roleCategoriesCache$;
  }

  getPreferences(): Observable<UserPreferences> {
    if (!this.preferencesCache$) {
      this.preferencesCache$ = this.http.get<UserPreferences>(`${this.baseUrl}preferences`).pipe(shareReplay(1));
    }
    return this.preferencesCache$;
  }

  savePreferences(req: UserPreferencesRequest): Observable<UserPreferences> {
    return this.http.put<UserPreferences>(`${this.baseUrl}preferences`, req).pipe(
      tap(updated => {
        this.preferencesCache$ = of(updated).pipe(shareReplay(1));
      })
    );
  }

  searchLocations(query: string): Observable<PreferredLocation[]> {
    return this.http.get<PreferredLocation[]>(`${this.baseUrl}locations/search`, { params: { query } });
  }

  getJobListings(): Observable<JobListing[]> {
    return this.http.get<JobListing[]>(`${this.baseUrl}job-listings`);
  }

  getFunnelFilters(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}analytics/funnel-filters`);
  }

  getFunnelConversion(category?: string): Observable<FunnelConversion> {
    const params = category && category !== 'All' ? { params: { category } } : {};
    return this.http.get<FunnelConversion>(`${this.baseUrl}analytics/funnel-conversion`, params);
  }

  getChannelEffectiveness(): Observable<ChannelEffectiveness> {
    return this.http.get<ChannelEffectiveness>(`${this.baseUrl}analytics/channel-effectiveness`);
  }

  getApplicationVelocity(): Observable<ApplicationVelocity> {
    return this.http.get<ApplicationVelocity>(`${this.baseUrl}analytics/application-velocity`);
  }

  getStatusPipeline(): Observable<StatusPipeline> {
    return this.http.get<StatusPipeline>(`${this.baseUrl}analytics/status-pipeline`);
  }

  getPerformanceMetrics(): Observable<PerformanceMetrics> {
    return this.http.get<PerformanceMetrics>(`${this.baseUrl}analytics/performance-metrics`);
  }

  // API Token (for Chrome extension auth)
  generateApiToken(): Observable<ApiToken> {
    return this.http.post<ApiToken>(`${this.baseUrl}api-tokens`, {});
  }

  getApiToken(): Observable<ApiToken | null> {
    return this.http.get<ApiToken | null>(`${this.baseUrl}api-tokens`);
  }

  revokeApiToken(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}api-tokens`);
  }

  processEmailTest(req: EmailTestRequest): Observable<EmailTestResponse> {
    return this.http.post<EmailTestResponse>(`${this.baseUrl}email-test`, req);
  }

  getSchoolContext(): Observable<SchoolContext> {
    return this.http.get<SchoolContext>(`${this.baseUrl}school/context`);
  }

  getSchoolOverview(): Observable<SchoolOverview> {
    return this.http.get<SchoolOverview>(`${this.baseUrl}school/overview`);
  }

  getSchoolSupportQueue(): Observable<SchoolSupportQueue> {
    return this.http.get<SchoolSupportQueue>(`${this.baseUrl}school/support-queue`);
  }

  reviewSchoolSupportSignal(request: {
    studentUserId: string;
    signalType: string;
    signalFingerprint: string;
  }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}school/support-queue/review`, request);
  }

  snoozeSchoolSupportSignal(request: {
    studentUserId: string;
    signalType: string;
    signalFingerprint: string;
    snoozeDays: number;
  }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}school/support-queue/snooze`, request);
  }

  getSchoolStudents(): Observable<SchoolStudentRoster> {
    return this.http.get<SchoolStudentRoster>(`${this.baseUrl}school/students`);
  }

  getSchoolStudentApplications(studentUserId: string): Observable<SchoolStudentApplications> {
    return this.http.get<SchoolStudentApplications>(`${this.baseUrl}school/students/${studentUserId}/applications`);
  }

  getGmailStatus(): Observable<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }> {
    return this.http.get<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }>(`${this.baseUrl}api/gmail/status`);
  }

  syncGmail(): Observable<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }> {
    return this.http.post<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }>(`${this.baseUrl}api/gmail/sync`, {});
  }

  getGmailConnectUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.baseUrl}api/gmail/connect`);
  }

  getOutlookStatus(): Observable<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }> {
    return this.http.get<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }>(`${this.baseUrl}api/outlook/status`);
  }

  syncOutlook(): Observable<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }> {
    return this.http.post<{ connected: boolean; status: string; message?: string; lastSuccessfulPollAt?: string }>(`${this.baseUrl}api/outlook/sync`, {});
  }

  getOutlookConnectUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.baseUrl}api/outlook/connect`);
  }

  disconnectGmail(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}api/gmail/disconnect`, {});
  }

  disconnectOutlook(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}api/outlook/disconnect`, {});
  }

  matchCvToJob(cvId: string, jobDescription: string, jobTitle: string, companyName: string, roleCategory: string): Observable<string> {
    return new Observable<string>(observer => {
      const abortController = new AbortController();

      const body = { cvId, jobDescription, jobTitle, companyName, roleCategory };

      const token = localStorage.getItem('jwt_token');
      fetch(`${this.baseUrl}match/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = (): void => {
            reader.read().then(({ done, value }) => {
              if (done) {
                buffer += decoder.decode();
                const finalLine = buffer.trim();
              if (finalLine.startsWith('data:')) {
                const content = finalLine.substring(5).trim();
                if (content.length > 0) this.zone.run(() => observer.next(content));
              }
              this.zone.run(() => observer.complete());
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const content = line.substring(5).trim();
                if (content.length > 0) {
                  this.zone.run(() => observer.next(content));
                }
              }
            }
            read();
          }).catch(err => {
            this.zone.run(() => observer.error(err));
          });
        };

        read();
      }).catch(err => {
        if (err.name !== 'AbortError') {
          this.zone.run(() => observer.error(err));
        }
      });

      return () => abortController.abort();
    });
  }

  getFitAnalysis(id: string): Observable<MatchResult> {
    return this.http.get<MatchResult>(`${this.baseUrl}fit-analyses/${id}`);
  }

  markFitAnalysisAsApplied(fitAnalysisId: string, roleCategory?: string): Observable<JobApplication> {
    return this.http.post<JobApplication>(
      `${this.baseUrl}job-applications/from-fit-analysis/${fitAnalysisId}`,
      roleCategory ? { roleCategory } : {}
    );
  }

  reanalyze(fitAnalysisId: string, states?: AdjustmentStatePayload[], inputs?: ReanalysisInputs): Observable<string> {
    return new Observable<string>(observer => {
      const abortController = new AbortController();
      const token = localStorage.getItem('jwt_token');
      const body = JSON.stringify({
        states: states ?? [],
        ...(inputs ?? {})
      });
      fetch(`${this.baseUrl}fit-analyses/${fitAnalysisId}/reanalyze`, {
        method: 'POST',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body,
        signal: abortController.signal
      }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const read = (): void => {
          reader.read().then(({ done, value }) => {
            if (done) {
              buffer += decoder.decode();
              const finalLine = buffer.trim();
              if (finalLine.startsWith('data:')) {
                const content = finalLine.substring(5).trim();
                if (content.length > 0) this.zone.run(() => observer.next(content));
              }
              this.zone.run(() => observer.complete());
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const content = line.substring(5).trim();
                if (content.length > 0) this.zone.run(() => observer.next(content));
              }
            }
            read();
          }).catch(err => { this.zone.run(() => observer.error(err)); });
        };
        read();
      }).catch(err => {
        if (err.name !== 'AbortError') this.zone.run(() => observer.error(err));
      });
      return () => abortController.abort();
    });
  }

  getPostMatch(appId: string): Observable<PostApplicationInsightResult> {
    return this.http.get<PostApplicationInsightResult>(`${this.baseUrl}job-applications/${appId}/post-match`);
  }

  runPostMatch(appId: string): Observable<string> {
    return new Observable<string>(observer => {
      const abortController = new AbortController();
      const token = localStorage.getItem('jwt_token');

      fetch(`${this.baseUrl}job-applications/${appId}/post-match`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        signal: abortController.signal
      }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = (): void => {
          reader.read().then(({ done, value }) => {
            if (done) { this.zone.run(() => observer.complete()); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const content = line.substring(5);
                if (content.length > 0) this.zone.run(() => observer.next(content));
              }
            }
            read();
          }).catch(err => { this.zone.run(() => observer.error(err)); });
        };

        read();
      }).catch(err => {
        if (err.name !== 'AbortError') this.zone.run(() => observer.error(err));
      });

      return () => abortController.abort();
    });
  }
}
