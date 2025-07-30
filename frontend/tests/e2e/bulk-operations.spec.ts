import { test, expect, Page } from '@playwright/test';

const TEST_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:4000';

// Helper functions
async function login(page: Page) {
  await page.goto(TEST_URL);
  
  // Fill login form
  await page.fill('input[name="gitlabUrl"]', 'https://gitlab.com');
  await page.fill('input[name="token"]', process.env.GITLAB_TEST_TOKEN || 'test-token');
  
  // Mock the login API response
  await page.route('**/api/auth/login', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: {
          id: 1,
          username: 'testuser',
          name: 'Test User',
          is_admin: true
        }
      })
    });
  });
  
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="groups-projects-page"]', { timeout: 10000 });
}

async function mockGroupsAndProjects(page: Page) {
  // Mock groups API
  await page.route('**/api/gitlab/groups*', route => {
    route.fulfill({
      status: 200,
      headers: {
        'x-total': '3'
      },
      body: JSON.stringify([
        {
          id: 1,
          name: 'Test Group 1',
          path: 'test-group-1',
          full_path: 'test-group-1',
          visibility: 'private',
          type: 'group'
        },
        {
          id: 2,
          name: 'Test Group 2',
          path: 'test-group-2',
          full_path: 'test-group-2',
          visibility: 'internal',
          type: 'group'
        },
        {
          id: 3,
          name: 'Test Group 3',
          path: 'test-group-3',
          full_path: 'test-group-3',
          visibility: 'public',
          type: 'group'
        }
      ])
    });
  });

  // Mock projects API
  await page.route('**/api/gitlab/projects*', route => {
    route.fulfill({
      status: 200,
      headers: {
        'x-total': '2'
      },
      body: JSON.stringify([
        {
          id: 101,
          name: 'Test Project 1',
          path: 'test-project-1',
          path_with_namespace: 'test-group-1/test-project-1',
          namespace: { id: 1, name: 'Test Group 1' },
          visibility: 'private',
          type: 'project'
        },
        {
          id: 102,
          name: 'Test Project 2',
          path: 'test-project-2',
          path_with_namespace: 'test-group-2/test-project-2',
          namespace: { id: 2, name: 'Test Group 2' },
          visibility: 'internal',
          type: 'project'
        }
      ])
    });
  });

  // Mock permissions overview
  await page.route('**/api/permissions/overview', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({})
    });
  });
}

test.describe('Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await mockGroupsAndProjects(page);
  });

  test('Bulk Delete - should delete selected items', async ({ page }) => {
    // Navigate to Groups & Projects page
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select mode
    await page.click('[title="Enable multi-select"]');
    
    // Select multiple items
    await page.click('input[type="checkbox"][value="group-1"]');
    await page.click('input[type="checkbox"][value="project-101"]');
    
    // Verify selection count
    await expect(page.locator('text=2 items selected')).toBeVisible();
    
    // Open bulk actions menu
    await page.click('button:has-text("Bulk Actions")');
    
    // Click delete option
    await page.click('text=Delete Selected Items');
    
    // Verify delete dialog is open
    await expect(page.locator('text=일괄 삭제')).toBeVisible();
    await expect(page.locator('text=1개 그룹')).toBeVisible();
    await expect(page.locator('text=1개 프로젝트')).toBeVisible();
    
    // Mock bulk delete API
    await page.route('**/api/gitlab/bulk/delete', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: [
            { id: 1, name: 'Test Group 1', type: 'group' },
            { id: 101, name: 'Test Project 1', type: 'project' }
          ],
          failed: [],
          total: 2
        })
      });
    });
    
    // Confirm deletion
    await page.click('input[type="checkbox"]'); // Check confirmation
    await page.click('button:has-text("삭제")');
    
    // Verify success message
    await expect(page.locator('text=전체: 2개, 성공: 2개, 실패: 0개')).toBeVisible();
    
    // Close dialog
    await page.click('button:has-text("닫기")');
  });

  test('Bulk Transfer - should move items to different namespace', async ({ page }) => {
    // Navigate to Groups & Projects page
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select mode
    await page.click('[title="Enable multi-select"]');
    
    // Select items
    await page.click('input[type="checkbox"][value="project-101"]');
    await page.click('input[type="checkbox"][value="project-102"]');
    
    // Open bulk actions menu
    await page.click('button:has-text("Bulk Actions")');
    
    // Click transfer option
    await page.click('text=Move to Namespace');
    
    // Verify transfer dialog is open
    await expect(page.locator('text=일괄 네임스페이스 이동')).toBeVisible();
    await expect(page.locator('text=2개 프로젝트')).toBeVisible();
    
    // Mock namespaces API for autocomplete
    await page.route('**/api/gitlab/groups?per_page=100', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 4, name: 'Target Group', full_path: 'target-group', kind: 'group' }
        ])
      });
    });
    
    // Select target namespace
    await page.click('input[placeholder="이동할 네임스페이스를 선택하세요"]');
    await page.click('text=Target Group (target-group)');
    
    // Mock bulk transfer API
    await page.route('**/api/gitlab/bulk/transfer', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: [
            { id: 101, name: 'Test Project 1', type: 'project', newNamespaceId: 4 },
            { id: 102, name: 'Test Project 2', type: 'project', newNamespaceId: 4 }
          ],
          failed: [],
          total: 2
        })
      });
    });
    
    // Execute transfer
    await page.click('button:has-text("이동")');
    
    // Verify success
    await expect(page.locator('text=전체: 2개, 성공: 2개, 실패: 0개')).toBeVisible();
    
    // Close dialog
    await page.click('button:has-text("닫기")');
  });

  test('Bulk Settings - Visibility change', async ({ page }) => {
    // Navigate to Groups & Projects page
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select mode
    await page.click('[title="Enable multi-select"]');
    
    // Select items
    await page.click('input[type="checkbox"][value="group-1"]');
    await page.click('input[type="checkbox"][value="group-2"]');
    
    // Open bulk actions menu
    await page.click('button:has-text("Bulk Actions")');
    
    // Click settings option
    await page.click('text=Bulk Settings');
    
    // Select visibility tab
    await page.click('text=Visibility');
    
    // Select public visibility
    await page.click('label:has-text("Public")');
    
    // Mock bulk visibility API
    await page.route('**/api/gitlab/bulk/settings/visibility', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: [
            { id: 1, name: 'Test Group 1', type: 'group' },
            { id: 2, name: 'Test Group 2', type: 'group' }
          ],
          failed: [],
          total: 2
        })
      });
    });
    
    // Apply changes
    await page.click('button:has-text("Apply Changes")');
    
    // Verify success
    await expect(page.locator('text=Successfully updated visibility for 2 items')).toBeVisible();
  });

  test('Bulk Settings - Protected Branches', async ({ page }) => {
    // Navigate to Groups & Projects page
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select mode
    await page.click('[title="Enable multi-select"]');
    
    // Select projects only
    await page.click('input[type="checkbox"][value="project-101"]');
    await page.click('input[type="checkbox"][value="project-102"]');
    
    // Open bulk actions menu
    await page.click('button:has-text("Bulk Actions")');
    
    // Click settings option
    await page.click('text=Bulk Settings');
    
    // Select protected branches tab
    await page.click('text=Protected Branches');
    
    // Add protected branch rule
    await page.click('button:has-text("Add Rule")');
    await page.fill('input[placeholder="Branch name or pattern"]', 'main');
    
    // Mock bulk protected branches API
    await page.route('**/api/gitlab/bulk/settings/protected-branches', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: [101, 102],
          failed: [],
          total: 2
        })
      });
    });
    
    // Apply changes
    await page.click('button:has-text("Apply Changes")');
    
    // Verify success
    await expect(page.locator('text=Successfully updated protected branches for 2 projects')).toBeVisible();
  });

  test('Bulk Import - YAML import', async ({ page }) => {
    // Navigate to Groups & Projects page  
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Click bulk import button
    await page.click('button:has-text("Bulk Import")');
    
    // Verify dialog is open
    await expect(page.locator('text=Bulk Import Groups & Projects')).toBeVisible();
    
    // Switch to YAML mode
    await page.click('text=YAML Mode');
    
    // Input YAML content
    const yamlContent = `
subgroups:
  - name: Development
    path: dev
    subgroups:
      - name: Frontend
        path: frontend
      - name: Backend
        path: backend
`;
    
    await page.fill('textarea', yamlContent);
    
    // Mock YAML parse API
    await page.route('**/api/gitlab/bulk/parse-yaml', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            subgroups: [
              {
                name: 'Development',
                path: 'dev',
                subgroups: [
                  { name: 'Frontend', path: 'frontend' },
                  { name: 'Backend', path: 'backend' }
                ]
              }
            ]
          }
        })
      });
    });
    
    // Mock bulk subgroups API
    await page.route('**/api/gitlab/bulk/subgroups', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          results: {
            created: [
              { id: 10, name: 'Development', full_path: 'test-group-1/dev' },
              { id: 11, name: 'Frontend', full_path: 'test-group-1/dev/frontend' },
              { id: 12, name: 'Backend', full_path: 'test-group-1/dev/backend' }
            ],
            skipped: [],
            failed: [],
            total: 3
          },
          summary: {
            total: 3,
            created: 3,
            skipped: 0,
            failed: 0
          }
        })
      });
    });
    
    // Create groups
    await page.click('button:has-text("Create")');
    
    // Verify success
    await expect(page.locator('text=Created 3 groups successfully!')).toBeVisible();
  });
});

test.describe('Bulk Operations - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await mockGroupsAndProjects(page);
  });

  test('Should handle partial failures in bulk delete', async ({ page }) => {
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select and select items
    await page.click('[title="Enable multi-select"]');
    await page.click('input[type="checkbox"][value="group-1"]');
    await page.click('input[type="checkbox"][value="group-2"]');
    
    // Open bulk delete
    await page.click('button:has-text("Bulk Actions")');
    await page.click('text=Delete Selected Items');
    
    // Mock partial failure
    await page.route('**/api/gitlab/bulk/delete', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: [
            { id: 1, name: 'Test Group 1', type: 'group' }
          ],
          failed: [
            { id: 2, name: 'Test Group 2', type: 'group', error: 'Permission denied' }
          ],
          total: 2
        })
      });
    });
    
    // Confirm and execute
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("삭제")');
    
    // Verify partial success message
    await expect(page.locator('text=전체: 2개, 성공: 1개, 실패: 1개')).toBeVisible();
    await expect(page.locator('text=Permission denied')).toBeVisible();
  });

  test('Should validate namespace selection in bulk transfer', async ({ page }) => {
    await page.goto(`${TEST_URL}/groups-projects`);
    
    // Enable multi-select and select items
    await page.click('[title="Enable multi-select"]');
    await page.click('input[type="checkbox"][value="project-101"]');
    
    // Open bulk transfer
    await page.click('button:has-text("Bulk Actions")');
    await page.click('text=Move to Namespace');
    
    // Try to transfer without selecting namespace
    const transferButton = page.locator('button:has-text("이동")');
    await expect(transferButton).toBeDisabled();
    
    // Select namespace
    await page.click('input[placeholder="이동할 네임스페이스를 선택하세요"]');
    await page.keyboard.type('Target');
    await page.click('text=Target Group (target-group)');
    
    // Now button should be enabled
    await expect(transferButton).toBeEnabled();
  });
});