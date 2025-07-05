import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly navBar: Locator;
  readonly notificationCenter: Locator;
  readonly userMenu: Locator;
  readonly docsSearch: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navBar = page.locator('nav, [role="navigation"]');
    this.notificationCenter = page.locator('[aria-label="notifications"]');
    this.userMenu = page.locator('[aria-label="user menu"]');
    this.docsSearch = page.locator('input[placeholder*="문서 검색"]');
  }

  async navigate(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async clickNavLink(linkText: string) {
    await this.navBar.getByRole('button', { name: linkText }).click();
  }

  async waitForNotification(text: string) {
    await this.page.locator('[role="alert"]').filter({ hasText: text }).waitFor();
  }

  async dismissNotification() {
    await this.page.locator('[role="alert"] button[aria-label="close"]').click();
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async logout() {
    await this.openUserMenu();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }

  async checkAccessibility() {
    // This would integrate with accessibility testing tools
    // For now, we'll check basic ARIA attributes
    const elements = await this.page.locator('[role]').all();
    return elements.length > 0;
  }

  async getPerformanceMetrics() {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      };
    });
  }
}