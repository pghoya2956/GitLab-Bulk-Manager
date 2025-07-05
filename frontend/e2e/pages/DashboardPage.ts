import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly groupsCard: Locator;
  readonly projectsCard: Locator;
  readonly usersCard: Locator;
  readonly activityTable: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    super(page);
    this.groupsCard = page.locator('[data-testid="groups-stat-card"], h6:has-text("Total Groups")').locator('..');
    this.projectsCard = page.locator('[data-testid="projects-stat-card"], h6:has-text("Total Projects")').locator('..');
    this.usersCard = page.locator('[data-testid="users-stat-card"], h6:has-text("Total Users")').locator('..');
    this.activityTable = page.locator('[role="grid"], .MuiDataGrid-root');
    this.refreshButton = page.locator('button[aria-label="refresh"]');
  }

  async goto() {
    await this.navigate('/dashboard');
  }

  async getStats() {
    return {
      groups: await this.getStatValue(this.groupsCard),
      projects: await this.getStatValue(this.projectsCard),
      users: await this.getStatValue(this.usersCard),
    };
  }

  private async getStatValue(card: Locator): Promise<number> {
    const valueText = await card.locator('h3, [class*="MuiTypography-h3"]').textContent();
    return parseInt(valueText?.replace(/[^0-9]/g, '') || '0');
  }

  async getRecentActivities(): Promise<any[]> {
    const rows = await this.activityTable.locator('[role="row"]').all();
    const activities = [];
    
    // Skip header row
    for (let i = 1; i < rows.length && i < 6; i++) {
      const cells = await rows[i].locator('[role="cell"]').all();
      if (cells.length >= 5) {
        activities.push({
          type: await cells[0].textContent(),
          action: await cells[1].textContent(),
          target: await cells[2].textContent(),
          author: await cells[3].textContent(),
          date: await cells[4].textContent(),
        });
      }
    }
    
    return activities;
  }

  async waitForDataLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for skeleton loaders to disappear
    await this.page.waitForSelector('.MuiSkeleton-root', { state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  async refresh() {
    await this.refreshButton.click();
    await this.waitForDataLoad();
  }

  async verifyDashboardElements() {
    const elements = {
      title: await this.page.locator('h4:has-text("GitLab Dashboard")').isVisible(),
      groupsCard: await this.groupsCard.isVisible(),
      projectsCard: await this.projectsCard.isVisible(),
      usersCard: await this.usersCard.isVisible(),
      activityTable: await this.activityTable.isVisible(),
      navigation: await this.navBar.isVisible(),
    };
    
    return {
      allVisible: Object.values(elements).every(v => v === true),
      elements,
    };
  }
}