import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;

  if (localStorage.getItem('jwt_token')) return true;
  router.navigate(['/login']);
  return false;
};

export const studentGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;
  if (!localStorage.getItem('jwt_token')) {
    router.navigate(['/login']);
    return false;
  }
  if (localStorage.getItem('account_mode') === 'ADVISOR') {
    router.navigate(['/school/support-queue']);
    return false;
  }
  return true;
};

export const advisorGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;
  if (!localStorage.getItem('jwt_token')) {
    router.navigate(['/login']);
    return false;
  }
  if (localStorage.getItem('account_mode') !== 'ADVISOR') {
    router.navigate(['/']);
    return false;
  }
  return true;
};
