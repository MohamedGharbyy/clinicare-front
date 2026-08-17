import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { App } from './app';
import { AuthService } from './auth/auth.service';
import { authRedirectGuard } from './core/guards/auth-redirect.guard';

describe('App', () => {
  const mockRouter = {
    createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((commands: string[]) => commands),
  };

  beforeEach(async () => {
    mockRouter.createUrlTree.calls.reset();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 1, email: 'doctor@test.com', role: 'DOCTOR' }),
          },
        },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should redirect authenticated users away from the login page', () => {
    const result = TestBed.runInInjectionContext(() =>
      authRedirectGuard(undefined as never, { url: '/login' } as never),
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/doctor/dashboard']);
    expect(result).toEqual(['/doctor/dashboard']);
  });
});
