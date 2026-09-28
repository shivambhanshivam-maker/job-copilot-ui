import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RoleCategoryModalComponent } from './role-category-modal.component';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RoleCategoryModalComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  expanded = true;
  settingsOpen = false;
  userName = '';
  advisorAccess = false;

  constructor(private authService: AuthService, private apiService: ApiService) {
    this.userName = this.authService.getUserName();
    this.advisorAccess = this.authService.isAdvisorMode();
  }

  ngOnInit(): void {
    if (!this.advisorAccess) {
      this.apiService.getPreferences().subscribe();
      this.apiService.getRoleCategories().subscribe();
    }
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  logout(): void {
    this.authService.logout();
  }
}
