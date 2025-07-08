import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class SvnMigrationPage extends BasePage {
  // Dialog elements
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly closeButton: Locator;
  
  // Step indicators
  readonly stepperRoot: Locator;
  readonly activeStep: Locator;
  
  // Connection form (Step 1)
  readonly svnUrlInput: Locator;
  readonly svnUsernameInput: Locator;
  readonly svnPasswordInput: Locator;
  readonly layoutRadioGroup: Locator;
  readonly standardLayoutRadio: Locator;
  readonly trunkLayoutRadio: Locator;
  readonly customLayoutRadio: Locator;
  readonly customTrunkInput: Locator;
  readonly customBranchesInput: Locator;
  readonly customTagsInput: Locator;
  readonly testConnectionButton: Locator;
  readonly connectionStatus: Locator;
  
  // User mapping (Step 2)
  readonly authorsTable: Locator;
  readonly authorsFileInput: Locator;
  readonly addMappingButton: Locator;
  readonly svnUserInputs: Locator;
  readonly gitNameInputs: Locator;
  readonly gitEmailInputs: Locator;
  
  // Preview (Step 3)
  readonly groupSelect: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly previewTable: Locator;
  readonly branchesPreview: Locator;
  readonly tagsPreview: Locator;
  
  // Progress (Step 4)
  readonly progressBar: Locator;
  readonly progressPercentage: Locator;
  readonly statusMessage: Locator;
  readonly logContainer: Locator;
  readonly logEntries: Locator;
  
  // Navigation buttons
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly startMigrationButton: Locator;
  readonly cancelButton: Locator;
  
  // Bulk migration
  readonly bulkModeSwitch: Locator;
  readonly bulkFileInput: Locator;
  readonly bulkPreviewTable: Locator;
  readonly startAllButton: Locator;
  
  // Incremental sync
  readonly incrementalModeSwitch: Locator;
  readonly existingProjectSelect: Locator;
  readonly syncButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Dialog
    this.dialog = page.locator('[role="dialog"]').filter({ hasText: 'SVN to GitLab' });
    this.dialogTitle = this.dialog.locator('h2');
    this.closeButton = this.dialog.locator('button[aria-label="close"]');
    
    // Stepper
    this.stepperRoot = this.dialog.locator('.MuiStepper-root');
    this.activeStep = this.stepperRoot.locator('.MuiStep-root.Mui-active');
    
    // Connection form
    this.svnUrlInput = this.dialog.locator('input[placeholder*="SVN 저장소 URL"]');
    this.svnUsernameInput = this.dialog.locator('input[placeholder*="SVN 사용자명"]');
    this.svnPasswordInput = this.dialog.locator('input[type="password"]');
    this.layoutRadioGroup = this.dialog.locator('[role="radiogroup"]');
    this.standardLayoutRadio = this.layoutRadioGroup.locator('input[value="standard"]');
    this.trunkLayoutRadio = this.layoutRadioGroup.locator('input[value="trunk"]');
    this.customLayoutRadio = this.layoutRadioGroup.locator('input[value="custom"]');
    this.customTrunkInput = this.dialog.locator('input[placeholder*="Trunk 경로"]');
    this.customBranchesInput = this.dialog.locator('input[placeholder*="Branches 경로"]');
    this.customTagsInput = this.dialog.locator('input[placeholder*="Tags 경로"]');
    this.testConnectionButton = this.dialog.locator('button:has-text("연결 테스트")');
    this.connectionStatus = this.dialog.locator('.connection-status');
    
    // User mapping
    this.authorsTable = this.dialog.locator('table').first();
    this.authorsFileInput = this.dialog.locator('input[type="file"][accept*=".txt"]');
    this.addMappingButton = this.dialog.locator('button:has-text("매핑 추가")');
    this.svnUserInputs = this.dialog.locator('input[placeholder*="SVN 사용자"]');
    this.gitNameInputs = this.dialog.locator('input[placeholder*="Git 이름"]');
    this.gitEmailInputs = this.dialog.locator('input[placeholder*="이메일"]');
    
    // Preview
    this.groupSelect = this.dialog.locator('[data-testid="group-select"]');
    this.projectNameInput = this.dialog.locator('input[placeholder*="GitLab 프로젝트 이름"]');
    this.projectDescriptionInput = this.dialog.locator('textarea[placeholder*="설명"]');
    this.previewTable = this.dialog.locator('.preview-table');
    this.branchesPreview = this.dialog.locator('.branches-list');
    this.tagsPreview = this.dialog.locator('.tags-list');
    
    // Progress
    this.progressBar = this.dialog.locator('[role="progressbar"]');
    this.progressPercentage = this.dialog.locator('.progress-percentage');
    this.statusMessage = this.dialog.locator('.status-message');
    this.logContainer = this.dialog.locator('.log-container');
    this.logEntries = this.logContainer.locator('.log-entry');
    
    // Navigation
    this.backButton = this.dialog.locator('button:has-text("이전")');
    this.nextButton = this.dialog.locator('button:has-text("다음")');
    this.startMigrationButton = this.dialog.locator('button:has-text("마이그레이션 시작")');
    this.cancelButton = this.dialog.locator('button:has-text("취소")');
    
    // Bulk mode
    this.bulkModeSwitch = this.dialog.locator('input[type="checkbox"][name="bulkMode"]');
    this.bulkFileInput = this.dialog.locator('input[type="file"][accept*=".yaml,.yml,.csv"]');
    this.bulkPreviewTable = this.dialog.locator('.bulk-preview-table');
    this.startAllButton = this.dialog.locator('button:has-text("모두 마이그레이션")');
    
    // Incremental
    this.incrementalModeSwitch = this.dialog.locator('input[type="checkbox"][name="incrementalMode"]');
    this.existingProjectSelect = this.dialog.locator('[data-testid="existing-project-select"]');
    this.syncButton = this.dialog.locator('button:has-text("동기화")');
  }

  async open(): Promise<void> {
    await this.page.locator('button:has-text("SVN to Git")').click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async fillConnectionForm(url: string, username?: string, password?: string): Promise<void> {
    await this.svnUrlInput.fill(url);
    if (username) {
      await this.svnUsernameInput.fill(username);
    }
    if (password) {
      await this.svnPasswordInput.fill(password);
    }
  }

  async selectLayout(layout: 'standard' | 'trunk' | 'custom'): Promise<void> {
    switch (layout) {
      case 'standard':
        await this.standardLayoutRadio.check();
        break;
      case 'trunk':
        await this.trunkLayoutRadio.check();
        break;
      case 'custom':
        await this.customLayoutRadio.check();
        break;
    }
  }

  async fillCustomLayout(trunk: string, branches: string, tags: string): Promise<void> {
    await this.customLayoutRadio.check();
    await this.customTrunkInput.fill(trunk);
    await this.customBranchesInput.fill(branches);
    await this.customTagsInput.fill(tags);
  }

  async testConnection(): Promise<boolean> {
    await this.testConnectionButton.click();
    
    // Wait for status update
    await this.page.waitForTimeout(1000);
    
    const statusText = await this.connectionStatus.textContent();
    return statusText?.includes('성공') || false;
  }

  async uploadAuthorsFile(filePath: string): Promise<void> {
    await this.authorsFileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(500); // Wait for file processing
  }

  async addUserMapping(svnUser: string, gitName: string, gitEmail: string): Promise<void> {
    await this.addMappingButton.click();
    
    const lastSvnInput = this.svnUserInputs.last();
    const lastNameInput = this.gitNameInputs.last();
    const lastEmailInput = this.gitEmailInputs.last();
    
    await lastSvnInput.fill(svnUser);
    await lastNameInput.fill(gitName);
    await lastEmailInput.fill(gitEmail);
  }

  async selectTargetGroup(groupName: string): Promise<void> {
    await this.groupSelect.click();
    await this.page.locator(`text="${groupName}"`).first().click();
  }

  async fillProjectDetails(name: string, description?: string): Promise<void> {
    await this.projectNameInput.fill(name);
    if (description) {
      await this.projectDescriptionInput.fill(description);
    }
  }

  async goToNextStep(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async goToPreviousStep(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async startMigration(): Promise<void> {
    await this.startMigrationButton.click();
  }

  async waitForCompletion(timeout: number = 60000): Promise<void> {
    await this.progressBar.waitFor({ state: 'visible' });
    
    // Wait for 100% or completion message
    await this.page.waitForFunction(
      () => {
        const progress = document.querySelector('.progress-percentage');
        const status = document.querySelector('.status-message');
        return (
          progress?.textContent?.includes('100%') ||
          status?.textContent?.includes('완료')
        );
      },
      { timeout }
    );
  }

  async getProgressPercentage(): Promise<number> {
    const text = await this.progressPercentage.textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  async getLogMessages(): Promise<string[]> {
    const entries = await this.logEntries.allTextContents();
    return entries;
  }

  async enableBulkMode(): Promise<void> {
    await this.bulkModeSwitch.check();
  }

  async uploadBulkFile(filePath: string): Promise<void> {
    await this.bulkFileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000); // Wait for file processing
  }

  async getBulkProjectCount(): Promise<number> {
    const rows = await this.bulkPreviewTable.locator('tbody tr').count();
    return rows;
  }

  async startBulkMigration(): Promise<void> {
    await this.startAllButton.click();
  }

  async enableIncrementalMode(): Promise<void> {
    await this.incrementalModeSwitch.check();
  }

  async selectExistingProject(projectName: string): Promise<void> {
    await this.existingProjectSelect.click();
    await this.page.locator(`text="${projectName}"`).click();
  }

  async startSync(): Promise<void> {
    await this.syncButton.click();
  }

  async getCurrentStep(): Promise<number> {
    const steps = await this.stepperRoot.locator('.MuiStep-root').count();
    for (let i = 0; i < steps; i++) {
      const step = this.stepperRoot.locator('.MuiStep-root').nth(i);
      const isActive = await step.evaluate(el => el.classList.contains('Mui-active'));
      if (isActive) {
        return i + 1;
      }
    }
    return 1;
  }

  async isNextButtonEnabled(): Promise<boolean> {
    return await this.nextButton.isEnabled();
  }

  async isStartMigrationButtonVisible(): Promise<boolean> {
    return await this.startMigrationButton.isVisible();
  }
}