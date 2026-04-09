import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, CvName } from '../services/api.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-cv-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-list.component.html',
  styleUrl: './cv-list.component.scss'
})
export class CvListComponent implements OnInit {
  cvNames: CvName[] = [];
  selectedCvId: string | null = null;
  cvText = '';
  isDefaultCvId: string | null = null;

  loadingList = false;
  loadingText = false;
  uploadingCv = false;
  settingDefaultId: string | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(private apiService: ApiService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.loadingList = true;
    this.apiService.getCvNames().subscribe({
      next: (names) => {
        this.cvNames = names;
        this.isDefaultCvId = names.find(c => c.isDefaultCv)?.id ?? null;
        this.loadingList = false;
      },
      error: () => {
        this.loadingList = false;
      }
    });
  }

  onAddCv(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCv = true;
    this.apiService.uploadCv(file).subscribe({
      next: (cv) => {
        this.cvNames.push({ id: cv.id, name: cv.name, isDefaultCv: false });
        this.selectedCvId = cv.id;
        this.cvText = cv.contentText;
        this.uploadingCv = false;
        this.toastService.show('CV uploaded successfully');
      },
      error: () => {
        this.uploadingCv = false;
      }
    });
    input.value = '';
  }

  setDefault(cv: CvName, event: Event): void {
    event.stopPropagation();
    if (this.settingDefaultId) return;
    this.settingDefaultId = cv.id;
    this.apiService.setDefaultCv(cv.id).subscribe({
      next: () => {
        this.isDefaultCvId = cv.id;
        this.settingDefaultId = null;
        this.toastService.show('Default CV updated');
      },
      error: () => {
        this.settingDefaultId = null;
      }
    });
  }

  selectCv(cv: CvName): void {
    this.selectedCvId = cv.id;
    this.loadingText = true;
    this.apiService.getCvText(cv.id).subscribe({
      next: (text) => {
        this.cvText = text;
        this.loadingText = false;
      },
      error: () => {
        this.loadingText = false;
      }
    });
  }
}
