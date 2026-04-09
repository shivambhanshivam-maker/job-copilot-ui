import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { ApplicationUpdate, PendingAction } from '../services/api.service';

@Component({
  selector: 'app-pending-action-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isNotification) {
      <div class="pending-action-row">
        <span class="pending-icon">&#9888;</span>
        <span class="pending-message">{{ message }}</span>
        @if (actionType === 'FOLLOW_UP_REFERRAL') {
          <button class="pending-btn yes" (click)="onYes()">Yes</button>
          <button class="pending-btn remind" (click)="onRemindLater()">No, But Remind Later</button>
          <button class="pending-btn delete" (click)="onDelete()">No, Delete Record</button>
        } @else {
          <button class="pending-btn close" (click)="onYes()">Yes, Close</button>
          <button class="pending-btn remind" (click)="onRemindLater()">No, Remind Later</button>
        }
      </div>
    } @else if (isUpdatesRow) {
      <div class="updates-row">
        <div class="updates-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Application Updates
        </div>
        <div class="updates-list">
          @for (update of updates; track update.timestamp) {
            <div class="update-item">
              <span class="update-date">{{ formatDate(update.timestamp) }}</span>
              <span class="update-summary">{{ update.summary }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .pending-action-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      background: #fef9c3;
      border-left: 4px solid #eab308;
      height: 100%;
      font-size: 0.85rem;
    }
    .pending-icon {
      color: #ca8a04;
      font-size: 1.1rem;
    }
    .pending-message {
      flex: 1;
      color: #713f12;
    }
    .pending-btn {
      padding: 0.3rem 0.75rem;
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .pending-btn.yes {
      background: #16a34a;
      color: #fff;
    }
    .pending-btn.yes:hover {
      background: #15803d;
    }
    .pending-btn.close {
      background: #4f46e5;
      color: #fff;
    }
    .pending-btn.close:hover {
      background: #4338ca;
    }
    .pending-btn.remind {
      background: #e5e7eb;
      color: #374151;
    }
    .pending-btn.remind:hover {
      background: #d1d5db;
    }
    .pending-btn.delete {
      background: #fee2e2;
      color: #991b1b;
    }
    .pending-btn.delete:hover {
      background: #fecaca;
    }

    .updates-row {
      padding: 0.75rem 1.25rem;
      background: #f0f4ff;
      border-left: 4px solid #4f46e5;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-sizing: border-box;
      overflow: hidden;
    }
    .updates-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .updates-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .update-item {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      font-size: 0.85rem;
    }
    .update-date {
      font-weight: 600;
      color: #4338ca;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .update-summary {
      color: #1e1b4b;
    }
  `]
})
export class PendingActionRendererComponent implements ICellRendererAngularComp {
  isNotification = false;
  isUpdatesRow = false;
  message = '';
  actionType = '';
  updates: ApplicationUpdate[] = [];
  private params!: ICellRendererParams;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.isNotification = !!params.data.isNotification;
    this.isUpdatesRow = !!params.data.isUpdatesRow;
    if (this.isNotification) {
      const action: PendingAction = params.data.pendingAction;
      this.message = action.message;
      this.actionType = action.actionType;
    }
    if (this.isUpdatesRow) {
      this.updates = params.data.updates || [];
    }
  }

  refresh(): boolean {
    return false;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const suffix = (() => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    })();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${day}${suffix} ${month}, ${year}`;
  }

  onYes(): void {
    this.params.context.onPendingActionYes(this.params.data.pendingAction);
  }

  onRemindLater(): void {
    this.params.context.onPendingActionRemindLater(this.params.data.pendingAction);
  }

  onDelete(): void {
    this.params.context.onPendingActionDelete(this.params.data.pendingAction);
  }
}
