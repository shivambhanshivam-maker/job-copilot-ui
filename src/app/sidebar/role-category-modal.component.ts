import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import {
  ApiService,
  // ApiToken,
  PreferredLocation,
  RoleCategory,
  UserPreferencesRequest
} from '../services/api.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-role-category-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onCancel()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <h3 class="modal-title">Preferences</h3>

        <!-- Section 1: Experience Level -->
        <div class="section">
          <span class="section-label">Experience Level</span>
          <div class="toggle-group">
            <button
              class="toggle-btn"
              [class.active]="experienceLevel === 'EARLY_CAREER'"
              (click)="experienceLevel = 'EARLY_CAREER'"
            >Student / Early Careers</button>
            <button
              class="toggle-btn"
              [class.active]="experienceLevel === 'EXPERIENCED'"
              (click)="experienceLevel = 'EXPERIENCED'"
            >Experienced</button>
          </div>
        </div>

        <!-- Section 2: Preferred Role Categories -->
        <div class="section">
          <span class="section-label">Preferred Role Categories</span>
          <div class="combobox-wrapper">
            <div class="combobox" [class.focused]="showCategoryDropdown" (click)="focusCategoryInput()">
              @for (name of selectedRoleCategoryNames; track name) {
                <span class="chip selected-chip">
                  {{ name }}
                  <button class="chip-remove" (click)="removeCategoryByName(name); $event.stopPropagation()">&times;</button>
                </span>
              }
              @for (name of customCategories; track name; let i = $index) {
                <span class="chip custom-chip">
                  {{ name }}
                  <button class="chip-remove custom" (click)="removeCustomCategory(i); $event.stopPropagation()">&times;</button>
                </span>
              }
              <input
                #categoryInput
                class="combobox-input"
                type="text"
                [placeholder]="selectedRoleCategoryNames.length || customCategories.length ? '' : 'Search or add a category...'"
                [(ngModel)]="categoryQuery"
                (focus)="showCategoryDropdown = true"
                (blur)="onCategoryBlur()"
                (keydown.enter)="onCategoryEnter($event)"
              />
            </div>

            @if (showCategoryDropdown) {
              <div class="dropdown">
                @for (cat of getFilteredCategories(); track cat.id) {
                  <div class="dropdown-item" [class.is-selected]="isCategorySelected(cat.name)" (mousedown)="toggleCategory(cat.name)">
                    <span>{{ cat.name }}</span>
                    @if (isCategorySelected(cat.name)) {
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    }
                  </div>
                }
                @if (getFilteredCategories().length === 0 && !categoryQuery.trim()) {
                  <div class="dropdown-item empty-item">No categories available</div>
                }
                @if (categoryQuery.trim() && !hasCategoryExactMatch()) {
                  <div class="dropdown-item add-hint" (mousedown)="addCustomCategory()">
                    Press Enter to add "<strong>{{ categoryQuery.trim() }}</strong>"
                  </div>
                }
                @if (categoryQuery.trim() && getFilteredCategories().length === 0 && hasCategoryExactMatch()) {
                  <div class="dropdown-item empty-item">Already selected</div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Section 3: Preferred Locations -->
        <div class="section">
          <span class="section-label">Preferred Locations</span>
          <div class="combobox-wrapper">
            <div class="combobox" [class.focused]="showLocationDropdown" (click)="focusLocationInput()">
              @for (loc of selectedLocations; track loc.displayName; let i = $index) {
                <span class="chip selected-chip">
                  {{ loc.displayName }}
                  <button class="chip-remove" (click)="removeLocation(i); $event.stopPropagation()">&times;</button>
                </span>
              }
              <input
                #locationInput
                class="combobox-input"
                type="text"
                [placeholder]="selectedLocations.length ? '' : 'Search for a city...'"
                [(ngModel)]="locationQuery"
                (ngModelChange)="onLocationQueryChange($event)"
                (focus)="showLocationDropdown = true"
                (blur)="onLocationBlur()"
              />
            </div>

            @if (showLocationDropdown && (locationResults.length > 0 || locationLoading || locationQuery.trim())) {
              <div class="dropdown">
                @if (locationLoading) {
                  <div class="dropdown-item empty-item">Searching...</div>
                } @else {
                  @for (loc of locationResults; track loc.displayName) {
                    <div class="dropdown-item" [class.is-selected]="isLocationSelected(loc)" (mousedown)="selectLocation(loc)">
                      <span>{{ loc.displayName }}</span>
                      @if (isLocationSelected(loc)) {
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      }
                    </div>
                  }
                  @if (locationResults.length === 0 && locationQuery.trim()) {
                    <div class="dropdown-item empty-item">No cities found</div>
                  }
                }
              </div>
            }
          </div>
        </div>

        <!-- Section 4 & 5: Email Integration -->
        <div class="section">
          <span class="section-label">Email Integration</span>
          <p class="section-hint">Connect Gmail or Outlook to automatically import recruiter emails. Only one account can be connected at a time.</p>

          <div class="email-integration-row">

            <!-- Gmail -->
            <div class="email-provider-card" [class.email-provider-card--active]="gmailConnected || gmailJustConnected">
              <div class="email-provider-header">
                <span class="email-provider-name">Gmail</span>
                @if (gmailConnected || gmailJustConnected) {
                  <span class="email-connected-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Connected
                  </span>
                }
              </div>

              @if (confirmConnect === 'gmail') {
                <div class="email-switch-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>This will disconnect your Outlook.</span>
                </div>
                <div class="email-switch-actions">
                  <button class="email-switch-confirm-btn" [disabled]="confirmSwitching" (click)="confirmSwitch()">
                    {{ confirmSwitching ? 'Connecting…' : 'Yes, switch to Gmail' }}
                  </button>
                  <button class="email-switch-cancel-btn" [disabled]="confirmSwitching" (click)="cancelConfirm()">Cancel</button>
                </div>
              } @else if (!(gmailConnected || gmailJustConnected)) {
                <button class="generate-btn" (click)="connectGmail()">Connect Gmail</button>
              }
            </div>

            <div class="email-provider-divider">or</div>

            <!-- Outlook -->
            <div class="email-provider-card" [class.email-provider-card--active]="outlookConnected || outlookJustConnected">
              <div class="email-provider-header">
                <span class="email-provider-name">Outlook</span>
                @if (outlookConnected || outlookJustConnected) {
                  <span class="email-connected-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Connected
                  </span>
                }
              </div>

              @if (confirmConnect === 'outlook') {
                <div class="email-switch-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>This will disconnect your Gmail.</span>
                </div>
                <div class="email-switch-actions">
                  <button class="email-switch-confirm-btn" [disabled]="confirmSwitching" (click)="confirmSwitch()">
                    {{ confirmSwitching ? 'Connecting…' : 'Yes, switch to Outlook' }}
                  </button>
                  <button class="email-switch-cancel-btn" [disabled]="confirmSwitching" (click)="cancelConfirm()">Cancel</button>
                </div>
              } @else if (!(outlookConnected || outlookJustConnected)) {
                <button class="generate-btn" (click)="connectOutlook()">Connect Outlook</button>
              }
            </div>

          </div>
        </div>

        <!-- Section 6: Extension Token — hidden for now -->
        <!--
        @if (!tokenUnavailable) {
        <div class="section">
          <span class="section-label">Chrome Extension Token</span>
          <p class="section-hint">Generate a token to connect the Job Copilot Chrome extension to this app.</p>

          @if (tokenLoading) {
            <div class="token-loading">Loading…</div>
          } @else if (apiToken) {
            <div class="token-display">
              <span class="token-value">{{ maskedToken }}</span>
              <div class="token-actions">
                <button class="token-btn copy-btn" (click)="copyToken()">
                  {{ tokenCopied ? '✓ Copied' : 'Copy' }}
                </button>
                <button class="token-btn revoke-btn" (click)="revokeToken()">Revoke</button>
              </div>
            </div>
          } @else {
            <button class="generate-btn" (click)="generateToken()">Generate Token</button>
          }
        </div>
        }
        -->

        <div class="modal-actions">
          <button class="btn cancel" (click)="onCancel()">Cancel</button>
          <button class="btn save" (click)="onSave()" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: #fff;
      border-radius: 14px;
      padding: 1.75rem;
      width: 520px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 1.5rem;
    }

    /* Sections */
    .section {
      margin-bottom: 1.5rem;
    }
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      display: block;
    }

    /* Toggle group */
    .toggle-group {
      display: flex;
      gap: 0;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      overflow: hidden;
    }
    .toggle-btn {
      flex: 1;
      padding: 0.6rem 1rem;
      border: none;
      background: #fff;
      font-size: 0.85rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }
    .toggle-btn:first-child {
      border-right: 1px solid #d1d5db;
    }
    .toggle-btn.active {
      background: #4f46e5;
      color: #fff;
    }
    .toggle-btn:hover:not(.active) {
      background: #f3f4f6;
    }

    /* Combobox */
    .combobox-wrapper {
      position: relative;
    }
    .combobox {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: text;
      transition: border-color 0.2s, box-shadow 0.2s;
      min-height: 42px;
      align-items: center;
    }
    .combobox.focused {
      border-color: #4f46e5;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    }
    .combobox-input {
      flex: 1;
      min-width: 120px;
      border: none;
      outline: none;
      font-size: 0.85rem;
      padding: 0.2rem 0.25rem;
      background: transparent;
    }

    /* Chips */
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.6rem;
      border-radius: 16px;
      font-size: 0.78rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .selected-chip {
      background: #4f46e5;
      color: #fff;
    }
    .custom-chip {
      background: #eef2ff;
      color: #4f46e5;
      border: 1px solid #c7d2fe;
    }
    .chip-remove {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.95rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      display: flex;
      align-items: center;
    }
    .chip-remove:hover {
      color: #fff;
    }
    .chip-remove.custom {
      color: #4f46e5;
      opacity: 0.6;
    }
    .chip-remove.custom:hover {
      opacity: 1;
    }

    /* Dropdown */
    .dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10;
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      font-size: 0.85rem;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s;
    }
    .dropdown-item:hover {
      background: #f3f4f6;
    }
    .dropdown-item.is-selected {
      color: #4f46e5;
      font-weight: 500;
    }
    .dropdown-item.empty-item {
      color: #9ca3af;
      cursor: default;
      font-style: italic;
    }
    .dropdown-item.empty-item:hover {
      background: transparent;
    }
    .dropdown-item.add-hint {
      color: #6b7280;
      font-style: italic;
      border-top: 1px solid #f3f4f6;
    }
    .dropdown-item.add-hint strong {
      color: #4f46e5;
      font-style: normal;
    }

    /* Email integration */
    .email-integration-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .email-provider-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.75rem;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      transition: border-color 0.2s;
      min-height: 90px;
    }
    .email-provider-card--active {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }
    .email-provider-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .email-provider-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #374151;
    }
    .email-connected-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: #dcfce7;
      color: #16a34a;
      border-radius: 20px;
      padding: 0.15rem 0.55rem;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .email-provider-divider {
      display: flex;
      align-items: center;
      font-size: 0.72rem;
      color: #9ca3af;
      font-weight: 500;
      padding-top: 1.6rem;
    }
    .email-switch-warning {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 7px;
      padding: 0.45rem 0.55rem;
      font-size: 0.73rem;
      color: #92400e;
      line-height: 1.4;
      svg { flex-shrink: 0; margin-top: 1px; }
    }
    .email-switch-actions {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .email-switch-confirm-btn {
      padding: 0.32rem 0.7rem;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
      white-space: nowrap;
      &:hover:not(:disabled) { background: #4338ca; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .email-switch-cancel-btn {
      padding: 0.32rem 0.7rem;
      background: #f1f5f9;
      color: #475569;
      border: none;
      border-radius: 7px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
      &:hover:not(:disabled) { background: #e2e8f0; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    /* Section hint */
    .section-hint {
      font-size: 0.78rem;
      color: #9ca3af;
      margin: 0 0 0.65rem;
      line-height: 1.4;
    }

    /* Token display */
    .token-loading {
      font-size: 0.82rem;
      color: #9ca3af;
    }
    .token-display {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
    }
    .token-value {
      flex: 1;
      font-family: monospace;
      font-size: 0.8rem;
      color: #374151;
      letter-spacing: 0.04em;
      user-select: all;
    }
    .token-actions {
      display: flex;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    .token-btn {
      padding: 0.28rem 0.7rem;
      border: none;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .copy-btn {
      background: #eef2ff;
      color: #4f46e5;
    }
    .copy-btn:hover { background: #e0e7ff; }
    .revoke-btn {
      background: #fee2e2;
      color: #991b1b;
    }
    .revoke-btn:hover { background: #fecaca; }
    .generate-btn {
      padding: 0.48rem 1rem;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.83rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .generate-btn:hover { background: #4338ca; }

    /* Actions */
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    .btn {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn.cancel {
      background: #e5e7eb;
      color: #374151;
    }
    .btn.cancel:hover {
      background: #d1d5db;
    }
    .btn.save {
      background: #4f46e5;
      color: #fff;
    }
    .btn.save:hover:not(:disabled) {
      background: #4338ca;
    }
    .btn.save:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `]
})
export class RoleCategoryModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @ViewChild('categoryInput') categoryInput!: ElementRef<HTMLInputElement>;
  @ViewChild('locationInput') locationInput!: ElementRef<HTMLInputElement>;

  // State
  loading = true;
  saving = false;

  // Experience level
  experienceLevel: 'EARLY_CAREER' | 'EXPERIENCED' = 'EARLY_CAREER';

  // Role categories
  allRoleCategories: RoleCategory[] = [];
  selectedRoleCategoryNames: string[] = [];
  customCategories: string[] = [];
  categoryQuery = '';
  showCategoryDropdown = false;

  // Gmail
  gmailConnected = false;
  gmailJustConnected = false;

  // Outlook
  outlookConnected = false;
  outlookJustConnected = false;

  // Switching confirmation
  confirmConnect: 'gmail' | 'outlook' | null = null;
  confirmSwitching = false;

  // Extension token — hidden for now
  // apiToken: ApiToken | null = null;
  // tokenLoading = false;
  // tokenCopied = false;
  // tokenUnavailable = false;

  // Locations
  selectedLocations: PreferredLocation[] = [];
  locationQuery = '';
  locationResults: PreferredLocation[] = [];
  showLocationDropdown = false;
  locationLoading = false;
  private locationSearch$ = new Subject<string>();

  constructor(
    private apiService: ApiService,
    private toastService: ToastService,
    private route: ActivatedRoute
  ) {}

  // get maskedToken(): string {
  //   if (!this.apiToken?.token) return '';
  //   const t = this.apiToken.token;
  //   return t.substring(0, 8) + '•'.repeat(Math.max(0, t.length - 8));
  // }

  ngOnInit(): void {
    this.gmailJustConnected = this.route.snapshot.queryParamMap.get('gmail') === 'connected';
    this.apiService.getGmailStatus().subscribe({
      next: ({ connected }) => { this.gmailConnected = connected; }
    });
    this.outlookJustConnected = this.route.snapshot.queryParamMap.get('outlook') === 'connected';
    this.apiService.getOutlookStatus().subscribe({
      next: ({ connected }) => { this.outlookConnected = connected; }
    });
    // this.loadToken();
    this.locationSearch$.pipe(
      debounceTime(300),
      switchMap(query => {
        if (!query.trim()) {
          this.locationLoading = false;
          return [];
        }
        return this.apiService.searchLocations(query);
      })
    ).subscribe({
      next: (results) => {
        this.locationResults = results;
        this.locationLoading = false;
      },
      error: () => {
        this.locationLoading = false;
      }
    });

    forkJoin({
      prefs: this.apiService.getPreferences(),
      categories: this.apiService.getRoleCategories()
    }).subscribe({
      next: ({ prefs, categories }) => {
        this.allRoleCategories = categories;
        if (prefs.experienceLevel) {
          this.experienceLevel = prefs.experienceLevel;
        }
        this.selectedRoleCategoryNames = [...(prefs.preferredRoleCategories || [])];
        this.selectedLocations = [...(prefs.preferredLocations || [])];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.locationSearch$.complete();
  }

  // --- Category methods ---

  focusCategoryInput(): void {
    this.categoryInput?.nativeElement.focus();
  }

  getFilteredCategories(): RoleCategory[] {
    const query = this.categoryQuery.trim().toLowerCase();
    return this.allRoleCategories.filter(cat => {
      if (!query) return true;
      return cat.name.toLowerCase().includes(query);
    });
  }

  isCategorySelected(name: string): boolean {
    return this.selectedRoleCategoryNames.includes(name) || this.customCategories.includes(name);
  }

  hasCategoryExactMatch(): boolean {
    const query = this.categoryQuery.trim().toLowerCase();
    if (!query) return false;
    return this.allRoleCategories.some(c => c.name.toLowerCase() === query)
      || this.customCategories.some(n => n.toLowerCase() === query)
      || this.selectedRoleCategoryNames.some(n => n.toLowerCase() === query);
  }

  toggleCategory(name: string): void {
    const idx = this.selectedRoleCategoryNames.indexOf(name);
    if (idx >= 0) {
      this.selectedRoleCategoryNames.splice(idx, 1);
    } else {
      this.selectedRoleCategoryNames.push(name);
    }
  }

  removeCategoryByName(name: string): void {
    this.selectedRoleCategoryNames = this.selectedRoleCategoryNames.filter(n => n !== name);
  }

  removeCustomCategory(index: number): void {
    this.customCategories.splice(index, 1);
  }

  onCategoryEnter(event: Event): void {
    event.preventDefault();
    this.addCustomCategory();
  }

  addCustomCategory(): void {
    const name = this.categoryQuery.trim();
    if (!name) return;
    if (this.hasCategoryExactMatch()) return;
    this.customCategories.push(name);
    this.categoryQuery = '';
  }

  onCategoryBlur(): void {
    setTimeout(() => this.showCategoryDropdown = false, 150);
  }

  // --- Location methods ---

  focusLocationInput(): void {
    this.locationInput?.nativeElement.focus();
  }

  onLocationQueryChange(query: string): void {
    if (query.trim()) {
      this.locationLoading = true;
    }
    this.locationSearch$.next(query);
  }

  isLocationSelected(loc: PreferredLocation): boolean {
    return this.selectedLocations.some(
      s => s.cityName === loc.cityName && s.countryCode === loc.countryCode
    );
  }

  selectLocation(loc: PreferredLocation): void {
    if (this.isLocationSelected(loc)) {
      this.selectedLocations = this.selectedLocations.filter(
        s => !(s.cityName === loc.cityName && s.countryCode === loc.countryCode)
      );
    } else {
      this.selectedLocations.push(loc);
    }
    this.locationQuery = '';
    this.locationResults = [];
  }

  removeLocation(index: number): void {
    this.selectedLocations.splice(index, 1);
  }

  onLocationBlur(): void {
    setTimeout(() => this.showLocationDropdown = false, 150);
  }

  // --- Gmail ---

  connectGmail(): void {
    if (this.outlookConnected) {
      this.confirmConnect = 'gmail';
      return;
    }
    this.apiService.getGmailConnectUrl().subscribe({
      next: ({ url }) => { window.location.href = url; }
    });
  }

  connectOutlook(): void {
    if (this.gmailConnected) {
      this.confirmConnect = 'outlook';
      return;
    }
    this.apiService.getOutlookConnectUrl().subscribe({
      next: ({ url }) => { window.location.href = url; }
    });
  }

  confirmSwitch(): void {
    this.confirmSwitching = true;
    if (this.confirmConnect === 'gmail') {
      this.apiService.disconnectOutlook().subscribe({
        next: () => {
          this.apiService.getGmailConnectUrl().subscribe({
            next: ({ url }) => { window.location.href = url; }
          });
        },
        error: () => {
          this.confirmSwitching = false;
          this.toastService.show('Failed to disconnect Outlook — please try again', 'error');
        }
      });
    } else {
      this.apiService.disconnectGmail().subscribe({
        next: () => {
          this.apiService.getOutlookConnectUrl().subscribe({
            next: ({ url }) => { window.location.href = url; }
          });
        },
        error: () => {
          this.confirmSwitching = false;
          this.toastService.show('Failed to disconnect Gmail — please try again', 'error');
        }
      });
    }
  }

  cancelConfirm(): void {
    this.confirmConnect = null;
  }

  // --- Extension token — hidden for now ---

  // loadToken(): void {
  //   this.tokenLoading = true;
  //   this.apiService.getApiToken().subscribe({
  //     next: (token) => { this.apiToken = token; this.tokenLoading = false; },
  //     error: (err) => { this.tokenLoading = false; if (err?.status === 403) this.tokenUnavailable = true; }
  //   });
  // }

  // generateToken(): void {
  //   this.apiService.generateApiToken().subscribe({
  //     next: (token) => { this.apiToken = token; }
  //   });
  // }

  // copyToken(): void {
  //   if (!this.apiToken?.token) return;
  //   navigator.clipboard.writeText(this.apiToken.token).then(() => {
  //     this.tokenCopied = true;
  //     setTimeout(() => this.tokenCopied = false, 2000);
  //   });
  // }

  // revokeToken(): void {
  //   this.apiService.revokeApiToken().subscribe({
  //     next: () => { this.apiToken = null; }
  //   });
  // }

  // --- Save / Cancel ---

  onSave(): void {
    this.saving = true;
    const req: UserPreferencesRequest = {
      experienceLevel: this.experienceLevel,
      preferredRoleCategories: [...this.selectedRoleCategoryNames, ...this.customCategories],
      preferredLocations: this.selectedLocations
    };
    this.apiService.savePreferences(req).subscribe({
      next: () => {
        this.toastService.show('Preferences saved');
        this.close.emit();
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  onCancel(): void {
    this.close.emit();
  }
}
