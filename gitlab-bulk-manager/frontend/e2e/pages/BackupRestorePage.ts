import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class BackupRestorePage extends BasePage {
  readonly createBackupButton: Locator;
  readonly backupNameInput: Locator;
  readonly backupDescriptionInput: Locator;
  readonly backupScopeSelect: Locator;
  readonly groupSelect: Locator;
  readonly includeWikiCheckbox: Locator;
  readonly includeIssuesCheckbox: Locator;
  readonly includeMembersCheckbox: Locator;
  readonly includeSettingsCheckbox: Locator;
  readonly encryptBackupCheckbox: Locator;
  readonly encryptionPasswordInput: Locator;
  readonly backupsList: Locator;
  readonly restoreButton: Locator;
  readonly downloadButton: Locator;
  readonly deleteButton: Locator;
  readonly scheduleBackupButton: Locator;
  readonly backupScheduleList: Locator;

  constructor(page: Page) {
    super(page);
    
    // Create backup controls
    this.createBackupButton = page.locator('button:has-text("Create Backup")');
    this.backupNameInput = page.locator('input[name="backupName"]');
    this.backupDescriptionInput = page.locator('textarea[name="description"]');
    this.backupScopeSelect = page.locator('[name="scope"]');
    this.groupSelect = page.locator('[name="groupId"]');
    
    // Backup options
    this.includeWikiCheckbox = page.locator('[name="includeWiki"]');
    this.includeIssuesCheckbox = page.locator('[name="includeIssues"]');
    this.includeMembersCheckbox = page.locator('[name="includeMembers"]');
    this.includeSettingsCheckbox = page.locator('[name="includeSettings"]');
    this.encryptBackupCheckbox = page.locator('[name="encrypt"]');
    this.encryptionPasswordInput = page.locator('input[name="encryptionPassword"]');
    
    // Backups list
    this.backupsList = page.locator('[data-testid="backups-list"]');
    
    // Action buttons
    this.restoreButton = page.locator('button:has-text("Restore")');
    this.downloadButton = page.locator('button:has-text("Download")');
    this.deleteButton = page.locator('button:has-text("Delete")');
    
    // Scheduled backups
    this.scheduleBackupButton = page.locator('button:has-text("Schedule Backup")');
    this.backupScheduleList = page.locator('[data-testid="backup-schedules"]');
  }

  async goto() {
    await this.navigate('/backup-restore');
    await this.page.waitForLoadState('networkidle');
  }

  async createBackup(options: {
    name: string;
    description?: string;
    scope: 'full' | 'group' | 'projects';
    groupId?: string;
    includeWiki?: boolean;
    includeIssues?: boolean;
    includeMembers?: boolean;
    includeSettings?: boolean;
    encrypt?: boolean;
    password?: string;
  }) {
    await this.createBackupButton.click();
    await this.page.waitForSelector('[role="dialog"]');
    
    await this.backupNameInput.fill(options.name);
    
    if (options.description) {
      await this.backupDescriptionInput.fill(options.description);
    }
    
    await this.backupScopeSelect.selectOption(options.scope);
    
    if (options.scope === 'group' && options.groupId) {
      await this.groupSelect.selectOption(options.groupId);
    }
    
    // Set backup options
    if (options.includeWiki !== undefined) {
      await this.setCheckbox(this.includeWikiCheckbox, options.includeWiki);
    }
    if (options.includeIssues !== undefined) {
      await this.setCheckbox(this.includeIssuesCheckbox, options.includeIssues);
    }
    if (options.includeMembers !== undefined) {
      await this.setCheckbox(this.includeMembersCheckbox, options.includeMembers);
    }
    if (options.includeSettings !== undefined) {
      await this.setCheckbox(this.includeSettingsCheckbox, options.includeSettings);
    }
    
    if (options.encrypt) {
      await this.setCheckbox(this.encryptBackupCheckbox, true);
      if (options.password) {
        await this.encryptionPasswordInput.fill(options.password);
      }
    }
    
    await this.page.locator('button[type="submit"]').click();
    await this.waitForNotification('Backup started');
  }

  async setCheckbox(checkbox: Locator, checked: boolean) {
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  async waitForBackupComplete(backupName: string, timeout: number = 120000) {
    const backupRow = this.backupsList.locator(`[data-testid="backup-${backupName}"]`);
    await backupRow.waitFor({ state: 'visible', timeout });
    
    // Wait for status to be 'Completed'
    await this.page.waitForFunction(
      (name) => {
        const row = document.querySelector(`[data-testid="backup-${name}"]`);
        const status = row?.querySelector('[data-testid="backup-status"]')?.textContent;
        return status === 'Completed';
      },
      backupName,
      { timeout }
    );
  }

  async getBackupsList(): Promise<Array<{
    name: string;
    status: string;
    size: string;
    createdAt: string;
    scope: string;
    encrypted: boolean;
  }>> {
    const rows = await this.backupsList.locator('[role="row"]').all();
    const backups = [];
    
    for (const row of rows) {
      backups.push({
        name: await row.locator('[data-testid="backup-name"]').textContent() || '',
        status: await row.locator('[data-testid="backup-status"]').textContent() || '',
        size: await row.locator('[data-testid="backup-size"]').textContent() || '',
        createdAt: await row.locator('[data-testid="backup-created"]').textContent() || '',
        scope: await row.locator('[data-testid="backup-scope"]').textContent() || '',
        encrypted: await row.locator('[data-testid="backup-encrypted"]').isVisible(),
      });
    }
    
    return backups;
  }

  async getBackupDetails(backupName: string): Promise<{
    projects: number;
    groups: number;
    members: number;
    issues: number;
    wikis: number;
  } | null> {
    const backupRow = this.backupsList.locator(`[data-testid="backup-${backupName}"]`);
    
    // Click to expand details
    await backupRow.click();
    await this.page.waitForTimeout(300);
    
    const details = backupRow.locator('[data-testid="backup-details"]');
    if (!await details.isVisible()) {
      return null;
    }
    
    return {
      projects: parseInt(await details.locator('text=/projects/i').locator('..').textContent() || '0'),
      groups: parseInt(await details.locator('text=/groups/i').locator('..').textContent() || '0'),
      members: parseInt(await details.locator('text=/members/i').locator('..').textContent() || '0'),
      issues: parseInt(await details.locator('text=/issues/i').locator('..').textContent() || '0'),
      wikis: parseInt(await details.locator('text=/wikis/i').locator('..').textContent() || '0'),
    };
  }

  async downloadBackup(backupName: string) {
    const backupRow = this.backupsList.locator(`[data-testid="backup-${backupName}"]`);
    const downloadButton = backupRow.locator('button[aria-label*="download"]');
    
    const downloadPromise = this.page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    
    return download;
  }

  async restoreBackup(backupName: string, options?: {
    password?: string;
    targetGroup?: string;
    overwrite?: boolean;
  }) {
    const backupRow = this.backupsList.locator(`[data-testid="backup-${backupName}"]`);
    const restoreButton = backupRow.locator('button[aria-label*="restore"]');
    
    await restoreButton.click();
    await this.page.waitForSelector('[role="dialog"]');
    
    if (options?.password) {
      await this.page.fill('input[name="decryptionPassword"]', options.password);
    }
    
    if (options?.targetGroup) {
      await this.page.selectOption('[name="targetGroupId"]', options.targetGroup);
    }
    
    if (options?.overwrite !== undefined) {
      const overwriteCheckbox = this.page.locator('[name="overwrite"]');
      await this.setCheckbox(overwriteCheckbox, options.overwrite);
    }
    
    // Confirm restore
    await this.page.locator('button:has-text("Restore")').last().click();
    
    // Handle confirmation dialog
    this.page.on('dialog', dialog => dialog.accept());
  }

  async waitForRestoreComplete(timeout: number = 120000) {
    await this.page.waitForSelector(
      '[data-testid="restore-complete"]',
      { timeout }
    );
  }

  async deleteBackup(backupName: string) {
    const backupRow = this.backupsList.locator(`[data-testid="backup-${backupName}"]`);
    const deleteButton = backupRow.locator('button[aria-label*="delete"]');
    
    await deleteButton.click();
    
    // Confirm deletion
    this.page.on('dialog', dialog => dialog.accept());
    await this.page.locator('button:has-text("Delete")').last().click();
    
    await this.waitForNotification('Backup deleted');
  }

  async scheduleBackup(schedule: {
    name: string;
    scope: 'full' | 'group' | 'projects';
    groupId?: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    retention: number;
  }) {
    await this.scheduleBackupButton.click();
    await this.page.waitForSelector('[role="dialog"]');
    
    await this.page.fill('input[name="scheduleName"]', schedule.name);
    await this.page.selectOption('[name="scope"]', schedule.scope);
    
    if (schedule.groupId) {
      await this.page.selectOption('[name="groupId"]', schedule.groupId);
    }
    
    await this.page.selectOption('[name="frequency"]', schedule.frequency);
    await this.page.fill('input[name="time"]', schedule.time);
    
    if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined) {
      await this.page.selectOption('[name="dayOfWeek"]', schedule.dayOfWeek.toString());
    }
    
    if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== undefined) {
      await this.page.fill('input[name="dayOfMonth"]', schedule.dayOfMonth.toString());
    }
    
    await this.page.fill('input[name="retention"]', schedule.retention.toString());
    
    await this.page.locator('button[type="submit"]').click();
    await this.waitForNotification('Schedule created');
  }

  async getScheduledBackups(): Promise<Array<{
    name: string;
    frequency: string;
    nextRun: string;
    lastRun: string;
    status: string;
  }>> {
    const rows = await this.backupScheduleList.locator('[role="row"]').all();
    const schedules = [];
    
    for (const row of rows) {
      schedules.push({
        name: await row.locator('[data-testid="schedule-name"]').textContent() || '',
        frequency: await row.locator('[data-testid="schedule-frequency"]').textContent() || '',
        nextRun: await row.locator('[data-testid="schedule-next-run"]').textContent() || '',
        lastRun: await row.locator('[data-testid="schedule-last-run"]').textContent() || '',
        status: await row.locator('[data-testid="schedule-status"]').textContent() || '',
      });
    }
    
    return schedules;
  }

  async getBackupProgress(): Promise<{
    percentage: number;
    currentItem: string;
    totalItems: number;
    processedItems: number;
  }> {
    const progressBar = this.page.locator('[role="progressbar"]');
    const percentage = await progressBar.getAttribute('aria-valuenow') || '0';
    
    const statusText = await this.page.locator('[data-testid="backup-progress-status"]').textContent() || '';
    const currentItem = await this.page.locator('[data-testid="current-item"]').textContent() || '';
    
    const processed = parseInt(statusText.match(/(\d+)\/\d+/)?.[1] || '0');
    const total = parseInt(statusText.match(/\d+\/(\d+)/)?.[1] || '0');
    
    return {
      percentage: parseInt(percentage),
      currentItem,
      totalItems: total,
      processedItems: processed,
    };
  }
}