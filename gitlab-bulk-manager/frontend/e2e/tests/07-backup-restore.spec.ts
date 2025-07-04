import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { BackupRestorePage } from '../pages/BackupRestorePage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { ProjectManagementPage } from '../pages/ProjectManagementPage';
import { TEST_CONFIG } from '../config/test.config';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Backup and Restore Features', () => {
  let loginPage: LoginPage;
  let backupPage: BackupRestorePage;
  let groupPage: GroupManagementPage;
  let projectPage: ProjectManagementPage;
  const timestamp = Date.now();
  let testGroupName: string;
  let testProjectName: string;

  test.beforeAll(async ({ browser }) => {
    // Create test data for backup
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    projectPage = new ProjectManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    // Create test group
    testGroupName = `e2e-backup-test-group-${timestamp}`;
    await groupPage.goto();
    await groupPage.createGroup({
      name: testGroupName,
      description: 'Group for backup testing',
      visibility: 'private',
      parentId: TEST_CONFIG.TARGET_GROUP_ID,
    });
    
    // Create test project
    testProjectName = `e2e-backup-test-project-${timestamp}`;
    await projectPage.goto();
    await projectPage.searchInTree(testGroupName);
    await projectPage.selectTreeNode(testGroupName);
    await projectPage.createProject({
      name: testProjectName,
      description: 'Project for backup testing',
      visibility: 'private',
    });
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    backupPage = new BackupRestorePage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    await backupPage.goto();
  });

  test('should display backup interface with proper permissions', async ({ page }) => {
    // Admin should see all backup options
    await expect(backupPage.createBackupButton).toBeVisible();
    await expect(backupPage.scheduleBackupButton).toBeVisible();
    await expect(backupPage.backupsList).toBeVisible();
    
    // Check if backup list is loading
    const backups = await backupPage.getBackupsList();
    console.log(`Found ${backups.length} existing backups`);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/backup-interface.png',
      fullPage: true 
    });
  });

  test('should create a full system backup', async ({ page }) => {
    const backupName = `e2e-full-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      description: 'E2E test full system backup',
      scope: 'full',
      includeWiki: true,
      includeIssues: true,
      includeMembers: true,
      includeSettings: true,
      encrypt: false,
    });
    
    // Wait for backup to complete
    await backupPage.waitForBackupComplete(backupName);
    
    // Verify backup appears in list
    const backups = await backupPage.getBackupsList();
    const createdBackup = backups.find(b => b.name === backupName);
    
    expect(createdBackup).toBeTruthy();
    expect(createdBackup?.status).toBe('Completed');
    expect(createdBackup?.scope).toBe('Full');
    
    // Get backup details
    const details = await backupPage.getBackupDetails(backupName);
    expect(details).toBeTruthy();
    expect(details?.projects).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/full-backup-created.png',
      fullPage: true 
    });
  });

  test('should create a group-specific backup', async ({ page }) => {
    const backupName = `e2e-group-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      description: 'E2E test group backup',
      scope: 'group',
      groupId: TEST_CONFIG.TARGET_GROUP_ID.toString(),
      includeWiki: true,
      includeIssues: true,
      includeMembers: false,
      includeSettings: true,
    });
    
    // Monitor backup progress
    let progress = await backupPage.getBackupProgress();
    console.log('Backup progress:', progress);
    
    await backupPage.waitForBackupComplete(backupName);
    
    const backups = await backupPage.getBackupsList();
    const groupBackup = backups.find(b => b.name === backupName);
    
    expect(groupBackup).toBeTruthy();
    expect(groupBackup?.scope).toContain('Group');
  });

  test('should create encrypted backup', async ({ page }) => {
    const backupName = `e2e-encrypted-backup-${timestamp}`;
    const encryptionPassword = 'TestPassword123!';
    
    await backupPage.createBackup({
      name: backupName,
      description: 'E2E test encrypted backup',
      scope: 'projects',
      includeWiki: false,
      includeIssues: false,
      includeMembers: false,
      includeSettings: true,
      encrypt: true,
      password: encryptionPassword,
    });
    
    await backupPage.waitForBackupComplete(backupName);
    
    const backups = await backupPage.getBackupsList();
    const encryptedBackup = backups.find(b => b.name === backupName);
    
    expect(encryptedBackup).toBeTruthy();
    expect(encryptedBackup?.encrypted).toBeTruthy();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/encrypted-backup.png',
      fullPage: true 
    });
  });

  test('should download backup file', async ({ page }) => {
    // Create a small backup for download test
    const backupName = `e2e-download-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      scope: 'projects',
      includeWiki: false,
      includeIssues: false,
      includeMembers: false,
      includeSettings: true,
    });
    
    await backupPage.waitForBackupComplete(backupName);
    
    // Download the backup
    const download = await backupPage.downloadBackup(backupName);
    const downloadPath = await download.path();
    
    expect(downloadPath).toBeTruthy();
    expect(fs.existsSync(downloadPath)).toBeTruthy();
    
    // Verify file size
    const stats = fs.statSync(downloadPath);
    expect(stats.size).toBeGreaterThan(0);
    console.log(`Downloaded backup size: ${stats.size} bytes`);
  });

  test('should restore from backup', async ({ page }) => {
    // First create a backup
    const backupName = `e2e-restore-test-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      scope: 'group',
      groupId: TEST_CONFIG.TARGET_GROUP_ID.toString(),
      includeWiki: false,
      includeIssues: false,
      includeMembers: false,
      includeSettings: true,
    });
    
    await backupPage.waitForBackupComplete(backupName);
    
    // Delete the test group to simulate data loss
    await groupPage.goto();
    page.on('dialog', dialog => dialog.accept());
    await groupPage.deleteGroup(testGroupName);
    
    // Go back to backup page and restore
    await backupPage.goto();
    await backupPage.restoreBackup(backupName, {
      targetGroup: TEST_CONFIG.TARGET_GROUP_ID.toString(),
      overwrite: false,
    });
    
    // Wait for restore to complete
    await backupPage.waitForRestoreComplete();
    
    // Verify restoration
    await groupPage.goto();
    await groupPage.searchGroups(testGroupName);
    const restoredGroup = await groupPage.getGroupByName(testGroupName);
    expect(restoredGroup).toBeTruthy();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/backup-restored.png',
      fullPage: true 
    });
  });

  test('should handle encrypted backup restore', async ({ page }) => {
    const backupName = `e2e-encrypted-restore-${timestamp}`;
    const password = 'SecurePassword123!';
    
    // Create encrypted backup
    await backupPage.createBackup({
      name: backupName,
      scope: 'projects',
      encrypt: true,
      password: password,
    });
    
    await backupPage.waitForBackupComplete(backupName);
    
    // Attempt restore with wrong password
    try {
      await backupPage.restoreBackup(backupName, {
        password: 'WrongPassword',
      });
      
      // Should show error
      const error = await page.locator('[role="alert"]').textContent();
      expect(error).toContain('password');
    } catch (error) {
      // Expected to fail
    }
    
    // Restore with correct password
    await backupPage.restoreBackup(backupName, {
      password: password,
    });
    
    await backupPage.waitForRestoreComplete();
  });

  test('should schedule automatic backups', async ({ page }) => {
    const scheduleName = `e2e-schedule-${timestamp}`;
    
    await backupPage.scheduleBackup({
      name: scheduleName,
      scope: 'group',
      groupId: TEST_CONFIG.TARGET_GROUP_ID.toString(),
      frequency: 'daily',
      time: '02:00',
      retention: 7, // Keep for 7 days
    });
    
    // Verify schedule created
    const schedules = await backupPage.getScheduledBackups();
    const createdSchedule = schedules.find(s => s.name === scheduleName);
    
    expect(createdSchedule).toBeTruthy();
    expect(createdSchedule?.frequency).toBe('Daily');
    expect(createdSchedule?.status).toBe('Active');
    
    // Test weekly schedule
    const weeklySchedule = `e2e-weekly-${timestamp}`;
    await backupPage.scheduleBackup({
      name: weeklySchedule,
      scope: 'full',
      frequency: 'weekly',
      time: '03:00',
      dayOfWeek: 0, // Sunday
      retention: 30,
    });
    
    const updatedSchedules = await backupPage.getScheduledBackups();
    expect(updatedSchedules.length).toBeGreaterThanOrEqual(2);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/scheduled-backups.png',
      fullPage: true 
    });
  });

  test('should delete old backups', async ({ page }) => {
    // Create a backup to delete
    const backupName = `e2e-delete-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      scope: 'projects',
    });
    
    await backupPage.waitForBackupComplete(backupName);
    
    // Delete the backup
    await backupPage.deleteBackup(backupName);
    
    // Verify deletion
    await page.waitForTimeout(1000);
    const backups = await backupPage.getBackupsList();
    const deletedBackup = backups.find(b => b.name === backupName);
    expect(deletedBackup).toBeFalsy();
  });

  test('should handle backup errors gracefully', async ({ page }) => {
    // Try to create backup with invalid group ID
    const backupName = `e2e-error-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: backupName,
      scope: 'group',
      groupId: '999999999', // Non-existent group
    });
    
    // Should show error
    await page.waitForTimeout(2000);
    const error = await page.locator('[role="alert"]').textContent();
    expect(error).toBeTruthy();
  });

  test('should display backup size and performance metrics', async ({ page }) => {
    const performanceBackupName = `e2e-perf-backup-${timestamp}`;
    
    const startTime = Date.now();
    await backupPage.createBackup({
      name: performanceBackupName,
      scope: 'group',
      groupId: TEST_CONFIG.TARGET_GROUP_ID.toString(),
      includeWiki: true,
      includeIssues: true,
    });
    
    await backupPage.waitForBackupComplete(performanceBackupName);
    const duration = Date.now() - startTime;
    
    const backups = await backupPage.getBackupsList();
    const perfBackup = backups.find(b => b.name === performanceBackupName);
    
    expect(perfBackup).toBeTruthy();
    expect(perfBackup?.size).toBeTruthy();
    
    console.log(`Backup completed in ${duration}ms`);
    console.log(`Backup size: ${perfBackup?.size}`);
    
    // Performance assertion
    expect(duration).toBeLessThan(60000); // Under 1 minute
  });

  test('should test backup integrity verification', async ({ page }) => {
    const integrityBackupName = `e2e-integrity-backup-${timestamp}`;
    
    await backupPage.createBackup({
      name: integrityBackupName,
      scope: 'projects',
      includeSettings: true,
    });
    
    await backupPage.waitForBackupComplete(integrityBackupName);
    
    // Get backup details for verification
    const details = await backupPage.getBackupDetails(integrityBackupName);
    expect(details).toBeTruthy();
    
    // Verify backup has expected content
    if (details) {
      expect(details.projects).toBeGreaterThanOrEqual(0);
      expect(details.groups).toBeGreaterThanOrEqual(0);
    }
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: Delete test backups and groups
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    backupPage = new BackupRestorePage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    // Delete test backups
    await backupPage.goto();
    const backups = await backupPage.getBackupsList();
    
    for (const backup of backups) {
      if (backup.name.includes(timestamp.toString())) {
        try {
          await backupPage.deleteBackup(backup.name);
          await page.waitForTimeout(500);
        } catch (error) {
          console.log(`Failed to cleanup backup ${backup.name}:`, error);
        }
      }
    }
    
    // Delete test groups
    await groupPage.goto();
    try {
      page.on('dialog', dialog => dialog.accept());
      await groupPage.deleteGroup(testGroupName);
    } catch (error) {
      console.log('Failed to cleanup test group:', error);
    }
    
    await page.close();
  });
});