import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';

test.describe('SVN to GitLab Migration', () => {
  let loginPage: LoginPage;
  let groupPage: GroupManagementPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    // Login with environment variable PAT
    await loginPage.login(
      process.env.GITLAB_URL || 'https://gitlab.com',
      process.env.GITLAB_PAT || 'test-token'
    );
  });

  test('should open SVN migration dialog', async ({ page }) => {
    // Navigate to groups page
    await page.goto('/');
    
    // Find and click SVN to Git button
    const svnButton = page.locator('button:has-text("SVN to Git")');
    await expect(svnButton).toBeVisible();
    await expect(svnButton).toHaveCSS('background', /linear-gradient/);
    
    await svnButton.click();
    
    // Verify dialog opened
    await expect(page.locator('text=SVN to GitLab 마이그레이션')).toBeVisible();
    await expect(page.locator('text=SVN 연결')).toBeVisible();
  });

  test('should test SVN connection', async ({ page }) => {
    // Open SVN migration dialog
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Fill connection form
    const svnUrlInput = page.locator('input[placeholder*="SVN 저장소 URL"]');
    await svnUrlInput.fill('file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout');
    
    // Test connection
    const testButton = page.locator('button:has-text("연결 테스트")');
    await testButton.click();
    
    // Wait for success message
    await expect(page.locator('text=연결 성공')).toBeVisible({ timeout: 10000 });
    
    // Verify Next button is enabled
    const nextButton = page.locator('button:has-text("다음")');
    await expect(nextButton).toBeEnabled();
  });

  test('should complete full migration workflow', async ({ page }) => {
    // Open SVN migration dialog
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Step 1: SVN Connection
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout'
    );
    
    await page.locator('button:has-text("연결 테스트")').click();
    await expect(page.locator('text=연결 성공')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("다음")').click();
    
    // Step 2: User Mapping
    await expect(page.locator('text=사용자 매핑')).toBeVisible();
    
    // Check if users are loaded
    await expect(page.locator('text=john.doe')).toBeVisible({ timeout: 5000 });
    
    // Upload authors file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('/Users/infograb/Workspace/Area/GitLab/sample/authors.txt');
    
    await page.locator('button:has-text("다음")').click();
    
    // Step 3: Preview
    await expect(page.locator('text=미리보기')).toBeVisible();
    
    // Select target group if available
    const groupSelect = page.locator('[data-testid="group-select"]');
    if (await groupSelect.isVisible()) {
      await groupSelect.click();
      await page.locator('text=migrated-projects').first().click();
    }
    
    // Enter project name
    await page.locator('input[placeholder*="GitLab 프로젝트 이름"]').fill('standard-layout-migrated');
    
    await page.locator('button:has-text("마이그레이션 시작")').click();
    
    // Step 4: Progress
    await expect(page.locator('text=마이그레이션')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    // Wait for completion (with timeout)
    await expect(page.locator('text=완료')).toBeVisible({ timeout: 60000 });
  });

  test('should handle trunk-only layout', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Connect to trunk-only repo
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/trunk-only'
    );
    
    // Select trunk layout
    await page.locator('text=Trunk').click();
    await page.locator('[value="trunk"]').check();
    
    await page.locator('button:has-text("연결 테스트")').click();
    await expect(page.locator('text=연결 성공')).toBeVisible({ timeout: 10000 });
  });

  test('should handle custom layout', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Connect to stable-dev repo
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/stable-dev'
    );
    
    // Select custom layout
    await page.locator('text=Custom').click();
    await page.locator('[value="custom"]').check();
    
    // Fill custom paths
    await page.locator('input[placeholder*="Trunk 경로"]').fill('development');
    await page.locator('input[placeholder*="Branches 경로"]').fill('stable');
    await page.locator('input[placeholder*="Tags 경로"]').fill('releases');
    
    await page.locator('button:has-text("연결 테스트")').click();
    await expect(page.locator('text=연결 성공')).toBeVisible({ timeout: 10000 });
  });

  test('should handle bulk migration with YAML', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Switch to bulk mode
    await page.locator('text=대량 마이그레이션').click();
    
    // Upload YAML file
    const fileInput = page.locator('input[type="file"][accept*="yaml"]');
    await fileInput.setInputFiles('/Users/infograb/Workspace/Area/GitLab/sample/bulk-migration.yaml');
    
    // Wait for preview table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=standard-project')).toBeVisible();
    await expect(page.locator('text=simple-service')).toBeVisible();
    
    // Start bulk migration
    await page.locator('button:has-text("모두 마이그레이션")').click();
    
    // Verify progress indicators
    await expect(page.locator('[role="progressbar"]').first()).toBeVisible();
  });

  test('should show real-time progress via WebSocket', async ({ page }) => {
    // Setup WebSocket listener
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        if (event.payload) {
          try {
            const data = JSON.parse(event.payload.toString());
            wsMessages.push(data);
          } catch (e) {
            // Ignore non-JSON messages
          }
        }
      });
    });
    
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Quick migration setup
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/trunk-only'
    );
    await page.locator('[value="trunk"]').check();
    await page.locator('button:has-text("연결 테스트")').click();
    await page.locator('button:has-text("다음")').click();
    await page.locator('button:has-text("다음")').click();
    await page.locator('input[placeholder*="GitLab 프로젝트 이름"]').fill('trunk-only-test');
    await page.locator('button:has-text("마이그레이션 시작")').click();
    
    // Wait for WebSocket messages
    await page.waitForTimeout(2000);
    
    // Verify WebSocket messages received
    const progressMessages = wsMessages.filter(msg => msg.type === 'job:progress');
    expect(progressMessages.length).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Try invalid SVN URL
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///invalid/path/to/repo'
    );
    
    await page.locator('button:has-text("연결 테스트")').click();
    
    // Should show error message
    await expect(page.locator('text=연결 실패')).toBeVisible({ timeout: 10000 });
    
    // Next button should remain disabled
    const nextButton = page.locator('button:has-text("다음")');
    await expect(nextButton).toBeDisabled();
  });

  test('should support incremental sync', async ({ page }) => {
    // First, create a migrated project (mock)
    // In real test, this would be an already migrated project
    
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Check "증분 동기화" option
    await page.locator('text=증분 동기화').click();
    
    // Select existing project
    await page.locator('[data-testid="existing-project-select"]').click();
    await page.locator('text=standard-layout-migrated').click();
    
    // Fill SVN URL
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout'
    );
    
    // Start sync
    await page.locator('button:has-text("동기화 시작")').click();
    
    // Verify sync progress
    await expect(page.locator('text=동기화 중')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Try to proceed without filling required fields
    const nextButton = page.locator('button:has-text("다음")');
    await expect(nextButton).toBeDisabled();
    
    // Fill URL but not test connection
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(
      'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout'
    );
    
    // Next should still be disabled until connection test
    await expect(nextButton).toBeDisabled();
    
    // Test connection
    await page.locator('button:has-text("연결 테스트")').click();
    await expect(page.locator('text=연결 성공')).toBeVisible();
    
    // Now Next should be enabled
    await expect(nextButton).toBeEnabled();
  });

  test('should persist form state during navigation', async ({ page }) => {
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Fill some data
    const testUrl = 'file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout';
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill(testUrl);
    await page.locator('[value="standard"]').check();
    
    // Go to next step
    await page.locator('button:has-text("연결 테스트")').click();
    await page.locator('button:has-text("다음")').click();
    
    // Go back
    await page.locator('button:has-text("이전")').click();
    
    // Verify data is preserved
    await expect(page.locator('input[placeholder*="SVN 저장소 URL"]')).toHaveValue(testUrl);
    await expect(page.locator('[value="standard"]')).toBeChecked();
  });
});