import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class GroupManagementPage extends BasePage {
  readonly createGroupButton: Locator;
  readonly groupList: Locator;
  readonly searchInput: Locator;
  readonly createGroupDialog: Locator;
  readonly groupNameInput: Locator;
  readonly groupPathInput: Locator;
  readonly groupDescriptionInput: Locator;
  readonly visibilitySelect: Locator;
  readonly parentGroupSelect: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.createGroupButton = page.locator('button:has-text("Create Group")');
    this.groupList = page.locator('[role="list"], .group-list');
    this.searchInput = page.locator('input[placeholder*="Search"]');
    
    // Dialog elements
    this.createGroupDialog = page.locator('[role="dialog"]');
    this.groupNameInput = page.locator('input[name="name"]');
    this.groupPathInput = page.locator('input[name="path"]');
    this.groupDescriptionInput = page.locator('textarea[name="description"]');
    this.visibilitySelect = page.locator('select[name="visibility"], [name="visibility"]');
    this.parentGroupSelect = page.locator('[name="parent_id"]');
    this.submitButton = this.createGroupDialog.locator('button[type="submit"], button:has-text("Create")');
    this.cancelButton = this.createGroupDialog.locator('button:has-text("Cancel")');
  }

  async goto() {
    await this.navigate('/groups');
    await this.page.waitForLoadState('networkidle');
  }

  async createGroup(groupData: {
    name: string;
    path?: string;
    description?: string;
    visibility?: 'private' | 'internal' | 'public';
    parentId?: number;
  }) {
    await this.createGroupButton.click();
    await this.createGroupDialog.waitFor({ state: 'visible' });

    await this.groupNameInput.fill(groupData.name);
    
    if (groupData.path) {
      await this.groupPathInput.fill(groupData.path);
    }
    
    if (groupData.description) {
      await this.groupDescriptionInput.fill(groupData.description);
    }
    
    if (groupData.visibility) {
      await this.visibilitySelect.selectOption(groupData.visibility);
    }
    
    if (groupData.parentId) {
      await this.parentGroupSelect.selectOption(groupData.parentId.toString());
    }

    await this.submitButton.click();
    await this.waitForNotification('Group created successfully');
  }

  async getGroupByName(name: string): Promise<Locator | null> {
    const group = this.groupList.locator(`[role="listitem"]:has-text("${name}")`);
    if (await group.count() > 0) {
      return group.first();
    }
    return null;
  }

  async deleteGroup(name: string) {
    const group = await this.getGroupByName(name);
    if (!group) throw new Error(`Group ${name} not found`);
    
    // Open context menu
    await group.locator('button[aria-label*="more"], button:has([data-testid="MoreVertIcon"])').click();
    await this.page.locator('[role="menuitem"]:has-text("Delete")').click();
    
    // Confirm deletion
    await this.page.locator('button:has-text("Delete")').last().click();
    await this.waitForNotification('deleted successfully');
  }

  async dragAndDropGroup(sourceName: string, targetName: string) {
    const sourceGroup = await this.getGroupByName(sourceName);
    const targetGroup = await this.getGroupByName(targetName);
    
    if (!sourceGroup || !targetGroup) {
      throw new Error('Source or target group not found');
    }

    await sourceGroup.dragTo(targetGroup);
    await this.page.waitForTimeout(1000); // Wait for animation
  }

  async getAllGroups(): Promise<Array<{ name: string; path: string; visibility: string }>> {
    const groupItems = await this.groupList.locator('[role="listitem"]').all();
    const groups = [];
    
    for (const item of groupItems) {
      const name = await item.locator('[class*="MuiListItemText-primary"]').textContent() || '';
      const path = await item.locator('[class*="MuiListItemText-secondary"]').textContent() || '';
      const visibility = await item.locator('[class*="MuiChip-root"]').textContent() || '';
      
      groups.push({ name, path, visibility });
    }
    
    return groups;
  }

  async searchGroups(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
    await this.page.waitForLoadState('networkidle');
  }

  async createSubgroup(parentName: string, subgroupData: any) {
    const parentGroup = await this.getGroupByName(parentName);
    if (!parentGroup) throw new Error(`Parent group ${parentName} not found`);
    
    // Open context menu on parent
    await parentGroup.locator('button[aria-label*="more"]').click();
    await this.page.locator('[role="menuitem"]:has-text("Create Subgroup")').click();
    
    // Fill subgroup details
    await this.createGroupDialog.waitFor({ state: 'visible' });
    await this.groupNameInput.fill(subgroupData.name);
    if (subgroupData.path) await this.groupPathInput.fill(subgroupData.path);
    if (subgroupData.description) await this.groupDescriptionInput.fill(subgroupData.description);
    
    await this.submitButton.click();
    await this.waitForNotification('Subgroup created successfully');
  }

  async verifyGroupPermissions(userRole: string) {
    const permissions = {
      canCreate: await this.createGroupButton.isEnabled(),
      canDelete: false,
      canEdit: false,
      canTransfer: false,
    };

    // Check if any group has action buttons
    const firstGroup = await this.groupList.locator('[role="listitem"]').first();
    if (await firstGroup.count() > 0) {
      const moreButton = firstGroup.locator('button[aria-label*="more"]');
      if (await moreButton.isVisible()) {
        await moreButton.click();
        
        permissions.canDelete = await this.page.locator('[role="menuitem"]:has-text("Delete")').isVisible();
        permissions.canEdit = await this.page.locator('[role="menuitem"]:has-text("Edit")').isVisible();
        permissions.canTransfer = await this.page.locator('[role="menuitem"]:has-text("Transfer")').isVisible();
        
        // Close menu
        await this.page.keyboard.press('Escape');
      }
    }

    return permissions;
  }
}