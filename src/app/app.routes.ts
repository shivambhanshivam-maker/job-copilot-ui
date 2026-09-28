import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { CvListComponent } from './cv-list/cv-list.component';
import { JobApplicationsComponent } from './job-applications/job-applications.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { JobListingsComponent } from './job-listings/job-listings.component';
import { SchoolDashboardComponent } from './school-dashboard/school-dashboard.component';
import { StudentCareerIntelligenceComponent } from './student-career-intelligence/student-career-intelligence.component';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { advisorGuard, studentGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: '', component: HomeComponent, canActivate: [studentGuard] },
  { path: 'cvs', component: CvListComponent, canActivate: [studentGuard] },
  { path: 'applications', component: JobApplicationsComponent, canActivate: [studentGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [studentGuard] },
  { path: 'career-intelligence', component: StudentCareerIntelligenceComponent, canActivate: [studentGuard] },
  { path: 'school', redirectTo: 'school/support-queue', pathMatch: 'full' },
  { path: 'school/support-queue', component: SchoolDashboardComponent, canActivate: [advisorGuard], data: { schoolView: 'supportQueue' } },
  { path: 'school/students', component: SchoolDashboardComponent, canActivate: [advisorGuard], data: { schoolView: 'students' } },
  { path: 'job-listings', component: JobListingsComponent, canActivate: [studentGuard] },
  { path: 'settings', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
