import { Component } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, Event } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ChatComponent } from './chat/chat.component';
import { ToastComponent } from './toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ChatComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  showShell = false;

  constructor(router: Router) {
    router.events.pipe(filter((e: Event): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(e => {
      const authRoutes = ['/login', '/signup'];
      this.showShell = !authRoutes.includes(e.urlAfterRedirects.split('?')[0]);
    });
  }
}
