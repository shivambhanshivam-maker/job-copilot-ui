import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, JobListing } from '../services/api.service';

@Component({
  selector: 'app-job-listings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-listings.component.html',
  styleUrl: './job-listings.component.scss'
})
export class JobListingsComponent implements OnInit {
  listings: JobListing[] = [];
  loading = false;
  searchQuery = '';
  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';
  selectedListing: JobListing | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.apiService.getJobListings().subscribe({
      next: (data) => { this.listings = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  @HostListener('document:keydown.escape')
  closeModal(): void {
    this.selectedListing = null;
  }

  get filteredListings(): JobListing[] {
    let list = [...this.listings];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(l =>
        l.employerName?.toLowerCase().includes(q) ||
        l.jobTitle?.toLowerCase().includes(q) ||
        l.jobLocation?.toLowerCase().includes(q) ||
        l.roleCategory?.toLowerCase().includes(q)
      );
    }
    if (this.sortField) {
      list.sort((a, b) => {
        const av: string = (a as any)[this.sortField] || '';
        const bv: string = (b as any)[this.sortField] || '';
        const cmp = av.localeCompare(bv);
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }

  setSort(field: string): void {
    if (this.sortField === field) {
      if (this.sortDir === 'asc') this.sortDir = 'desc';
      else this.sortField = '';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  getInitials(name: string | undefined): string {
    if (!name?.trim()) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  }

  formatPostedDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getScoreClass(score: number): string {
    if (score >= 70) return 'fit-high';
    if (score >= 40) return 'fit-med';
    return 'fit-low';
  }

  getScoreLabel(score: number): string {
    if (score >= 70) return 'Strong';
    if (score >= 40) return 'Moderate';
    return 'Weak';
  }

  getScoreGradient(score: number): string {
    const color = score >= 70 ? '#16a34a' : score >= 40 ? '#ea580c' : '#dc2626';
    return `conic-gradient(${color} ${score * 3.6}deg, #f3f4f6 0deg)`;
  }

  getScoreColor(score: number): string {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#ea580c';
    return '#dc2626';
  }

  getScoreGlow(score: number): string {
    if (score >= 70) return '0 0 28px rgba(22,163,74,0.28), 0 4px 20px rgba(0,0,0,0.1)';
    if (score >= 40) return '0 0 28px rgba(234,88,12,0.28), 0 4px 20px rgba(0,0,0,0.1)';
    return '0 0 28px rgba(220,38,38,0.28), 0 4px 20px rgba(0,0,0,0.1)';
  }

  getScoreCategory(score: number): string {
    if (score >= 70) return 'high';
    if (score >= 40) return 'med';
    return 'low';
  }

  openListing(listing: JobListing): void {
    this.selectedListing = listing;
  }

  applyNow(link: string, event: MouseEvent): void {
    event.stopPropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  }
}
