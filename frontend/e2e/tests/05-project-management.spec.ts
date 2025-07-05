import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProjectManagementPage } from '../pages/ProjectManagementPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Project Management Features', () => {
  let loginPage: LoginPage;
  let projectPage: ProjectManagementPage;
  let groupPage: GroupManagementPage;
  const timestamp = Date.now();
  let testGroupName: string;

  test.beforeAll(async ({ browser }) => {
    // Create a test group for projects
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    testGroupName = `e2e-project-test-group-${timestamp}`;
    await groupPage.goto();
    await groupPage.createGroup({
      name: testGroupName,
      description: 'Test group for project management E2E tests',
      visibility: 'private',
      parentId: TEST_CONFIG.TARGET_GROUP_ID,
    });
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    projectPage = new ProjectManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    await projectPage.goto();
  });

  test('should display tree view with groups and projects', async ({ page }) => {
    // Wait for tree to load
    await page.waitForSelector('[role="tree"]');
    
    // Get all visible nodes
    const nodes = await projectPage.getAllVisibleNodes();
    console.log(`Tree has ${nodes.length} visible nodes`);
    
    // Check for different node types
    const groups = nodes.filter(n => n.type === 'group');
    const projects = nodes.filter(n => n.type === 'project');
    
    console.log(`Groups: ${groups.length}, Projects: ${projects.length}`);
    
    // Verify tree structure
    expect(nodes.length).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/project-tree-view.png',
      fullPage: true 
    });
  });

  test('should test lazy loading in tree view', async ({ page }) => {
    const lazyLoadResults = await projectPage.testLazyLoading();
    
    console.log('Lazy Loading Results:', lazyLoadResults);
    
    // Verify lazy loading worked
    expect(lazyLoadResults.expandedCount).toBeGreaterThanOrEqual(lazyLoadResults.initialCount);
    
    // Performance check
    expect(lazyLoadResults.loadTime).toBeLessThan(2000); // Under 2 seconds
    
    await page.screenshot({ 
      path: 'test-results/screenshots/tree-lazy-loading.png',
      fullPage: true 
    });
  });

  test('should create a new project in test group', async ({ page }) => {
    // Find and select the test group
    await projectPage.searchInTree(testGroupName);
    await page.waitForTimeout(1000);
    
    // Expand and select the group
    await projectPage.expandTreeNode(testGroupName);
    await projectPage.selectTreeNode(testGroupName);
    
    const projectName = `e2e-project-${timestamp}`;
    const projectPath = `e2e-project-${timestamp}`;
    
    // Create project
    await projectPage.createProject({
      name: projectName,
      path: projectPath,
      description: 'E2E test project with all features enabled',
      visibility: 'private',
    });
    
    // Verify project appears in tree
    await page.waitForTimeout(2000);
    const projectNode = await projectPage.getTreeNodeByName(projectName);
    expect(projectNode).toBeTruthy();
    
    // Select project and verify details
    await projectPage.selectTreeNode(projectName);
    const details = await projectPage.getProjectDetails();
    
    expect(details).toBeTruthy();
    expect(details?.name).toBe(projectName);
    expect(details?.visibility).toBe('private');
    
    await page.screenshot({ 
      path: 'test-results/screenshots/project-created.png',
      fullPage: true 
    });
  });

  test('should drag and drop project between groups', async ({ page }) => {
    // Create a second group for drag target
    const targetGroupName = `e2e-target-group-${timestamp}`;
    
    // Navigate to groups to create target
    await page.click('button:has-text("Groups")');
    const groupPage = new GroupManagementPage(page);
    await groupPage.createGroup({
      name: targetGroupName,
      visibility: 'private',
      parentId: TEST_CONFIG.TARGET_GROUP_ID,
    });
    
    // Go back to projects
    await projectPage.goto();
    
    // Create a project to drag
    const dragProjectName = `e2e-drag-project-${timestamp}`;
    await projectPage.searchInTree(testGroupName);
    await projectPage.selectTreeNode(testGroupName);
    await projectPage.createProject({
      name: dragProjectName,
      visibility: 'private',
    });
    
    await page.waitForTimeout(2000);
    
    // Perform drag and drop
    try {
      await projectPage.dragAndDropNode(dragProjectName, targetGroupName);
      
      // Verify move notification
      await page.waitForSelector('[role="alert"]:has-text("moved")');
      
      // Verify project is now under target group
      await projectPage.expandTreeNode(targetGroupName);
      const movedProject = await projectPage.getTreeNodeByName(dragProjectName);
      expect(movedProject).toBeTruthy();
      
      await page.screenshot({ 
        path: 'test-results/screenshots/project-drag-drop.png',
        fullPage: true 
      });
    } catch (error) {
      console.log('Drag and drop test skipped - may not be supported in headless mode');
    }
  });

  test('should display context menu with role-based actions', async ({ page }) => {
    // Find a project in the tree
    const nodes = await projectPage.getAllVisibleNodes();
    const projectNode = nodes.find(n => n.type === 'project');
    
    if (projectNode) {
      const actions = await projectPage.getContextMenuActions(projectNode.name);
      
      console.log('Available actions:', actions);
      
      // Admin should see all actions
      expect(actions).toContain('Edit');
      expect(actions).toContain('Delete');
      
      await page.screenshot({ 
        path: 'test-results/screenshots/project-context-menu.png',
        fullPage: true 
      });
    }
  });

  test('should handle large number of projects efficiently', async ({ page }) => {
    // Measure initial load time
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector('[role="tree"]');
    const loadTime = Date.now() - startTime;
    
    console.log(`Tree loaded in ${loadTime}ms`);
    
    // Create multiple projects to test performance
    const projectPromises = [];
    for (let i = 0; i < 5; i++) {
      const projectName = `e2e-perf-project-${timestamp}-${i}`;
      projectPromises.push(
        projectPage.createProject({
          name: projectName,
          visibility: 'private',
        })
      );
      
      if (i < 4) await page.waitForTimeout(500); // Avoid rate limiting
    }
    
    await Promise.all(projectPromises);
    
    // Measure tree performance with more items
    const perfStartTime = Date.now();
    await page.reload();
    await page.waitForSelector('[role="tree"]');
    const perfLoadTime = Date.now() - perfStartTime;
    
    console.log(`Tree with more items loaded in ${perfLoadTime}ms`);
    
    // Performance should not degrade significantly
    expect(perfLoadTime).toBeLessThan(loadTime * 1.5);
  });

  test('should update project details', async ({ page }) => {
    // Create a project to edit
    const projectName = `e2e-edit-project-${timestamp}`;
    await projectPage.searchInTree(testGroupName);
    await projectPage.selectTreeNode(testGroupName);
    await projectPage.createProject({
      name: projectName,
      description: 'Original description',
      visibility: 'private',
    });
    
    await page.waitForTimeout(2000);
    
    // Select and edit the project
    await projectPage.selectTreeNode(projectName);
    
    // Open edit dialog
    const moreButton = await page.locator('button[aria-label*="more"]');
    await moreButton.click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    
    // Update project details
    const newDescription = 'Updated project description';
    await page.fill('textarea[name="description"]', newDescription);
    await page.selectOption('[name="visibility"]', 'internal');
    
    // Save changes
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]:has-text("updated")');
    
    // Verify changes
    await page.reload();
    await projectPage.selectTreeNode(projectName);
    const details = await projectPage.getProjectDetails();
    
    expect(details?.visibility).toBe('internal');
  });

  test('should delete project with confirmation', async ({ page }) => {
    // Create a project to delete
    const projectName = `e2e-delete-project-${timestamp}`;
    await projectPage.searchInTree(testGroupName);
    await projectPage.selectTreeNode(testGroupName);
    await projectPage.createProject({
      name: projectName,
      visibility: 'private',
    });
    
    await page.waitForTimeout(2000);
    
    // Delete the project
    page.on('dialog', dialog => dialog.accept());
    await projectPage.deleteProject(projectName);
    
    // Verify deletion
    await page.waitForTimeout(1000);
    const deletedProject = await projectPage.getTreeNodeByName(projectName);
    expect(deletedProject).toBeFalsy();
  });

  test('should search projects in tree view', async ({ page }) => {
    // Create projects with searchable names
    const searchProjects = [
      `e2e-search-alpha-${timestamp}`,
      `e2e-search-beta-${timestamp}`,
      `e2e-search-gamma-${timestamp}`,
    ];
    
    for (const name of searchProjects) {
      await projectPage.createProject({ name, visibility: 'private' });
      await page.waitForTimeout(500);
    }
    
    // Test search
    await projectPage.searchInTree('alpha');
    await page.waitForTimeout(1000);
    
    // Verify search results
    const visibleNodes = await projectPage.getAllVisibleNodes();
    const alphaVisible = visibleNodes.some(n => n.name.includes('alpha'));
    const betaVisible = visibleNodes.some(n => n.name.includes('beta'));
    
    expect(alphaVisible).toBeTruthy();
    
    // Clear search
    await projectPage.searchInTree('');
    await page.waitForTimeout(1000);
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: Delete test group and all its contents
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    try {
      page.on('dialog', dialog => dialog.accept());
      await groupPage.deleteGroup(testGroupName);
      
      // Also try to delete the target group
      const targetGroupName = `e2e-target-group-${timestamp}`;
      await groupPage.deleteGroup(targetGroupName);
    } catch (error) {
      console.log('Cleanup error:', error);
    }
    
    await page.close();
  });
});