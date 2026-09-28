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
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="preferences-title" (click)="$event.stopPropagation()">
        <header class="preferences-header">
          <div class="preferences-header-copy">
            <span class="preferences-eyebrow">Your workspace</span>
            <h2 class="modal-title" id="preferences-title">Preferences</h2>
            <p class="preferences-subtitle">Personalize job matching and keep application updates connected.</p>
          </div>
          <button type="button" class="modal-close" aria-label="Close preferences" (click)="onCancel()">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        @if (loading) {
          <div class="preferences-loading">
            <span class="preferences-spinner"></span>
            <span>Loading your preferences...</span>
          </div>
        } @else {
        <div class="preferences-layout">
          <section class="preferences-panel search-preferences">
            <div class="panel-heading">
              <div class="panel-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <div>
                <h3>Job search profile</h3>
                <p>Used across job discovery, fit analysis, and career intelligence.</p>
              </div>
            </div>

        <!-- Section 1: Experience Level -->
        <div class="section">
          <span class="section-label">Career stage</span>
          <p class="section-hint">This helps tailor role suggestions and guidance.</p>
          <div class="toggle-group">
            <button
              type="button"
              class="toggle-btn"
              [class.active]="experienceLevel === 'EARLY_CAREER'"
              (click)="experienceLevel = 'EARLY_CAREER'"
            >Student / early career</button>
            <button
              type="button"
              class="toggle-btn"
              [class.active]="experienceLevel === 'EXPERIENCED'"
              (click)="experienceLevel = 'EXPERIENCED'"
            >Experienced professional</button>
          </div>
        </div>

        <!-- Section 2: Preferred Role Categories -->
        <div class="section">
          <div class="section-label-row">
            <span class="section-label">Target role categories</span>
            @if (selectedRoleCategoryNames.length + customCategories.length) {
              <span class="selection-count">{{ selectedRoleCategoryNames.length + customCategories.length }} selected</span>
            }
          </div>
          <p class="section-hint">Choose the role families you are actively targeting.</p>
          <div class="combobox-wrapper">
            <div class="combobox" [class.focused]="showCategoryDropdown" (click)="focusCategoryInput()">
              @for (name of selectedRoleCategoryNames; track name) {
                <span class="chip selected-chip">
                  {{ name }}
                  <button type="button" class="chip-remove" [attr.aria-label]="'Remove ' + name" (click)="removeCategoryByName(name); $event.stopPropagation()">&times;</button>
                </span>
              }
              @for (name of customCategories; track name; let i = $index) {
                <span class="chip custom-chip">
                  {{ name }}
                  <button type="button" class="chip-remove custom" [attr.aria-label]="'Remove ' + name" (click)="removeCustomCategory(i); $event.stopPropagation()">&times;</button>
                </span>
              }
              <input
                #categoryInput
                class="combobox-input"
                type="text"
                aria-label="Search or add a role category"
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
        <div class="section section--last">
          <div class="section-label-row">
            <span class="section-label">Preferred locations</span>
            @if (selectedLocations.length) {
              <span class="selection-count">{{ selectedLocations.length }} selected</span>
            }
          </div>
          <p class="section-hint">Add the cities you want included in job discovery.</p>
          <div class="combobox-wrapper">
            <div class="combobox" [class.focused]="showLocationDropdown" (click)="focusLocationInput()">
              @for (loc of selectedLocations; track loc.displayName; let i = $index) {
                <span class="chip selected-chip">
                  {{ loc.displayName }}
                  <button type="button" class="chip-remove" [attr.aria-label]="'Remove ' + loc.displayName" (click)="removeLocation(i); $event.stopPropagation()">&times;</button>
                </span>
              }
              <input
                #locationInput
                class="combobox-input"
                type="text"
                aria-label="Search for a preferred city"
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
          </section>

        <!-- Section 4 & 5: Email Integration -->
          <section class="preferences-panel email-preferences">
            <div class="panel-heading">
              <div class="panel-icon panel-icon--green" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>
                </svg>
              </div>
              <div>
                <h3>Email sync</h3>
                <p>Import recruiter updates and keep application statuses current.</p>
              </div>
            </div>
            <div class="email-guidance">
              Connect one provider at a time. You can switch providers whenever needed.
            </div>

          <div class="email-integration-row">

            <!-- Gmail -->
            <div class="email-provider-card" [class.email-provider-card--active]="gmailConnected || gmailJustConnected" [class.email-provider-card--warning]="gmailNeedsReconnect">
              <div class="email-provider-header">
                <div class="provider-identity">
                  <span class="provider-mark provider-mark--gmail">G</span>
                  <div>
                    <span class="email-provider-name">Gmail</span>
                    <span class="provider-description">Google account</span>
                  </div>
                </div>
                @if (gmailConnected || gmailJustConnected) {
                  <span class="email-connected-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Connected
                  </span>
                } @else if (gmailNeedsReconnect) {
                  <span class="email-reconnect-badge">Reconnect required</span>
                }
              </div>

              @if (gmailConnected || gmailNeedsReconnect || gmailStatus === 'ERROR') {
                <div class="email-provider-health">
                  <div class="sync-detail">
                    <span class="sync-detail-label">Last successful sync</span>
                    <strong>{{ formatSyncTime(gmailLastSuccessfulPollAt) }}</strong>
                  </div>
                  @if (gmailStatus === 'ERROR') {
                    <span class="email-sync-error" [title]="gmailStatusMessage">Sync issue</span>
                  }
                  <div class="provider-actions">
                    @if (gmailConnected || gmailStatus === 'ERROR') {
                      <button type="button" class="email-sync-btn" [disabled]="gmailSyncing" (click)="syncGmailNow()">
                        {{ gmailSyncing ? 'Syncing...' : (gmailStatus === 'ERROR' ? 'Retry sync' : 'Sync now') }}
                      </button>
                    }
                    @if (gmailConnected || gmailNeedsReconnect || gmailStatus === 'ERROR') {
                      <button type="button" class="email-disconnect-btn" [disabled]="disconnectingProvider !== null" (click)="disconnectGmail()">
                        Disconnect
                      </button>
                    }
                  </div>
                </div>
              }

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
                <button type="button" class="generate-btn" (click)="connectGmail()">{{ gmailNeedsReconnect ? 'Reconnect Gmail' : 'Connect Gmail' }}</button>
              }
            </div>

            <!-- Outlook -->
            <div class="email-provider-card" [class.email-provider-card--active]="outlookConnected || outlookJustConnected" [class.email-provider-card--warning]="outlookNeedsReconnect">
              <div class="email-provider-header">
                <div class="provider-identity">
                  <span class="provider-mark provider-mark--outlook">O</span>
                  <div>
                    <span class="email-provider-name">Outlook</span>
                    <span class="provider-description">Microsoft account</span>
                  </div>
                </div>
                @if (outlookConnected || outlookJustConnected) {
                  <span class="email-connected-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Connected
                  </span>
                } @else if (outlookNeedsReconnect) {
                  <span class="email-reconnect-badge">Reconnect required</span>
                }
              </div>

              @if (outlookConnected || outlookNeedsReconnect || outlookStatus === 'ERROR') {
                <div class="email-provider-health">
                  <div class="sync-detail">
                    <span class="sync-detail-label">Last successful sync</span>
                    <strong>{{ formatSyncTime(outlookLastSuccessfulPollAt) }}</strong>
                  </div>
                  @if (outlookStatus === 'ERROR') {
                    <span class="email-sync-error" [title]="outlookStatusMessage">Sync issue</span>
                  }
                  <div class="provider-actions">
                    @if (outlookConnected || outlookStatus === 'ERROR') {
                      <button type="button" class="email-sync-btn" [disabled]="outlookSyncing" (click)="syncOutlookNow()">
                        {{ outlookSyncing ? 'Syncing...' : (outlookStatus === 'ERROR' ? 'Retry sync' : 'Sync now') }}
                      </button>
                    }
                    @if (outlookConnected || outlookNeedsReconnect || outlookStatus === 'ERROR') {
                      <button type="button" class="email-disconnect-btn" [disabled]="disconnectingProvider !== null" (click)="disconnectOutlook()">
                        Disconnect
                      </button>
                    }
                  </div>
                </div>
              }

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
                <button type="button" class="generate-btn" (click)="connectOutlook()">{{ outlookNeedsReconnect ? 'Reconnect Outlook' : 'Connect Outlook' }}</button>
              }
            </div>

          </div>
          </section>
        </div>
        }

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

        <footer class="modal-actions">
          <span class="modal-actions-hint">Changes affect future recommendations and insights.</span>
          <div class="modal-action-buttons">
            <button type="button" class="btn cancel" (click)="onCancel()">Cancel</button>
            <button type="button" class="btn save" (click)="onSave()" [disabled]="loading || saving">
              {{ saving ? 'Saving...' : 'Save preferences' }}
            </button>
          </div>
        </footer>
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
    .email-provider-card--warning {
      border-color: #fcd34d;
      background: #fffbeb;
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
    .email-reconnect-badge {
      display: inline-flex;
      align-items: center;
      background: #fef3c7;
      color: #b45309;
      border-radius: 20px;
      padding: 0.15rem 0.55rem;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .email-provider-health {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.45rem;
      flex-wrap: wrap;
      color: #6b7280;
      font-size: 0.68rem;
    }
    .email-sync-error {
      color: #b45309;
      font-weight: 700;
    }
    .email-sync-btn {
      border: 0;
      padding: 0;
      background: transparent;
      color: #4f46e5;
      cursor: pointer;
      font-size: 0.68rem;
      font-weight: 700;
    }
    .email-sync-btn:disabled {
      color: #9ca3af;
      cursor: wait;
    }
    .email-disconnect-btn {
      border: 0;
      padding: 0;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      font-size: 0.68rem;
      font-weight: 700;
    }
    .email-disconnect-btn:hover {
      color: #b91c1c;
    }
    .email-disconnect-btn:disabled {
      color: #9ca3af;
      cursor: wait;
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

    /* Preferences workspace */
    .modal-backdrop {
      padding: 1rem;
      background: rgba(15, 23, 42, 0.58);
      backdrop-filter: blur(4px);
      z-index: 5000;
    }
    .modal-card {
      width: min(920px, calc(100vw - 2rem));
      max-width: none;
      max-height: min(760px, calc(100vh - 2rem));
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid #dbe3ee;
      border-radius: 12px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
    }
    .preferences-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.35rem 1.6rem 1.2rem;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .preferences-header-copy {
      min-width: 0;
    }
    .preferences-eyebrow {
      display: block;
      margin-bottom: 0.25rem;
      color: #4f46e5;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .modal-title {
      margin: 0;
      color: #0f172a;
      font-size: 1.45rem;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: 0;
    }
    .preferences-subtitle {
      margin: 0.35rem 0 0;
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .modal-close {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      color: #64748b;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .modal-close:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #0f172a;
    }
    .modal-close:focus-visible,
    .btn:focus-visible,
    .generate-btn:focus-visible,
    .email-sync-btn:focus-visible,
    .email-disconnect-btn:focus-visible,
    .toggle-btn:focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }
    .preferences-loading {
      min-height: 340px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      color: #64748b;
      font-size: 0.86rem;
    }
    .preferences-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #cbd5e1;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: preferences-spin 0.75s linear infinite;
    }
    @keyframes preferences-spin { to { transform: rotate(360deg); } }
    .preferences-layout {
      min-height: 0;
      overflow-y: auto;
      display: grid;
      grid-template-columns: minmax(0, 1.14fr) minmax(320px, 0.86fr);
      background: #ffffff;
    }
    .preferences-panel {
      min-width: 0;
      padding: 1.45rem 1.6rem 1.6rem;
    }
    .email-preferences {
      border-left: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .panel-heading {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 1.15rem;
    }
    .panel-heading h3 {
      margin: 0;
      color: #0f172a;
      font-size: 1rem;
      line-height: 1.3;
      font-weight: 800;
      letter-spacing: 0;
    }
    .panel-heading p {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.76rem;
      line-height: 1.45;
    }
    .panel-icon {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #eef2ff;
      color: #4f46e5;
    }
    .panel-icon--green {
      background: #ecfdf5;
      color: #059669;
    }
    .section {
      margin: 0;
      padding: 1rem 0;
      border-top: 1px solid #eef2f7;
    }
    .section--last {
      padding-bottom: 0;
    }
    .section-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .section-label {
      margin: 0;
      color: #334155;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: none;
      letter-spacing: 0;
    }
    .section-hint {
      margin: 0.25rem 0 0.65rem;
      color: #64748b;
      font-size: 0.73rem;
      line-height: 1.4;
    }
    .selection-count {
      color: #64748b;
      font-size: 0.68rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .toggle-group {
      padding: 3px;
      gap: 3px;
      overflow: visible;
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #f1f5f9;
    }
    .toggle-btn {
      min-height: 36px;
      padding: 0.45rem 0.65rem;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #64748b;
      font-size: 0.76rem;
      font-weight: 700;
      font-family: inherit;
    }
    .toggle-btn:first-child {
      border-right: 0;
    }
    .toggle-btn.active {
      background: #ffffff;
      color: #3730a3;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    }
    .toggle-btn:hover:not(.active) {
      background: rgba(255, 255, 255, 0.7);
      color: #334155;
    }
    .combobox {
      min-height: 44px;
      padding: 0.4rem 0.45rem;
      gap: 0.35rem;
      border-color: #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
    }
    .combobox:hover {
      border-color: #94a3b8;
    }
    .combobox.focused {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }
    .combobox-input {
      min-width: 130px;
      color: #0f172a;
      font-family: inherit;
      font-size: 0.78rem;
    }
    .combobox-input::placeholder {
      color: #94a3b8;
    }
    .chip {
      min-height: 27px;
      padding: 0.22rem 0.5rem;
      border: 1px solid #c7d2fe;
      border-radius: 7px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .selected-chip,
    .custom-chip {
      background: #eef2ff;
      color: #3730a3;
      border-color: #c7d2fe;
    }
    .chip-remove,
    .chip-remove.custom {
      width: 16px;
      height: 16px;
      justify-content: center;
      border-radius: 4px;
      color: #6366f1;
      opacity: 0.8;
    }
    .chip-remove:hover,
    .chip-remove.custom:hover {
      background: #dbe3ff;
      color: #3730a3;
      opacity: 1;
    }
    .dropdown {
      margin-top: 6px;
      border-color: #dbe3ee;
      border-radius: 8px;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
      max-height: 220px;
      z-index: 30;
    }
    .dropdown-item {
      min-height: 38px;
      padding: 0.55rem 0.7rem;
      font-size: 0.78rem;
    }
    .email-guidance {
      margin-bottom: 0.9rem;
      padding: 0.65rem 0.75rem;
      border-left: 3px solid #a5b4fc;
      background: #ffffff;
      color: #475569;
      font-size: 0.72rem;
      line-height: 1.45;
    }
    .email-integration-row {
      flex-direction: column;
      gap: 0.7rem;
    }
    .email-provider-divider {
      display: none;
    }
    .email-provider-card {
      width: 100%;
      min-height: 0;
      padding: 0.8rem;
      gap: 0.7rem;
      border-color: #dbe3ee;
      border-radius: 8px;
      background: #ffffff;
      box-sizing: border-box;
    }
    .email-provider-card--active {
      border-color: #86efac;
      box-shadow: inset 3px 0 0 #10b981;
      background: #ffffff;
    }
    .email-provider-card--warning {
      border-color: #fbbf24;
      box-shadow: inset 3px 0 0 #f59e0b;
      background: #ffffff;
    }
    .provider-identity {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .provider-identity > div {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .provider-mark {
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 7px;
      font-size: 0.8rem;
      font-weight: 900;
    }
    .provider-mark--gmail {
      background: #fef2f2;
      color: #dc2626;
    }
    .provider-mark--outlook {
      background: #eff6ff;
      color: #2563eb;
    }
    .email-provider-name {
      color: #0f172a;
      font-size: 0.8rem;
      font-weight: 800;
    }
    .provider-description {
      margin-top: 0.05rem;
      color: #94a3b8;
      font-size: 0.65rem;
    }
    .email-connected-badge,
    .email-reconnect-badge {
      border-radius: 6px;
      padding: 0.22rem 0.45rem;
      font-size: 0.62rem;
      white-space: nowrap;
    }
    .email-provider-health {
      align-items: stretch;
      flex-direction: column;
      gap: 0.65rem;
      padding-top: 0.65rem;
      border-top: 1px solid #eef2f7;
      font-size: 0.68rem;
    }
    .sync-detail {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .sync-detail-label {
      color: #94a3b8;
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .sync-detail strong {
      color: #475569;
      font-size: 0.68rem;
      font-weight: 700;
    }
    .provider-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .email-sync-btn,
    .email-disconnect-btn {
      min-height: 30px;
      padding: 0.35rem 0.6rem;
      border: 1px solid #dbe3ee;
      border-radius: 6px;
      background: #ffffff;
      font-family: inherit;
      font-size: 0.68rem;
      font-weight: 800;
    }
    .email-sync-btn {
      color: #4338ca;
    }
    .email-sync-btn:hover:not(:disabled) {
      background: #eef2ff;
      border-color: #c7d2fe;
    }
    .email-disconnect-btn {
      color: #64748b;
    }
    .email-disconnect-btn:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fecaca;
      color: #b91c1c;
    }
    .generate-btn {
      width: 100%;
      min-height: 36px;
      padding: 0.45rem 0.75rem;
      border-radius: 7px;
      background: #4f46e5;
      font-size: 0.72rem;
      font-weight: 800;
    }
    .generate-btn:hover {
      background: #4338ca;
    }
    .email-switch-warning {
      border-radius: 7px;
    }
    .modal-actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.6rem;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .modal-actions-hint {
      color: #64748b;
      font-size: 0.7rem;
      line-height: 1.4;
    }
    .modal-action-buttons {
      flex-shrink: 0;
      display: flex;
      gap: 0.6rem;
    }
    .btn {
      min-height: 38px;
      padding: 0.5rem 0.9rem;
      border: 1px solid transparent;
      border-radius: 7px;
      font-family: inherit;
      font-size: 0.76rem;
      font-weight: 800;
    }
    .btn.cancel {
      border-color: #dbe3ee;
      background: #ffffff;
      color: #475569;
    }
    .btn.cancel:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .btn.save {
      min-width: 144px;
      background: #4f46e5;
      color: #ffffff;
    }
    .btn.save:hover:not(:disabled) {
      background: #4338ca;
    }

    @media (max-width: 760px) {
      .modal-backdrop {
        padding: 0;
        align-items: stretch;
      }
      .modal-card {
        width: 100vw;
        max-height: 100vh;
        min-height: 100vh;
        border: 0;
        border-radius: 0;
      }
      .preferences-header {
        padding: 1rem;
      }
      .preferences-layout {
        grid-template-columns: 1fr;
      }
      .preferences-panel {
        padding: 1.1rem 1rem 1.25rem;
      }
      .email-preferences {
        border-left: 0;
        border-top: 1px solid #e2e8f0;
      }
      .modal-actions {
        padding: 0.8rem 1rem;
      }
      .modal-actions-hint {
        display: none;
      }
      .modal-action-buttons {
        width: 100%;
      }
      .modal-action-buttons .btn {
        flex: 1;
      }
    }

    @media (max-width: 430px) {
      .preferences-subtitle {
        max-width: 280px;
      }
      .toggle-group {
        flex-direction: column;
      }
      .toggle-btn {
        width: 100%;
      }
      .provider-actions {
        align-items: stretch;
        flex-direction: column;
      }
      .email-sync-btn,
      .email-disconnect-btn {
        width: 100%;
      }
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
  gmailNeedsReconnect = false;
  gmailStatus = 'DISCONNECTED';
  gmailStatusMessage = '';
  gmailLastSuccessfulPollAt: string | null = null;
  gmailSyncing = false;
  gmailJustConnected = false;

  // Outlook
  outlookConnected = false;
  outlookNeedsReconnect = false;
  outlookStatus = 'DISCONNECTED';
  outlookStatusMessage = '';
  outlookLastSuccessfulPollAt: string | null = null;
  outlookSyncing = false;
  outlookJustConnected = false;
  disconnectingProvider: 'gmail' | 'outlook' | null = null;

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
      next: ({ connected, status, message, lastSuccessfulPollAt }) => {
        this.gmailConnected = connected;
        this.gmailStatus = status;
        this.gmailStatusMessage = message ?? '';
        this.gmailLastSuccessfulPollAt = lastSuccessfulPollAt ?? null;
        this.gmailNeedsReconnect = status === 'REAUTH_REQUIRED';
      }
    });
    this.outlookJustConnected = this.route.snapshot.queryParamMap.get('outlook') === 'connected';
    this.apiService.getOutlookStatus().subscribe({
      next: ({ connected, status, message, lastSuccessfulPollAt }) => {
        this.outlookConnected = connected;
        this.outlookStatus = status;
        this.outlookStatusMessage = message ?? '';
        this.outlookLastSuccessfulPollAt = lastSuccessfulPollAt ?? null;
        this.outlookNeedsReconnect = status === 'REAUTH_REQUIRED';
      }
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

  formatSyncTime(value: string | null): string {
    if (!value) return 'Not synced yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not synced yet' : date.toLocaleString();
  }

  syncGmailNow(): void {
    if (this.gmailSyncing) return;
    this.gmailSyncing = true;
    this.apiService.syncGmail().subscribe({
      next: ({ connected, status, message, lastSuccessfulPollAt }) => {
        this.gmailConnected = connected;
        this.gmailStatus = status;
        this.gmailStatusMessage = message ?? '';
        this.gmailLastSuccessfulPollAt = lastSuccessfulPollAt ?? null;
        this.gmailNeedsReconnect = status === 'REAUTH_REQUIRED';
        this.gmailSyncing = false;
      },
      error: () => {
        this.gmailSyncing = false;
        this.toastService.show('Gmail sync could not be completed', 'error');
      }
    });
  }

  syncOutlookNow(): void {
    if (this.outlookSyncing) return;
    this.outlookSyncing = true;
    this.apiService.syncOutlook().subscribe({
      next: ({ connected, status, message, lastSuccessfulPollAt }) => {
        this.outlookConnected = connected;
        this.outlookStatus = status;
        this.outlookStatusMessage = message ?? '';
        this.outlookLastSuccessfulPollAt = lastSuccessfulPollAt ?? null;
        this.outlookNeedsReconnect = status === 'REAUTH_REQUIRED';
        this.outlookSyncing = false;
      },
      error: () => {
        this.outlookSyncing = false;
        this.toastService.show('Outlook sync could not be completed', 'error');
      }
    });
  }

  disconnectGmail(): void {
    if (!window.confirm('Disconnect Gmail? New recruiter emails will no longer be imported.')) return;
    this.disconnectingProvider = 'gmail';
    this.apiService.disconnectGmail().subscribe({
      next: () => {
        this.gmailConnected = false;
        this.gmailNeedsReconnect = false;
        this.gmailStatus = 'DISCONNECTED';
        this.gmailStatusMessage = '';
        this.gmailLastSuccessfulPollAt = null;
        this.disconnectingProvider = null;
        this.toastService.show('Gmail disconnected', 'success');
      },
      error: () => {
        this.disconnectingProvider = null;
        this.toastService.show('Could not disconnect Gmail', 'error');
      }
    });
  }

  disconnectOutlook(): void {
    if (!window.confirm('Disconnect Outlook? New recruiter emails will no longer be imported.')) return;
    this.disconnectingProvider = 'outlook';
    this.apiService.disconnectOutlook().subscribe({
      next: () => {
        this.outlookConnected = false;
        this.outlookNeedsReconnect = false;
        this.outlookStatus = 'DISCONNECTED';
        this.outlookStatusMessage = '';
        this.outlookLastSuccessfulPollAt = null;
        this.disconnectingProvider = null;
        this.toastService.show('Outlook disconnected', 'success');
      },
      error: () => {
        this.disconnectingProvider = null;
        this.toastService.show('Could not disconnect Outlook', 'error');
      }
    });
  }

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
