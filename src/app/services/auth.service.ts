import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  name: string;
  advisorAccess: boolean;
  accountMode?: 'STUDENT' | 'ADVISOR';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string, accountMode: 'STUDENT' | 'ADVISOR'): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/login`, { email, password, accountMode }).pipe(
      tap(res => this.storeAuth(res, accountMode))
    );
  }

  signup(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/signup`, { email, password, name }).pipe(
      tap(res => this.storeAuth(res))
    );
  }

  logout(): void {
    if (this.isBrowser) localStorage.clear();
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.isBrowser && !!localStorage.getItem('jwt_token');
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem('jwt_token') : null;
  }

  getCurrentUserId(): string {
    return (this.isBrowser && localStorage.getItem('user_id')) || '';
  }

  getUserName(): string {
    return (this.isBrowser && localStorage.getItem('user_name')) || '';
  }

  hasAdvisorAccess(): boolean {
    return this.isBrowser && localStorage.getItem('advisor_access') === 'true';
  }

  isAdvisorMode(): boolean {
    return this.isBrowser && localStorage.getItem('account_mode') === 'ADVISOR';
  }

  private storeAuth(res: AuthResponse, requestedMode: 'STUDENT' | 'ADVISOR' = 'STUDENT'): void {
    const accountMode = res.accountMode ?? requestedMode;
    if (this.isBrowser) {
      localStorage.setItem('jwt_token', res.token);
      localStorage.setItem('user_id', res.userId);
      localStorage.setItem('user_email', res.email);
      localStorage.setItem('user_name', res.name);
      localStorage.setItem('advisor_access', String(res.advisorAccess));
      localStorage.setItem('account_mode', accountMode);
    }
    this.router.navigate([accountMode === 'ADVISOR' ? '/school/support-queue' : '/']);
  }
}
