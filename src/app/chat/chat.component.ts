import { Component, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLElement>;

  isOpen = false;
  conversationId = crypto.randomUUID();
  messages: ChatMessage[] = [];
  inputText = '';
  isLoading = false;

  private readonly chatUrl = `${environment.apiUrl}/chat`;

  constructor(private zone: NgZone, private sanitizer: DomSanitizer, private auth: AuthService) {}

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  renderMarkdown(text: string): SafeHtml {
    const lines = text.split('\n');
    const result: string[] = [];
    let inList = false;

    for (const line of lines) {
      const listMatch = line.match(/^[-*]\s+(.+)$/);
      if (listMatch) {
        if (!inList) { result.push('<ul>'); inList = true; }
        result.push(`<li>${this.formatInline(listMatch[1])}</li>`);
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        if (line.trim() === '') {
          result.push('<div class="md-spacer"></div>');
        } else {
          result.push(`<p>${this.formatInline(line)}</p>`);
        }
      }
    }
    if (inList) result.push('</ul>');

    return this.sanitizer.bypassSecurityTrustHtml(result.join(''));
  }

  private formatInline(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', text });
    this.inputText = '';
    this.isLoading = true;
    this.scrollToBottom();

    const botEntry: ChatMessage = { role: 'bot', text: '' };
    this.messages.push(botEntry);

    const token = this.auth.getToken();
    fetch(this.chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message: text, conversationId: this.conversationId })
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const read = (): void => {
        reader.read().then(({ done, value }) => {
          if (done) {
            this.zone.run(() => { this.isLoading = false; });
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const content = line.substring(5).replace(/\r$/, '');
              if (content === '[DONE]') continue;
              if (content.length > 0) {
                this.zone.run(() => {
                  botEntry.text += content;
                  this.scrollToBottom();
                });
              }
            }
          }
          read();
        }).catch((err) => {
          console.error('Chat stream error:', err);
          this.zone.run(() => {
            // If we already received content, the stream likely just closed — don't wipe it
            if (!botEntry.text) {
              botEntry.text = 'Something went wrong. Please try again.';
            }
            this.isLoading = false;
          });
        });
      };

      read();
    }).catch(() => {
      this.zone.run(() => {
        botEntry.text = 'Could not connect to the assistant. Please try again.';
        this.isLoading = false;
      });
    });
  }

  newConversation(): void {
    this.conversationId = crypto.randomUUID();
    this.messages = [];
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
