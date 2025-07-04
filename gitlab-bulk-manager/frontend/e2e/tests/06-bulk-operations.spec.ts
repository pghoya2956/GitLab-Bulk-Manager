import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { BulkOperationsPage } from '../pages/BulkOperationsPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { TEST_CONFIG } from '../config/test.config';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Bulk Operations Features', () => {
  let loginPage: LoginPage;
  let bulkPage: BulkOperationsPage;
  let groupPage: GroupManagementPage;
  const timestamp = Date.now();
  const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');

  test.beforeAll(async () => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    bulkPage = new BulkOperationsPage(page);
    groupPage = new GroupManagementPage(page);
    
    // Login as admin
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    await bulkPage.goto();
  });

  test('should display bulk operations interface', async ({ page }) => {
    // Verify all operation types are available
    const operationTypes = [
      'Create Groups',
      'Create Projects',
      'Update Projects',
      'Delete Projects',
      'Assign Members',
    ];
    
    for (const type of operationTypes) {
      const option = await page.locator(`option:has-text("${type}")`).isVisible();
      expect(option).toBeTruthy();
    }
    
    // Verify configuration options
    await expect(bulkPage.dryRunToggle).toBeVisible();
    await expect(bulkPage.parallelExecutionInput).toBeVisible();
    await expect(bulkPage.errorHandlingSelect).toBeVisible();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/bulk-operations-interface.png',
      fullPage: true 
    });
  });

  test('should create multiple groups from file', async ({ page }) => {
    // Create test file
    const groupsData = `# Test Groups for E2E ${timestamp}
e2e-bulk-group-1-${timestamp}|e2e-bulk-1-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Test group 1|private
e2e-bulk-group-2-${timestamp}|e2e-bulk-2-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Test group 2|internal
e2e-bulk-group-3-${timestamp}|e2e-bulk-3-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Test group 3|private`;
    
    const filepath = path.join(testFilesDir, `groups-${timestamp}.txt`);
    fs.writeFileSync(filepath, groupsData);
    
    // Select operation type
    await bulkPage.selectOperationType('createGroups');
    
    // Upload file
    await bulkPage.uploadFile(filepath);
    
    // Check preview
    const preview = await bulkPage.getPreviewData();
    expect(preview.totalItems).toBe(3);
    expect(preview.validItems).toBe(3);
    expect(preview.invalidItems).toBe(0);
    
    // Execute operation
    await bulkPage.executeBulkOperation();
    
    // Wait for completion
    await bulkPage.waitForOperationComplete();
    
    // Check results
    const results = await bulkPage.getOperationResults();
    expect(results.success).toBe(3);
    expect(results.failed).toBe(0);
    
    // Verify groups were created
    await groupPage.goto();
    await groupPage.searchGroups(`e2e-bulk-group-1-${timestamp}`);
    const group1 = await groupPage.getGroupByName(`e2e-bulk-group-1-${timestamp}`);
    expect(group1).toBeTruthy();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/bulk-groups-created.png',
      fullPage: true 
    });
  });

  test('should handle bulk project creation', async ({ page }) => {
    // First create a parent group
    await groupPage.goto();
    const parentGroupName = `e2e-bulk-parent-${timestamp}`;
    await groupPage.createGroup({
      name: parentGroupName,
      path: `e2e-bulk-parent-${timestamp}`,
      parentId: TEST_CONFIG.TARGET_GROUP_ID,
    });
    
    // Get the created group ID (simulated)
    const parentGroupId = TEST_CONFIG.TARGET_GROUP_ID; // In real test, we'd get actual ID
    
    // Create projects file
    const projectsData = `# Test Projects for E2E ${timestamp}
e2e-bulk-project-1-${timestamp}|${parentGroupId}|Bulk test project 1|private|true|true|main
e2e-bulk-project-2-${timestamp}|${parentGroupId}|Bulk test project 2|internal|true|false|main
e2e-bulk-project-3-${timestamp}|${parentGroupId}|Bulk test project 3|private|false|false|main
e2e-bulk-project-4-${timestamp}|${parentGroupId}|Bulk test project 4|private|true|true|develop`;
    
    const filepath = path.join(testFilesDir, `projects-${timestamp}.txt`);
    fs.writeFileSync(filepath, projectsData);
    
    // Navigate to bulk operations
    await bulkPage.goto();
    await bulkPage.selectOperationType('createProjects');
    await bulkPage.uploadFile(filepath);
    
    // Set parallel execution
    await bulkPage.setParallelExecution(2);
    
    // Execute
    await bulkPage.executeBulkOperation();
    
    // Monitor progress
    let progress = await bulkPage.getOperationProgress();
    console.log('Initial progress:', progress);
    
    // Wait for completion
    await bulkPage.waitForOperationComplete();
    
    // Check final results
    const results = await bulkPage.getOperationResults();
    expect(results.success).toBe(4);
    expect(results.failed).toBe(0);
    
    console.log(`Bulk project creation took ${results.duration}ms`);
  });

  test('should test dry run mode', async ({ page }) => {
    // Create test file for deletion
    const deleteData = `# Projects to delete (dry run test)
e2e-project-to-delete-1
e2e-project-to-delete-2
e2e-project-to-delete-3`;
    
    const filepath = path.join(testFilesDir, `delete-projects-${timestamp}.txt`);
    fs.writeFileSync(filepath, deleteData);
    
    // Select delete operation
    await bulkPage.selectOperationType('deleteProjects');
    await bulkPage.uploadFile(filepath);
    
    // Enable dry run
    await bulkPage.setDryRun(true);
    
    // Execute
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    // Check results
    const results = await bulkPage.getOperationResults();
    
    // In dry run, operations should be simulated
    const resultText = await page.locator('[data-testid="dry-run-notice"]').textContent();
    expect(resultText).toContain('Dry run');
    
    await page.screenshot({ 
      path: 'test-results/screenshots/bulk-dry-run.png',
      fullPage: true 
    });
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Create file with invalid data
    const invalidData = `# Invalid data test
invalid|group|data|missing|fields
e2e-valid-group-${timestamp}|e2e-valid-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Valid group|private
|missing-name|${TEST_CONFIG.TARGET_GROUP_ID}|Missing name|private
e2e-duplicate-${timestamp}|e2e-dup-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Duplicate|invalid-visibility`;
    
    const filepath = path.join(testFilesDir, `invalid-groups-${timestamp}.txt`);
    fs.writeFileSync(filepath, invalidData);
    
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    
    // Check preview shows validation errors
    const preview = await bulkPage.getPreviewData();
    expect(preview.invalidItems).toBeGreaterThan(0);
    expect(preview.warnings.length).toBeGreaterThan(0);
    
    // Set error handling to skip
    await bulkPage.setErrorHandling('skip');
    
    // Execute
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    // Check results
    const results = await bulkPage.getOperationResults();
    expect(results.success).toBe(1); // Only valid item
    expect(results.failed).toBeGreaterThan(0);
    expect(results.errors.length).toBeGreaterThan(0);
  });

  test('should support operation cancellation', async ({ page }) => {
    // Create large file for testing cancellation
    const largeData = Array.from({ length: 50 }, (_, i) => 
      `e2e-cancel-test-${i}-${timestamp}|e2e-cancel-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Cancel test ${i}|private`
    ).join('\n');
    
    const filepath = path.join(testFilesDir, `large-groups-${timestamp}.txt`);
    fs.writeFileSync(filepath, largeData);
    
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    
    // Set low parallel execution to make it slower
    await bulkPage.setParallelExecution(1);
    
    // Start operation
    await bulkPage.executeBulkOperation();
    
    // Wait a bit then cancel
    await page.waitForTimeout(2000);
    await bulkPage.cancelOperation();
    
    // Verify cancellation
    const status = await page.locator('[data-testid="status-label"]').textContent();
    expect(status).toContain('Cancelled');
    
    // Check partial results
    const results = await bulkPage.getOperationResults();
    expect(results.success).toBeGreaterThanOrEqual(0);
    expect(results.success).toBeLessThan(50); // Not all completed
  });

  test('should track operation history', async ({ page }) => {
    // Perform a simple operation first
    const groupData = `e2e-history-test-${timestamp}|e2e-history-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|History test|private`;
    const filepath = path.join(testFilesDir, `history-group-${timestamp}.txt`);
    fs.writeFileSync(filepath, groupData);
    
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    // Check operation appears in history
    const history = await bulkPage.getOperationHistory();
    expect(history.length).toBeGreaterThan(0);
    
    const latestOperation = history[0];
    expect(latestOperation.type).toContain('Create Groups');
    expect(latestOperation.status).toBe('Completed');
    expect(latestOperation.itemCount).toBe(1);
    
    // Test viewing details
    await bulkPage.viewOperationDetails(latestOperation.id);
    await expect(page.locator('[data-testid="operation-details-dialog"]')).toBeVisible();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/bulk-operation-history.png',
      fullPage: true 
    });
  });

  test('should download operation results', async ({ page }) => {
    // Create and execute a simple operation
    const projectData = `e2e-download-test-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Download test project|private|true|true|main`;
    const filepath = path.join(testFilesDir, `download-project-${timestamp}.txt`);
    fs.writeFileSync(filepath, projectData);
    
    await bulkPage.selectOperationType('createProjects');
    await bulkPage.uploadFile(filepath);
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    // Download results
    const download = await bulkPage.downloadResults();
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    
    // Verify download content
    const content = fs.readFileSync(downloadPath, 'utf-8');
    expect(content).toContain('e2e-download-test');
    expect(content).toContain('Success');
  });

  test('should handle member assignment bulk operation', async ({ page }) => {
    // Create test members file
    const membersData = `# Test member assignments
user1@example.com|e2e-bulk-group-1-${timestamp}|developer|
user2@example.com|e2e-bulk-group-1-${timestamp}|maintainer|2024-12-31
user3@example.com|e2e-bulk-group-2-${timestamp}|reporter|`;
    
    const filepath = path.join(testFilesDir, `members-${timestamp}.txt`);
    fs.writeFileSync(filepath, membersData);
    
    await bulkPage.selectOperationType('assignMembers');
    await bulkPage.uploadFile(filepath);
    
    // Check preview
    const preview = await bulkPage.getPreviewData();
    expect(preview.totalItems).toBe(3);
    
    // Execute with dry run first
    await bulkPage.setDryRun(true);
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    const dryRunResults = await bulkPage.getOperationResults();
    console.log('Member assignment dry run results:', dryRunResults);
  });

  test('should measure bulk operation performance', async ({ page }) => {
    const performanceMetrics = {
      smallBatch: { size: 5, time: 0 },
      mediumBatch: { size: 20, time: 0 },
      parallelComparison: { serial: 0, parallel: 0 },
    };
    
    // Test small batch
    const smallData = Array.from({ length: 5 }, (_, i) => 
      `e2e-perf-small-${i}-${timestamp}|e2e-perf-s-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Perf test ${i}|private`
    ).join('\n');
    
    const smallFile = path.join(testFilesDir, `perf-small-${timestamp}.txt`);
    fs.writeFileSync(smallFile, smallData);
    
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(smallFile);
    
    const startSmall = Date.now();
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    performanceMetrics.smallBatch.time = Date.now() - startSmall;
    
    // Test medium batch
    const mediumData = Array.from({ length: 20 }, (_, i) => 
      `e2e-perf-med-${i}-${timestamp}|e2e-perf-m-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Perf test ${i}|private`
    ).join('\n');
    
    const mediumFile = path.join(testFilesDir, `perf-medium-${timestamp}.txt`);
    fs.writeFileSync(mediumFile, mediumData);
    
    await page.reload();
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(mediumFile);
    
    const startMedium = Date.now();
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    performanceMetrics.mediumBatch.time = Date.now() - startMedium;
    
    console.log('Performance Metrics:', performanceMetrics);
    
    // Performance assertions
    const timePerItemSmall = performanceMetrics.smallBatch.time / 5;
    const timePerItemMedium = performanceMetrics.mediumBatch.time / 20;
    
    // Larger batches should be more efficient per item
    expect(timePerItemMedium).toBeLessThanOrEqual(timePerItemSmall * 1.2);
  });

  test('should retry failed operations', async ({ page }) => {
    // Create file with mix of valid and invalid items
    const mixedData = `# Mixed data for retry test
e2e-retry-valid-1-${timestamp}|e2e-retry-1-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Valid group 1|private
invalid-parent-id|e2e-retry-2-${timestamp}|999999999|Invalid parent ID|private
e2e-retry-valid-2-${timestamp}|e2e-retry-3-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Valid group 2|private`;
    
    const filepath = path.join(testFilesDir, `retry-groups-${timestamp}.txt`);
    fs.writeFileSync(filepath, mixedData);
    
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    await bulkPage.setErrorHandling('skip');
    
    // Execute first attempt
    await bulkPage.executeBulkOperation();
    await bulkPage.waitForOperationComplete();
    
    const firstResults = await bulkPage.getOperationResults();
    expect(firstResults.failed).toBeGreaterThan(0);
    
    // Get operation ID from history
    const history = await bulkPage.getOperationHistory();
    const latestOperation = history[0];
    
    // Retry failed items
    await bulkPage.retryFailedItems(latestOperation.id);
    await bulkPage.waitForOperationComplete();
    
    // Check retry results
    const retryHistory = await bulkPage.getOperationHistory();
    const retryOperation = retryHistory[0];
    expect(retryOperation.type).toContain('Retry');
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: Delete test groups and projects
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    // Delete test groups
    const testGroupPrefixes = [
      `e2e-bulk-group-`,
      `e2e-bulk-parent-`,
      `e2e-cancel-test-`,
      `e2e-history-test-`,
      `e2e-perf-`,
      `e2e-retry-`,
    ];
    
    for (const prefix of testGroupPrefixes) {
      await groupPage.searchGroups(prefix + timestamp);
      const groups = await groupPage.getAllGroups();
      
      for (const group of groups) {
        if (group.name.includes(timestamp.toString())) {
          try {
            page.on('dialog', dialog => dialog.accept());
            await groupPage.deleteGroup(group.name);
            await page.waitForTimeout(500);
          } catch (error) {
            console.log(`Failed to cleanup ${group.name}:`, error);
          }
        }
      }
    }
    
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      const files = fs.readdirSync(testFilesDir);
      files.forEach(file => {
        if (file.includes(timestamp.toString())) {
          fs.unlinkSync(path.join(testFilesDir, file));
        }
      });
    }
    
    await page.close();
  });
});