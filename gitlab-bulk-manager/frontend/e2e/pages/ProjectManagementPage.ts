import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProjectManagementPage extends BasePage {
  readonly treeView: Locator;
  readonly createProjectButton: Locator;
  readonly projectDetails: Locator;
  readonly createProjectDialog: Locator;
  readonly projectNameInput: Locator;
  readonly projectPathInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly visibilitySelect: Locator;
  readonly groupSelect: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Tree view elements
    this.treeView = page.locator('[role="tree"], .gitlab-tree');
    
    // Project details panel
    this.projectDetails = page.locator('.project-details, [data-testid="project-details"]');
    
    // Create project dialog
    this.createProjectDialog = page.locator('[role="dialog"]');
    this.createProjectButton = page.locator('button:has-text("Create Project")');
    this.projectNameInput = page.locator('input[name="name"]');
    this.projectPathInput = page.locator('input[name="path"]');
    this.projectDescriptionInput = page.locator('textarea[name="description"]');
    this.visibilitySelect = page.locator('[name="visibility"]');
    this.groupSelect = page.locator('[name="namespace_id"], [name="group_id"]');
    this.submitButton = this.createProjectDialog.locator('button[type="submit"], button:has-text("Create")');
    this.cancelButton = this.createProjectDialog.locator('button:has-text("Cancel")');
  }

  async goto() {
    await this.navigate('/projects');
    await this.page.waitForLoadState('networkidle');
  }

  async expandTreeNode(nodeName: string) {
    const node = this.treeView.locator(`[role="treeitem"]:has-text("${nodeName}")`);
    const expandButton = node.locator('[aria-label*="expand"], [class*="expand"]').first();
    
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await this.page.waitForTimeout(500); // Wait for expansion animation
    }
  }

  async selectTreeNode(nodeName: string) {
    const node = this.treeView.locator(`[role="treeitem"]:has-text("${nodeName}")`);
    await node.click();
    await this.page.waitForTimeout(300); // Wait for selection
  }

  async getTreeNodeByName(name: string): Promise<Locator | null> {
    const node = this.treeView.locator(`[role="treeitem"]:has-text("${name}")`);
    if (await node.count() > 0) {
      return node.first();
    }
    return null;
  }

  async createProject(projectData: {
    name: string;
    path?: string;
    description?: string;
    visibility?: 'private' | 'internal' | 'public';
    groupId?: number;
  }) {
    // Check if we need to select a group first
    const selectedNode = await this.page.locator('[aria-selected="true"]').textContent();
    if (!selectedNode && !projectData.groupId) {
      throw new Error('No group selected for project creation');
    }

    await this.createProjectButton.click();
    await this.createProjectDialog.waitFor({ state: 'visible' });

    await this.projectNameInput.fill(projectData.name);
    
    if (projectData.path) {
      await this.projectPathInput.fill(projectData.path);
    }
    
    if (projectData.description) {
      await this.projectDescriptionInput.fill(projectData.description);
    }
    
    if (projectData.visibility) {
      await this.visibilitySelect.selectOption(projectData.visibility);
    }
    
    if (projectData.groupId) {
      await this.groupSelect.selectOption(projectData.groupId.toString());
    }

    await this.submitButton.click();
    await this.waitForNotification('Project created successfully');
  }

  async deleteProject(projectName: string) {
    await this.selectTreeNode(projectName);
    
    // Open context menu
    const moreButton = await this.page.locator('button[aria-label*="more"]');
    await moreButton.click();
    
    await this.page.locator('[role="menuitem"]:has-text("Delete")').click();
    
    // Confirm deletion
    await this.page.locator('button:has-text("Delete")').last().click();
    await this.waitForNotification('deleted successfully');
  }

  async dragAndDropNode(sourceNode: string, targetNode: string) {
    const source = await this.getTreeNodeByName(sourceNode);
    const target = await this.getTreeNodeByName(targetNode);
    
    if (!source || !target) {
      throw new Error('Source or target node not found');
    }

    await source.dragTo(target);
    await this.page.waitForTimeout(1000); // Wait for drop animation
  }

  async getProjectDetails(): Promise<{
    name: string;
    path: string;
    visibility: string;
    description: string;
  } | null> {
    if (!await this.projectDetails.isVisible()) {
      return null;
    }

    return {
      name: await this.projectDetails.locator('h4, [class*="Typography-h4"]').textContent() || '',
      path: await this.projectDetails.locator('text=/full path/i').locator('..').textContent() || '',
      visibility: await this.projectDetails.locator('[class*="Chip"]').textContent() || '',
      description: await this.projectDetails.locator('[class*="description"]').textContent() || '',
    };
  }

  async getAllVisibleNodes(): Promise<Array<{ name: string; type: string }>> {
    const nodes = await this.treeView.locator('[role="treeitem"]').all();
    const visibleNodes = [];
    
    for (const node of nodes) {
      const name = await node.textContent() || '';
      const icon = await node.locator('[data-testid*="Icon"]').getAttribute('data-testid') || '';
      const type = icon.includes('Folder') ? 'group' : 'project';
      
      visibleNodes.push({ name: name.trim(), type });
    }
    
    return visibleNodes;
  }

  async testLazyLoading(): Promise<{
    initialCount: number;
    expandedCount: number;
    loadTime: number;
  }> {
    // Get initial node count
    const initialNodes = await this.getAllVisibleNodes();
    const initialCount = initialNodes.length;
    
    // Find a group node to expand
    const groupNode = initialNodes.find(n => n.type === 'group');
    if (!groupNode) {
      return { initialCount, expandedCount: initialCount, loadTime: 0 };
    }
    
    // Measure expansion time
    const startTime = Date.now();
    await this.expandTreeNode(groupNode.name);
    const loadTime = Date.now() - startTime;
    
    // Get new node count
    const expandedNodes = await this.getAllVisibleNodes();
    const expandedCount = expandedNodes.length;
    
    return { initialCount, expandedCount, loadTime };
  }

  async searchInTree(query: string) {
    const searchInput = this.page.locator('input[placeholder*="Search"], input[placeholder*="검색"]');
    await searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async getContextMenuActions(nodeName: string): Promise<string[]> {
    await this.selectTreeNode(nodeName);
    
    const moreButton = await this.page.locator('button[aria-label*="more"]');
    await moreButton.click();
    
    const menuItems = await this.page.locator('[role="menuitem"]').allTextContents();
    
    // Close menu
    await this.page.keyboard.press('Escape');
    
    return menuItems;
  }
}