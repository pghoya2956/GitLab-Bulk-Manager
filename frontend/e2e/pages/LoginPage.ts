import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.locator('input[name="username"], input[type="email"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"]');
    this.loginButton = page.locator('button[type="submit"]').filter({ hasText: /login|sign in/i });
    this.errorMessage = page.locator('[role="alert"], .error-message');
    this.rememberMeCheckbox = page.locator('input[type="checkbox"][name="remember"]');
    this.forgotPasswordLink = page.locator('a').filter({ hasText: /forgot password/i });
  }

  async goto() {
    await this.navigate('/login');
  }

  async login(username: string, password: string, rememberMe: boolean = false) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    
    await this.loginButton.click();
    
    // Wait for either navigation or error message
    await Promise.race([
      this.page.waitForURL(/\/dashboard/, { timeout: 10000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 5000 }),
    ]);
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  async isLoggedIn(): Promise<boolean> {
    // Check if we're redirected to dashboard
    return this.page.url().includes('/dashboard');
  }

  async testInvalidCredentials() {
    const invalidCases = [
      { username: '', password: '', expectedError: 'Username is required' },
      { username: 'test', password: '', expectedError: 'Password is required' },
      { username: 'invalid@user.com', password: 'wrongpass', expectedError: 'Invalid credentials' },
    ];

    const results = [];
    for (const testCase of invalidCases) {
      await this.usernameInput.fill(testCase.username);
      await this.passwordInput.fill(testCase.password);
      await this.loginButton.click();
      
      const error = await this.getErrorMessage();
      results.push({
        ...testCase,
        actualError: error,
        passed: error?.includes(testCase.expectedError) || false,
      });
      
      // Clear for next test
      await this.page.reload();
    }
    
    return results;
  }
}