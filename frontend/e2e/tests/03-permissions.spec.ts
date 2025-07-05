import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Permission System', () => {
  let loginPage: LoginPage;
  let groupPage: GroupManagementPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
  });

  test.describe('Admin Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(
        TEST_CONFIG.TEST_USERS.admin.username,
        TEST_CONFIG.TEST_USERS.admin.password
      );
      await groupPage.goto();
    });

    test('should have full access to all features', async ({ page }) => {
      const permissions = await groupPage.verifyGroupPermissions('admin');
      
      expect(permissions.canCreate).toBeTruthy();
      expect(permissions.canDelete).toBeTruthy();
      expect(permissions.canEdit).toBeTruthy();
      expect(permissions.canTransfer).toBeTruthy();
      
      // Check navigation access
      const navItems = [
        'Dashboard', 'Groups', 'Projects', 'Bulk Operations', 
        'Jobs', 'Backup', 'Monitoring', 'Settings'
      ];
      
      for (const item of navItems) {
        const isVisible = await page.locator(`button:has-text("${item}")`).isVisible();
        expect(isVisible).toBeTruthy();
      }
      
      await page.screenshot({ 
        path: 'test-results/screenshots/admin-full-access.png',
        fullPage: true 
      });
    });

    test('should be able to create and delete groups', async () => {
      const testGroupName = `e2e-test-admin-${Date.now()}`;
      
      // Create group
      await groupPage.createGroup({
        name: testGroupName,
        description: 'E2E test group created by admin',
        visibility: 'private',
      });
      
      // Verify creation
      const createdGroup = await groupPage.getGroupByName(testGroupName);
      expect(createdGroup).toBeTruthy();
      
      // Delete group
      await groupPage.deleteGroup(testGroupName);
      
      // Verify deletion
      await page.waitForTimeout(1000);
      const deletedGroup = await groupPage.getGroupByName(testGroupName);
      expect(deletedGroup).toBeFalsy();
    });
  });

  test.describe('Manager Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(
        TEST_CONFIG.TEST_USERS.manager.username,
        TEST_CONFIG.TEST_USERS.manager.password
      );
      await groupPage.goto();
    });

    test('should have limited access compared to admin', async ({ page }) => {
      const permissions = await groupPage.verifyGroupPermissions('manager');
      
      expect(permissions.canCreate).toBeTruthy();
      expect(permissions.canEdit).toBeTruthy();
      expect(permissions.canTransfer).toBeTruthy();
      expect(permissions.canDelete).toBeFalsy(); // Managers can't delete
      
      // Check restricted navigation
      const restrictedItems = ['Monitoring', 'Backup'];
      for (const item of restrictedItems) {
        const isVisible = await page.locator(`button:has-text("${item}")`).isVisible();
        expect(isVisible).toBeFalsy();
      }
      
      await page.screenshot({ 
        path: 'test-results/screenshots/manager-permissions.png',
        fullPage: true 
      });
    });

    test('should be able to create but not delete groups', async () => {
      const testGroupName = `e2e-test-manager-${Date.now()}`;
      
      // Create group
      await groupPage.createGroup({
        name: testGroupName,
        description: 'E2E test group created by manager',
        visibility: 'internal',
      });
      
      // Verify creation
      const createdGroup = await groupPage.getGroupByName(testGroupName);
      expect(createdGroup).toBeTruthy();
      
      // Attempt to delete (should fail or not show option)
      const group = await groupPage.getGroupByName(testGroupName);
      if (group) {
        await group.locator('button[aria-label*="more"]').click();
        const deleteOption = await page.locator('[role="menuitem"]:has-text("Delete")').isVisible();
        expect(deleteOption).toBeFalsy();
        
        // Close menu
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Developer Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(
        TEST_CONFIG.TEST_USERS.developer.username,
        TEST_CONFIG.TEST_USERS.developer.password
      );
    });

    test('should have read and limited create access', async ({ page }) => {
      await groupPage.goto();
      const permissions = await groupPage.verifyGroupPermissions('developer');
      
      expect(permissions.canCreate).toBeFalsy(); // Can't create groups
      expect(permissions.canDelete).toBeFalsy();
      expect(permissions.canEdit).toBeFalsy();
      expect(permissions.canTransfer).toBeFalsy();
      
      // But can access projects
      await page.click('button:has-text("Projects")');
      await expect(page).toHaveURL(/\/projects/);
      
      // Check if can create projects (developers usually can)
      const createProjectButton = page.locator('button:has-text("Create Project")');
      const canCreateProject = await createProjectButton.isVisible();
      expect(canCreateProject).toBeTruthy();
      
      await page.screenshot({ 
        path: 'test-results/screenshots/developer-permissions.png',
        fullPage: true 
      });
    });
  });

  test.describe('Viewer Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(
        TEST_CONFIG.TEST_USERS.viewer.username,
        TEST_CONFIG.TEST_USERS.viewer.password
      );
    });

    test('should have read-only access', async ({ page }) => {
      await groupPage.goto();
      const permissions = await groupPage.verifyGroupPermissions('viewer');
      
      // Should not have any modification permissions
      expect(permissions.canCreate).toBeFalsy();
      expect(permissions.canDelete).toBeFalsy();
      expect(permissions.canEdit).toBeFalsy();
      expect(permissions.canTransfer).toBeFalsy();
      
      // Should not see create buttons
      const createGroupButton = await page.locator('button:has-text("Create Group")').isVisible();
      expect(createGroupButton).toBeFalsy();
      
      // Should not see action menus
      const groups = await groupPage.groupList.locator('[role="listitem"]').all();
      if (groups.length > 0) {
        const moreButton = groups[0].locator('button[aria-label*="more"]');
        const hasActions = await moreButton.isVisible();
        expect(hasActions).toBeFalsy();
      }
      
      await page.screenshot({ 
        path: 'test-results/screenshots/viewer-readonly.png',
        fullPage: true 
      });
    });

    test('should not be able to access restricted pages', async ({ page }) => {
      // Try to access restricted pages
      const restrictedPaths = [
        '/bulk-operations',
        '/backup-restore',
        '/monitoring',
        '/settings',
      ];
      
      for (const path of restrictedPaths) {
        await page.goto(path);
        
        // Should either redirect or show permission denied
        const url = page.url();
        const isRestricted = url.includes('login') || url.includes('dashboard');
        const hasPermissionError = await page.locator('text=/permission|권한|access denied/i').isVisible();
        
        expect(isRestricted || hasPermissionError).toBeTruthy();
      }
    });
  });

  test('should enforce API-level permissions', async ({ page, request }) => {
    // Test that API also enforces permissions
    const testCases = [
      {
        role: 'viewer',
        method: 'POST',
        endpoint: '/api/groups',
        expectedStatus: 403,
      },
      {
        role: 'developer',
        method: 'DELETE',
        endpoint: '/api/groups/1',
        expectedStatus: 403,
      },
      {
        role: 'manager',
        method: 'POST',
        endpoint: '/api/system/backup',
        expectedStatus: 403,
      },
    ];
    
    for (const testCase of testCases) {
      // Login as role
      await loginPage.goto();
      await loginPage.login(
        TEST_CONFIG.TEST_USERS[testCase.role as keyof typeof TEST_CONFIG.TEST_USERS].username,
        TEST_CONFIG.TEST_USERS[testCase.role as keyof typeof TEST_CONFIG.TEST_USERS].password
      );
      
      // Get auth token from cookies or localStorage
      const token = await page.evaluate(() => {
        return localStorage.getItem('authToken') || '';
      });
      
      if (token) {
        // Make API request
        const response = await request.fetch(testCase.endpoint, {
          method: testCase.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: testCase.method === 'POST' ? { name: 'test' } : undefined,
        });
        
        expect(response.status()).toBe(testCase.expectedStatus);
      }
    }
  });

  test('should update UI dynamically based on permissions', async ({ page }) => {
    // Login as admin first
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    // Navigate to groups
    await groupPage.goto();
    
    // Check admin UI elements
    let createButton = await page.locator('button:has-text("Create Group")').isVisible();
    expect(createButton).toBeTruthy();
    
    // Logout
    await page.locator('button[aria-label="user menu"]').click();
    await page.locator('text=Logout').click();
    
    // Login as viewer
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.viewer.username,
      TEST_CONFIG.TEST_USERS.viewer.password
    );
    
    // Navigate to groups again
    await groupPage.goto();
    
    // Check viewer UI elements
    createButton = await page.locator('button:has-text("Create Group")').isVisible();
    expect(createButton).toBeFalsy();
  });
});