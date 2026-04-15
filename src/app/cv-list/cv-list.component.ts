import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, CvName } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, MarkdownStorage } from 'tiptap-markdown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-cv-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-list.component.html',
  styleUrl: './cv-list.component.scss'
})
export class CvListComponent implements OnInit, OnDestroy {
  cvNames: CvName[] = [];
  selectedCvId: string | null = null;
  isDefaultCvId: string | null = null;

  loadingList = false;
  loadingContent = false;
  uploadingCv = false;
  settingDefaultId: string | null = null;
  saving = false;
  hasMarkdown = false;
  isDirty = false;
  downloadingDocx = false;

  editor: Editor | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('editorEl') editorEl!: ElementRef<HTMLDivElement>;

  constructor(private apiService: ApiService, private toastService: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadingList = true;
    this.apiService.getCvNames().subscribe({
      next: (names) => {
        this.cvNames = names;
        this.isDefaultCvId = names.find(c => c.isDefaultCv)?.id ?? null;
        this.loadingList = false;
      },
      error: () => { this.loadingList = false; }
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
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
        this.uploadingCv = false;
        this.toastService.show('CV uploaded successfully');
        this.selectCv({ id: cv.id, name: cv.name, isDefaultCv: false });
      },
      error: () => { this.uploadingCv = false; }
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
      error: () => { this.settingDefaultId = null; }
    });
  }

  selectCv(cv: CvName): void {
    if (this.selectedCvId === cv.id) return;
    this.selectedCvId = cv.id;
    this.loadingContent = true;
    this.isDirty = false;

    // Try markdown first, fall back to plain text
    this.apiService.getCvMarkdown(cv.id).subscribe({
      next: (markdown) => {
        this.hasMarkdown = true;
        this.loadingContent = false;
        this.initEditor(markdown);
      },
      error: () => {
        this.apiService.getCvText(cv.id).subscribe({
          next: (text) => {
            this.hasMarkdown = false;
            this.loadingContent = false;
            this.initEditor(text);
          },
          error: () => { this.loadingContent = false; }
        });
      }
    });
  }

  private initEditor(content: string): void {
    this.editor?.destroy();
    this.cdr.detectChanges(); // ensure #editorEl is rendered before mounting
    setTimeout(() => {
      if (!this.editorEl?.nativeElement) return;
      this.editor = new Editor({
        element: this.editorEl.nativeElement,
        extensions: [
          StarterKit,
          Markdown.configure({
            html: false,
            tightLists: true,
            breaks: true,
          })
        ],
        content: '',
        onUpdate: () => { this.isDirty = true; }
      });
      if (this.hasMarkdown) {
        this.editor.commands.setContent(content);
      } else {
        this.editor.commands.setContent(`<pre>${content}</pre>`);
      }
    });
  }

  saveContent(): void {
    if (!this.editor || !this.selectedCvId) return;
    this.saving = true;
    const markdown = ((this.editor.storage as unknown as Record<string, MarkdownStorage>)['markdown']).getMarkdown();
    this.apiService.updateCvContent(this.selectedCvId, markdown).subscribe({
      next: () => {
        this.saving = false;
        this.isDirty = false;
        this.hasMarkdown = true;
        this.toastService.show('CV saved', 'success');
      },
      error: () => {
        this.saving = false;
        this.toastService.show('Failed to save — please try again', 'error');
      }
    });
  }

  downloadDocx(): void {
    if (!this.editor || !this.selectedCvId) return;
    this.downloadingDocx = true;
    const storage = this.editor.storage as unknown as Record<string, MarkdownStorage>;
    const markdown = storage['markdown'].getMarkdown();
    const lines = markdown.split('\n');
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (line.startsWith('### ')) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith('# ')) {
        children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
      } else if (line.startsWith('- ')) {
        children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
      } else if (line.match(/^\d+\. /)) {
        children.push(new Paragraph({ text: line.replace(/^\d+\. /, ''), numbering: { reference: 'default', level: 0 } }));
      } else if (line.trim() === '') {
        children.push(new Paragraph({ text: '' }));
      } else {
        // Handle inline bold (**text**)
        const runs: TextRun[] = [];
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else {
            runs.push(new TextRun({ text: part }));
          }
        }
        children.push(new Paragraph({ children: runs }));
      }
    }

    const cvName = this.cvNames.find(c => c.id === this.selectedCvId)?.name ?? 'cv';
    const doc = new Document({ sections: [{ children }] });
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${cvName.replace(/\.[^.]+$/, '')}.docx`);
      this.downloadingDocx = false;
    });
  }

  // Toolbar actions
  toggleBold(): void { this.editor?.chain().focus().toggleBold().run(); }
  toggleItalic(): void { this.editor?.chain().focus().toggleItalic().run(); }
  toggleH1(): void { this.editor?.chain().focus().toggleHeading({ level: 1 }).run(); }
  toggleH2(): void { this.editor?.chain().focus().toggleHeading({ level: 2 }).run(); }
  toggleH3(): void { this.editor?.chain().focus().toggleHeading({ level: 3 }).run(); }
  toggleBulletList(): void { this.editor?.chain().focus().toggleBulletList().run(); }
  toggleOrderedList(): void { this.editor?.chain().focus().toggleOrderedList().run(); }

  isActive(name: string, attrs?: Record<string, unknown>): boolean {
    return this.editor?.isActive(name, attrs) ?? false;
  }
}
