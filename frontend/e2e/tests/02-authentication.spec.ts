import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test('should display login page elements', async ({ page }) => {
    // Check all required elements are visible
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    
    // Check for branding
    await expect(page.locator('text=GitLab Bulk Manager')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page.png',
      fullPage: true 
    });
  });

  test('should show validation errors for empty fields', async () => {
    // Try to submit empty form
    await loginPage.loginButton.click();
    
    // Check for validation messages
    const error = await loginPage.getErrorMessage();
    expect(error).toBeTruthy();
    expect(error).toMatch(/required|필수/i);
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('invalid@user.com', 'wrongpassword');
    
    const error = await loginPage.getErrorMessage();
    expect(error).toBeTruthy();
    expect(error).toMatch(/invalid|incorrect|잘못된/i);
  });

  // Test each user role
  const roles = ['admin', 'manager', 'developer', 'viewer'] as const;
  
  for (const role of roles) {
    test(`should login successfully as ${role}`, async ({ page }) => {
      const user = TEST_CONFIG.TEST_USERS[role];
      
      // Perform login
      await loginPage.login(user.username, user.password);
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify dashboard loaded
      const dashboardVisible = await dashboardPage.verifyDashboardElements();
      expect(dashboardVisible.allVisible).toBeTruthy();
      
      // Check user role in UI
      await dashboardPage.openUserMenu();
      const roleText = await page.locator(`text=${role}`).isVisible();
      expect(roleText).toBeTruthy();
      
      // Take screenshot of dashboard for each role
      await page.screenshot({ 
        path: `test-results/screenshots/dashboard-${role}.png`,
        fullPage: true 
      });
      
      // Logout for next test
      await dashboardPage.logout();
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('should maintain session after page refresh', async ({ page, context }) => {
    const user = TEST_CONFIG.TEST_USERS.admin;
    
    // Login
    await loginPage.login(user.username, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Get cookies
    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Should not show login page
    await expect(loginPage.usernameInput).not.toBeVisible();
  });

  test('should redirect to requested page after login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/groups');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Login
    const user = TEST_CONFIG.TEST_USERS.admin;
    await loginPage.login(user.username, user.password);
    
    // Should redirect to originally requested page
    await expect(page).toHaveURL(/\/groups/);
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    const user = TEST_CONFIG.TEST_USERS.admin;
    
    // Create multiple pages
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    const loginPage1 = new LoginPage(page1);
    const loginPage2 = new LoginPage(page2);
    
    // Navigate both to login
    await loginPage1.goto();
    await loginPage2.goto();
    
    // Login on both pages simultaneously
    await Promise.all([
      loginPage1.login(user.username, user.password),
      loginPage2.login(user.username, user.password),
    ]);
    
    // Both should be on dashboard
    await expect(page1).toHaveURL(/\/dashboard/);
    await expect(page2).toHaveURL(/\/dashboard/);
    
    // Cleanup
    await page1.close();
    await page2.close();
  });

  test('should handle session timeout gracefully', async ({ page }) => {
    const user = TEST_CONFIG.TEST_USERS.admin;
    
    // Login
    await loginPage.login(user.username, user.password);
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Simulate session expiry by clearing cookies
    await context.clearCookies();
    
    // Try to navigate to protected route
    await page.goto('/groups');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Should show session expired message
    const message = await page.locator('text=/session|expired|만료/i').isVisible();
    expect(message).toBeTruthy();
  });

  test('should measure login performance', async ({ page }) => {
    const user = TEST_CONFIG.TEST_USERS.admin;
    
    // Measure login time
    const startTime = Date.now();
    
    await loginPage.usernameInput.fill(user.username);
    await loginPage.passwordInput.fill(user.password);
    
    // Start measuring API call
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/auth/login') && resp.status() === 200
    );
    
    await loginPage.loginButton.click();
    
    const response = await responsePromise;
    const loginTime = Date.now() - startTime;
    
    console.log(`Login completed in ${loginTime}ms`);
    
    // Assert performance
    expect(loginTime).toBeLessThan(3000); // Under 3 seconds
    
    // Check response time
    const timing = response.timing();
    console.log('API Response time:', timing.responseEnd - timing.requestStart, 'ms');
  });
});