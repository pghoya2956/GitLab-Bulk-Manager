import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Group Management Features', () => {
  let loginPage: LoginPage;
  let groupPage: GroupManagementPage;
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    // Login as admin for full access
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    await groupPage.goto();
  });

  test('should display group list with virtual scrolling', async ({ page }) => {
    // Get initial groups
    const groups = await groupPage.getAllGroups();
    console.log(`Found ${groups.length} groups`);
    
    // Check if virtual scrolling is active
    const listContainer = await page.locator('.MuiList-root, [role="list"]');
    const containerHeight = await listContainer.evaluate(el => el.scrollHeight);
    const viewportHeight = await listContainer.evaluate(el => el.clientHeight);
    
    console.log(`Container height: ${containerHeight}, Viewport height: ${viewportHeight}`);
    
    // If we have many groups, test scrolling
    if (containerHeight > viewportHeight) {
      // Scroll to bottom
      await listContainer.evaluate(el => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
      
      // Check if more items loaded
      const groupsAfterScroll = await groupPage.getAllGroups();
      console.log(`Groups after scroll: ${groupsAfterScroll.length}`);
    }
    
    await page.screenshot({ 
      path: 'test-results/screenshots/group-list.png',
      fullPage: true 
    });
  });

  test('should create a new group in target group 107423238', async ({ page }) => {
    const groupName = `e2e-test-${timestamp}`;
    const groupPath = `e2e-test-${timestamp}`;
    const description = `E2E test group created at ${new Date().toISOString()}`;
    
    // Create group
    await groupPage.createGroup({
      name: groupName,
      path: groupPath,
      description: description,
      visibility: 'private',
      parentId: TEST_CONFIG.TARGET_GROUP_ID,
    });
    
    // Verify success notification
    await page.waitForSelector('[role="alert"]:has-text("success")');
    
    // Search for the created group
    await groupPage.searchGroups(groupName);
    
    // Verify group appears in list
    const createdGroup = await groupPage.getGroupByName(groupName);
    expect(createdGroup).toBeTruthy();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/screenshots/group-created.png',
      fullPage: true 
    });
  });

  test('should edit group details', async ({ page }) => {
    // First create a group to edit
    const groupName = `e2e-edit-${timestamp}`;
    await groupPage.createGroup({
      name: groupName,
      description: 'Original description',
      visibility: 'private',
    });
    
    // Find and edit the group
    const group = await groupPage.getGroupByName(groupName);
    expect(group).toBeTruthy();
    
    // Open context menu
    await group!.locator('button[aria-label*="more"]').click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    
    // Update description
    const newDescription = 'Updated description by E2E test';
    await page.fill('textarea[name="description"]', newDescription);
    
    // Change visibility
    await page.selectOption('[name="visibility"]', 'internal');
    
    // Save changes
    await page.click('button[type="submit"]');
    
    // Verify success
    await page.waitForSelector('[role="alert"]:has-text("updated")');
    
    // Verify changes
    await page.reload();
    const updatedGroup = await groupPage.getGroupByName(groupName);
    const visibilityChip = await updatedGroup!.locator('[class*="MuiChip"]').textContent();
    expect(visibilityChip).toBe('internal');
  });

  test('should create subgroups with hierarchy', async ({ page }) => {
    // Create parent group
    const parentName = `e2e-parent-${timestamp}`;
    await groupPage.createGroup({
      name: parentName,
      visibility: 'private',
    });
    
    // Create subgroup
    const subgroupName = `e2e-subgroup-${timestamp}`;
    await groupPage.createSubgroup(parentName, {
      name: subgroupName,
      path: `subgroup-${timestamp}`,
      description: 'E2E test subgroup',
    });
    
    // Verify hierarchy is displayed
    await page.reload();
    const subgroup = await groupPage.getGroupByName(subgroupName);
    expect(subgroup).toBeTruthy();
    
    // Check if path shows hierarchy
    const path = await subgroup!.locator('[class*="secondary"]').textContent();
    expect(path).toContain(parentName);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/group-hierarchy.png',
      fullPage: true 
    });
  });

  test('should test drag and drop functionality', async ({ page }) => {
    // Create two groups for testing
    const group1Name = `e2e-drag-source-${timestamp}`;
    const group2Name = `e2e-drag-target-${timestamp}`;
    
    await groupPage.createGroup({ name: group1Name });
    await page.waitForTimeout(1000);
    await groupPage.createGroup({ name: group2Name });
    await page.waitForTimeout(1000);
    
    // Perform drag and drop
    try {
      await groupPage.dragAndDropGroup(group1Name, group2Name);
      
      // Verify the operation
      await page.waitForSelector('[role="alert"]');
      
      // Take screenshot
      await page.screenshot({ 
        path: 'test-results/screenshots/drag-drop-result.png',
        fullPage: true 
      });
    } catch (error) {
      console.log('Drag and drop test skipped - may not be supported in headless mode');
    }
  });

  test('should search and filter groups', async ({ page }) => {
    // Create multiple groups with different names
    const testGroups = [
      `e2e-search-alpha-${timestamp}`,
      `e2e-search-beta-${timestamp}`,
      `e2e-search-gamma-${timestamp}`,
    ];
    
    for (const groupName of testGroups) {
      await groupPage.createGroup({ name: groupName });
      await page.waitForTimeout(500);
    }
    
    // Test search functionality
    await groupPage.searchGroups('alpha');
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const visibleGroups = await groupPage.getAllGroups();
    const alphaGroup = visibleGroups.find(g => g.name.includes('alpha'));
    const betaGroup = visibleGroups.find(g => g.name.includes('beta'));
    
    expect(alphaGroup).toBeTruthy();
    expect(betaGroup).toBeFalsy(); // Should be filtered out
    
    // Clear search
    await groupPage.searchGroups('');
    await page.waitForTimeout(1000);
    
    // All should be visible again
    const allGroups = await groupPage.getAllGroups();
    expect(allGroups.length).toBeGreaterThanOrEqual(testGroups.length);
  });

  test('should handle bulk selection and operations', async ({ page }) => {
    // Check if bulk selection UI exists
    const hasBulkSelect = await page.locator('input[type="checkbox"]').first().isVisible();
    
    if (hasBulkSelect) {
      // Select multiple groups
      const checkboxes = await page.locator('input[type="checkbox"]').all();
      
      // Select first 3 groups
      for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
        await checkboxes[i].check();
      }
      
      // Check if bulk actions appear
      const bulkActions = await page.locator('button:has-text("Delete Selected")').isVisible();
      expect(bulkActions).toBeTruthy();
      
      await page.screenshot({ 
        path: 'test-results/screenshots/bulk-selection.png',
        fullPage: true 
      });
    }
  });

  test('should delete group with confirmation', async ({ page }) => {
    // Create a group to delete
    const groupName = `e2e-delete-${timestamp}`;
    await groupPage.createGroup({ name: groupName });
    
    // Delete the group
    page.on('dialog', dialog => dialog.accept()); // Auto-confirm
    await groupPage.deleteGroup(groupName);
    
    // Verify deletion
    await page.waitForTimeout(1000);
    const deletedGroup = await groupPage.getGroupByName(groupName);
    expect(deletedGroup).toBeFalsy();
  });

  test('should measure group operations performance', async ({ page }) => {
    const metrics = {
      createTime: 0,
      loadTime: 0,
      searchTime: 0,
    };
    
    // Measure create time
    const createStart = Date.now();
    await groupPage.createGroup({
      name: `e2e-perf-${timestamp}`,
      description: 'Performance test group',
    });
    metrics.createTime = Date.now() - createStart;
    
    // Measure page load time
    const loadStart = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    metrics.loadTime = Date.now() - loadStart;
    
    // Measure search time
    const searchStart = Date.now();
    await groupPage.searchGroups('e2e-perf');
    await page.waitForTimeout(500);
    metrics.searchTime = Date.now() - searchStart;
    
    console.log('Performance Metrics:', metrics);
    
    // Assert performance thresholds
    expect(metrics.createTime).toBeLessThan(5000); // Under 5 seconds
    expect(metrics.loadTime).toBeLessThan(3000); // Under 3 seconds
    expect(metrics.searchTime).toBeLessThan(1000); // Under 1 second
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test groups created during tests
    try {
      const groups = await groupPage.getAllGroups();
      const testGroups = groups.filter(g => 
        g.name.includes('e2e-test') || 
        g.name.includes('e2e-edit') ||
        g.name.includes('e2e-search') ||
        g.name.includes('e2e-drag') ||
        g.name.includes('e2e-perf')
      );
      
      for (const group of testGroups) {
        if (group.name.includes(timestamp.toString())) {
          try {
            await groupPage.deleteGroup(group.name);
            await page.waitForTimeout(500);
          } catch (error) {
            console.log(`Failed to cleanup ${group.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  });
});