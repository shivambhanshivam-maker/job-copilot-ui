import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { CvListComponent } from './cv-list/cv-list.component';
import { JobApplicationsComponent } from './job-applications/job-applications.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { JobListingsComponent } from './job-listings/job-listings.component';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'cvs', component: CvListComponent, canActivate: [authGuard] },
  { path: 'applications', component: JobApplicationsComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [authGuard] },
  { path: 'job-listings', component: JobListingsComponent, canActivate: [authGuard] },
  { path: 'settings', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
