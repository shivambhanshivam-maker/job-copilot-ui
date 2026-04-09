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
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/login`, { email, password }).pipe(
      tap(res => this.storeAuth(res))
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

  private storeAuth(res: AuthResponse): void {
    if (this.isBrowser) {
      localStorage.setItem('jwt_token', res.token);
      localStorage.setItem('user_id', res.userId);
      localStorage.setItem('user_email', res.email);
      localStorage.setItem('user_name', res.name);
    }
    this.router.navigate(['/']);
  }
}
