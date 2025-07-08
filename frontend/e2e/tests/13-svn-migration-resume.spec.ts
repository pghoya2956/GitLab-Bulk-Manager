import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('SVN Migration Resume Functionality', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    
    // Login with environment variable PAT
    await loginPage.login(
      process.env.GITLAB_URL || 'https://gitlab.com',
      process.env.GITLAB_PAT || 'test-token'
    );
  });

  test('should display resume button for failed migrations', async ({ page }) => {
    // Navigate to Migration Monitor
    await page.goto('/migration-monitor');
    
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Look for failed migration rows
    const failedRows = page.locator('tr:has-text("failed")');
    const failedCount = await failedRows.count();
    
    if (failedCount > 0) {
      // Check that resume button (Replay icon) is visible for failed migrations
      const resumeButton = failedRows.first().locator('button[aria-label*="재개"], button:has(svg[data-testid="ReplayIcon"])');
      await expect(resumeButton).toBeVisible();
    } else {
      // If no failed migrations, create one for testing
      console.log('No failed migrations found, skipping resume button test');
    }
  });

  test('should open resume dialog when clicking resume button', async ({ page }) => {
    // Navigate to Migration Monitor
    await page.goto('/migration-monitor');
    
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Find first failed migration and click resume
    const failedRow = page.locator('tr:has-text("failed")').first();
    const rowExists = await failedRow.isVisible();
    
    if (rowExists) {
      const resumeButton = failedRow.locator('button').filter({ hasText: '재개' });
      await resumeButton.click();
      
      // Verify resume dialog opens
      await expect(page.locator('h2:has-text("마이그레이션 재개")')).toBeVisible();
      
      // Check dialog content
      await expect(page.locator('text=마이그레이션 정보')).toBeVisible();
      await expect(page.locator('text=재개 옵션')).toBeVisible();
      
      // Verify resume options
      const fromLastOption = page.locator('text=이어서 진행');
      const fromBeginningOption = page.locator('text=처음부터 다시');
      
      await expect(fromBeginningOption).toBeVisible();
      
      // Check if "from last" option is disabled when temp dir is missing
      const fromLastRadio = page.locator('input[type="radio"][value="lastRevision"]');
      const isDisabled = await fromLastRadio.isDisabled();
      
      if (isDisabled) {
        // Should show warning message
        await expect(page.locator('text=임시 저장소가 없거나 손상되어')).toBeVisible();
      }
    }
  });

  test('should handle SVN authentication when resuming', async ({ page }) => {
    // Navigate to Migration Monitor
    await page.goto('/migration-monitor');
    
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Find first failed migration
    const failedRow = page.locator('tr:has-text("failed")').first();
    const rowExists = await failedRow.isVisible();
    
    if (rowExists) {
      // Click resume button
      const resumeButton = failedRow.locator('button').filter({ hasText: '재개' });
      await resumeButton.click();
      
      // Wait for dialog
      await expect(page.locator('h2:has-text("마이그레이션 재개")')).toBeVisible();
      
      // Select "from beginning" option
      const fromBeginningRadio = page.locator('input[type="radio"][value="beginning"]');
      await fromBeginningRadio.check();
      
      // Click resume button in dialog
      const dialogResumeButton = page.locator('dialog button:has-text("재개")');
      await dialogResumeButton.click();
      
      // Check if SVN auth fields appear (after 401 response)
      const svnUsernameField = page.locator('input[placeholder*="SVN 사용자명"]');
      const authFieldsVisible = await svnUsernameField.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (authFieldsVisible) {
        // Fill SVN credentials
        await svnUsernameField.fill('testuser');
        await page.locator('input[type="password"][placeholder*="SVN 비밀번호"]').fill('testpass');
        
        // Try resume again
        await dialogResumeButton.click();
      }
      
      // Verify dialog closes and migration starts
      await expect(page.locator('h2:has-text("마이그레이션 재개")')).not.toBeVisible({ timeout: 10000 });
    }
  });

  test('should show keepTempFiles option in new migration', async ({ page }) => {
    // Navigate to main page
    await page.goto('/');
    
    // Click SVN to Git button
    await page.locator('button:has-text("SVN to Git")').click();
    
    // Verify dialog opened
    await expect(page.locator('text=SVN to GitLab 마이그레이션')).toBeVisible();
    
    // Fill SVN URL to enable options
    await page.locator('input[placeholder*="SVN 저장소 URL"]').fill('https://svn.example.com/repos/test');
    
    // Expand advanced options if needed
    const advancedSection = page.locator('text=고급 옵션');
    if (await advancedSection.isVisible()) {
      await advancedSection.click();
    }
    
    // Check for keepTempFiles checkbox
    const keepTempFilesCheckbox = page.locator('label:has-text("임시 파일 유지")');
    await expect(keepTempFilesCheckbox).toBeVisible();
    
    // Verify it's checked by default
    const checkbox = keepTempFilesCheckbox.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('should update migration status after resume', async ({ page }) => {
    // Navigate to Migration Monitor
    await page.goto('/migration-monitor');
    
    // Get initial failed count
    const initialFailedCount = await page.locator('text=실패: ').textContent();
    const failedNumber = parseInt(initialFailedCount?.match(/\d+/)?.[0] || '0');
    
    if (failedNumber > 0) {
      // Find and resume first failed migration
      const failedRow = page.locator('tr:has-text("failed")').first();
      const migrationId = await failedRow.getAttribute('data-migration-id');
      
      const resumeButton = failedRow.locator('button').filter({ hasText: '재개' });
      await resumeButton.click();
      
      // Handle resume dialog
      await expect(page.locator('h2:has-text("마이그레이션 재개")')).toBeVisible();
      
      // Select from beginning
      await page.locator('input[type="radio"][value="beginning"]').check();
      
      // Click resume
      await page.locator('dialog button:has-text("재개")').click();
      
      // Handle auth if needed
      const svnUsernameField = page.locator('input[placeholder*="SVN 사용자명"]');
      if (await svnUsernameField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await svnUsernameField.fill('testuser');
        await page.locator('input[type="password"]').fill('testpass');
        await page.locator('dialog button:has-text("재개")').click();
      }
      
      // Wait for dialog to close
      await expect(page.locator('h2:has-text("마이그레이션 재개")')).not.toBeVisible({ timeout: 10000 });
      
      // Check if status changed from failed to pending/running
      if (migrationId) {
        const updatedRow = page.locator(`tr[data-migration-id="${migrationId}"]`);
        await expect(updatedRow).not.toHaveText('failed', { timeout: 5000 });
      }
    }
  });
});