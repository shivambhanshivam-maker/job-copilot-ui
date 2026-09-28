import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="brand">
          <div class="brand-mark">JC</div>
          <span class="brand-name">Job Copilot</span>
        </div>

        <h1 class="title">Welcome back</h1>
        <p class="subtitle">Sign in to your account</p>

        @if (error) {
          <div class="error-banner">{{ error }}</div>
        }

        <form (ngSubmit)="onSubmit()">
          <div class="mode-toggle" role="radiogroup" aria-label="Account type">
            <button
              type="button"
              class="mode-btn"
              [class.active]="accountMode === 'STUDENT'"
              (click)="accountMode = 'STUDENT'"
            >
              Student
            </button>
            <button
              type="button"
              class="mode-btn"
              [class.active]="accountMode === 'ADVISOR'"
              (click)="accountMode = 'ADVISOR'"
            >
              Advisor
            </button>
          </div>

          <div class="field">
            <label>Email</label>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </div>
          <div class="field">
            <label>Password</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>
          <button type="submit" class="submit-btn" [disabled]="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="switch-link">
          Don't have an account? <a routerLink="/signup">Sign up</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 1rem;
    }

    .auth-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.05em;
    }

    .brand-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
    }

    .title {
      font-size: 1.6rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.35rem;
    }

    .subtitle {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.5);
      margin: 0 0 1.75rem;
    }

    .error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }

    .mode-toggle {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.35rem;
      padding: 0.3rem;
      margin-bottom: 1.25rem;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
    }

    .mode-btn {
      border: 0;
      border-radius: 8px;
      padding: 0.62rem 0.75rem;
      background: transparent;
      color: rgba(255, 255, 255, 0.62);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s, color 0.2s;
    }

    .mode-btn.active {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }

    .field {
      margin-bottom: 1.1rem;
    }

    .field label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .field input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: #fff;
      font-size: 0.9rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
      font-family: inherit;
    }

    .field input::placeholder {
      color: rgba(255, 255, 255, 0.25);
    }

    .field input:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
    }

    .submit-btn {
      width: 100%;
      padding: 0.8rem;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: opacity 0.2s, transform 0.1s;
      font-family: inherit;
    }

    .submit-btn:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .submit-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .switch-link {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.45);
    }

    .switch-link a {
      color: #818cf8;
      text-decoration: none;
      font-weight: 600;
    }

    .switch-link a:hover {
      color: #a5b4fc;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  accountMode: 'STUDENT' | 'ADVISOR' = 'STUDENT';
  loading = false;
  error = '';

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.error = '';
    this.authService.login(this.email, this.password, this.accountMode).subscribe({
      error: (err) => {
        this.error = err?.status === 403
          ? this.accountMode === 'ADVISOR'
            ? 'This account does not have advisor access.'
            : 'This account is configured for the advisor workspace.'
          : 'Invalid email or password.';
        this.loading = false;
      }
    });
  }
}
