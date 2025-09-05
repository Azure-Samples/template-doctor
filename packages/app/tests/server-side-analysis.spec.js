// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Mock authentication state
 */
async function mockAuthentication(page) {
  await page.evaluate(() => {
    // Create mock user info
    const mockUserInfo = {
      login: 'test-user',
      name: 'Test User',
      avatarUrl: 'https://avatars.githubusercontent.com/u/0',
    };

    // Mock localStorage values
    localStorage.setItem('gh_access_token', 'mock_access_token');
    localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

    // Create mock auth object
    window.GitHubAuth = {
      accessToken: 'mock_access_token',
      userInfo: mockUserInfo,
      isAuthenticated: () => true,
      getAccessToken: () => 'mock_access_token',
      getUserInfo: () => mockUserInfo,
      checkAuthentication: () => true,
      updateUI: () => {
        // Show search section
        const searchSection = document.getElementById('search-section');
        if (searchSection) searchSection.style.display = 'block';
      },
    };
    
    // Call updateUI to make search visible
    window.GitHubAuth.updateUI();
  });
}

/**
 * Mock GitHub client
 */
async function mockGitHubClient(page) {
  await page.evaluate(() => {
    // Mock GitHub client
    window.GitHubClient = {
      auth: window.GitHubAuth,
      searchRepositories: async (query) => {
        return {
          items: [
            {
              full_name: 'test-owner/test-repo',
              html_url: 'https://github.com/test-owner/test-repo',
              description: 'Test repository',
              owner: { login: 'test-owner' }
            }
          ]
        };
      },
      getDefaultBranch: async () => 'main',
      listAllFiles: async () => ['README.md', 'infra/main.bicep', 'azure.yaml', '.github/workflows/azure-dev.yml'],
      getFileContent: async (owner, repo, path) => {
        if (path === 'README.md') {
          return '# Test Repository\n\n## Getting Started\n\n## Prerequisites\n\n## Architecture\n\n![Architecture](./docs/architecture.png)';
        }
        return 'file content';
      }
    };
    
    // Create event to notify that GitHub client is ready
    document.dispatchEvent(new CustomEvent('github-auth-changed'));
  });
}

/**
 * Mock TemplateAnalyzer with server-side and client-side capabilities
 */
async function mockTemplateAnalyzer(page, { serverSideEnabled = true, serverSideFails = false }) {
  await page.evaluate(({ serverSideEnabled, serverSideFails }) => {
    // Basic analyzer response
    const successResponse = {
      repoUrl: 'https://github.com/test-owner/test-repo',
      ruleSet: 'dod',
      timestamp: new Date().toISOString(),
      compliance: {
        issues: [
          { 
            id: 'test-issue', 
            severity: 'error', 
            message: 'Test issue',
            error: 'Test error' 
          }
        ],
        compliant: [
          { 
            id: 'test-compliance', 
            category: 'requiredFile', 
            message: 'Required file found: README.md',
            details: { fileName: 'README.md' } 
          }
        ],
        summary: 'Issues found - Compliance: 50%'
      }
    };
    
    // Mock analyzer with tracking for which method was called
    window.TemplateAnalyzer = {
      // Store which method was called
      lastMethodCalled: null,
      
      // Setup ruleSetConfigs as expected by the analyzer
      ruleSetConfigs: {
        dod: {},
        partner: {},
        docs: [],
        custom: {}
      },
      
      // Mock the loadRuleSetConfigs method
      loadRuleSetConfigs: async () => {},
      
      // Mock getConfig method
      getConfig: (ruleSet = 'dod') => {
        return {
          requiredFiles: ['README.md', 'azure.yaml', 'LICENSE'],
          requiredFolders: ['infra', '.github'],
          requiredWorkflowFiles: [
            {
              pattern: /\.github\/workflows\/azure-dev\.yml/i,
              message: 'Missing required GitHub workflow: azure-dev.yml',
            },
          ],
          readmeRequirements: {
            requiredHeadings: ['Prerequisites', 'Getting Started'],
            architectureDiagram: {
              heading: 'Architecture',
              requiresImage: true,
            },
          },
          bicepChecks: {
            requiredResources: []
          }
        };
      },
      
      // Mock extractRepoInfo method
      extractRepoInfo: (url) => {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/);
        if (!match) throw new Error('Invalid GitHub URL');
        return {
          owner: match[1],
          repo: match[2],
          fullName: `${match[1]}/${match[2]}`,
        };
      },
      
      // Main analyze method - delegates to server or client-side based on config
      analyzeTemplate: async function(repoUrl, ruleSet = 'dod') {
        // Track calls to this method
        this.lastMethodCalled = 'analyzeTemplate';
        
        // Check if server-side analysis is preferred
        if (serverSideEnabled) {
          try {
            return await this.analyzeTemplateServerSide(repoUrl, ruleSet);
          } catch (error) {
            if (serverSideFails) {
              // If we're testing fallback behavior, throw an error for server-side
              console.error('Server-side analysis failed, falling back to client-side', error);
              // If fallback is enabled in config, use client-side
              if (window.TemplateDoctorConfig?.analysis?.fallbackToClientSide) {
                return await this.analyzeTemplateClientSide(repoUrl, ruleSet);
              }
              // Otherwise propagate the error
              throw error;
            }
          }
        }
        
        // Default to client-side
        return await this.analyzeTemplateClientSide(repoUrl, ruleSet);
      },
      
      // Server-side analysis implementation
      analyzeTemplateServerSide: async function(repoUrl, ruleSet) {
        this.lastMethodCalled = 'analyzeTemplateServerSide';
        
        if (serverSideFails) {
          throw new Error('Server-side analysis failed');
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Return success response with a marker that it came from server-side
        return {
          ...successResponse,
          analyzerSource: 'server-side'
        };
      },
      
      // Client-side analysis implementation
      analyzeTemplateClientSide: async function(repoUrl, ruleSet) {
        this.lastMethodCalled = 'analyzeTemplateClientSide';
        
        // Simulate client-side analysis delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Return success response with a marker that it came from client-side
        return {
          ...successResponse,
          analyzerSource: 'client-side'
        };
      },
      
      // For backwards compatibility and testing
      debug: (tag, message, data) => {
        console.log(`[${tag}] ${message}`, data || '');
      }
    };
    
    // Mock the behavior of the actual implementation where analyzeTemplateClientSide is an alias
    window.TemplateAnalyzer.analyzeTemplateClientSide = async function(repoUrl, ruleSet) {
      this.lastMethodCalled = 'analyzeTemplateClientSide';
      
      // In the real implementation, client-side logic is in analyzeTemplate
      // We'll simulate that here with a simplified version
      
      const repoInfo = this.extractRepoInfo(repoUrl);
      const config = this.getConfig(ruleSet);
      
      // Simulate a simple analysis
      const issues = [];
      const compliant = [];
      
      // Simplified checks
      compliant.push({
        id: 'file-README.md',
        category: 'requiredFile',
        message: 'Required file found: README.md',
        details: { fileName: 'README.md' }
      });
      
      // Add a made-up issue
      issues.push({
        id: 'missing-LICENSE',
        severity: 'error',
        message: 'Missing required file: LICENSE',
        error: 'File LICENSE not found in repository'
      });
      
      // Calculate compliance
      const totalChecks = issues.length + compliant.length;
      const percentageCompliant = Math.round((compliant.length / totalChecks) * 100);
      
      // Return the analysis result
      return {
        repoUrl,
        ruleSet,
        timestamp: new Date().toISOString(),
        compliance: {
          issues,
          compliant,
          summary: `Issues found - Compliance: ${percentageCompliant}%`,
          percentage: percentageCompliant
        },
        analyzerSource: 'client-side'
      };
    };
    
    // Set up window.checkAnalyzerReady
    window.checkAnalyzerReady = function() {
      return true;
    };
    
    // Dispatch an event that analyzer is ready
    document.dispatchEvent(new CustomEvent('template-analyzer-ready'));
  }, { serverSideEnabled, serverSideFails });
}

/**
 * Mock dashboard renderer
 */
async function mockDashboardRenderer(page) {
  await page.evaluate(() => {
    window.DashboardRenderer = {
      render: (data, container) => {
        // Store the data for testing
        window.lastRenderedData = data;
        
        // Add simple rendering
        container.innerHTML = `
          <div class="dashboard-container">
            <h2>Analysis Results</h2>
            <div class="analysis-source">Source: ${data.analyzerSource || 'unknown'}</div>
            <div class="compliance-stats">
              <div>Issues: ${data.compliance.issues.length}</div>
              <div>Passed: ${data.compliance.compliant.length}</div>
            </div>
          </div>
        `;
      }
    };
  });
}

/**
 * Test suite for server-side analysis functionality
 */
test.describe('Server-side analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Mock authentication
    await mockAuthentication(page);
    
    // Mock GitHub client
    await mockGitHubClient(page);
    
    // Mock dashboard renderer
    await mockDashboardRenderer(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up any globals we set so other test files are not affected
    await page.evaluate(() => {
      try {
        delete window.TemplateDoctorConfig;
        delete window.lastRenderedData;
        if (window.TemplateAnalyzer) {
          delete window.TemplateAnalyzer.lastMethodCalled;
        }
      } catch (e) {
        console.warn('Cleanup error (ignored):', e);
      }
    });
  });
  
  test('should work when enabled', async ({ page }) => {
    // Setup the config to use server-side analysis
    await page.evaluate(() => {
      window.TemplateDoctorConfig = {
        preferServerSideAnalysis: true,
        apiBase: 'http://localhost:8080'
      };
    });
    
    // Setup the analyzer with server-side enabled and working
    await mockTemplateAnalyzer(page, { serverSideEnabled: true, serverSideFails: false });
      // Reinitialize services so the app uses the mocked analyzer
      await page.evaluate(() => {
        if (typeof window.tryReinitializeServices === 'function') {
          window.tryReinitializeServices();
        }
      });
    
    // Trigger an analysis
    await page.evaluate(() => {
      window.analyzeRepo('https://github.com/test-owner/test-repo', 'dod');
    });
    
    // Wait for the analysis to complete
    await page.waitForSelector('.dashboard-container');
    
    // Check that the server-side method was called
    const lastMethodCalled = await page.evaluate(() => window.TemplateAnalyzer.lastMethodCalled);
    expect(lastMethodCalled).toBe('analyzeTemplateServerSide');
    
    // Check that the rendered data came from server-side
    const analyzerSource = await page.evaluate(() => window.lastRenderedData.analyzerSource);
    expect(analyzerSource).toBe('server-side');
    
    // Verify the source is displayed correctly
    const sourceText = await page.textContent('.analysis-source');
    expect(sourceText).toContain('server-side');
  });
  
  test('should fall back when failed', async ({ page }) => {
    // Setup the config to use server-side analysis with fallback enabled
    await page.evaluate(() => {
      window.TemplateDoctorConfig = {
        preferServerSideAnalysis: true,
        apiBase: 'http://localhost:8080',
        analysis: {
          fallbackToClientSide: true
        }
      };
    });
    
    // Setup the analyzer with server-side that fails
    await mockTemplateAnalyzer(page, { serverSideEnabled: true, serverSideFails: true });
      // Reinitialize services so the app uses the mocked analyzer
      await page.evaluate(() => {
        if (typeof window.tryReinitializeServices === 'function') {
          window.tryReinitializeServices();
        }
      });
    
    // Trigger an analysis
    await page.evaluate(() => {
      window.analyzeRepo('https://github.com/test-owner/test-repo', 'dod');
    });
    
    // Wait for the analysis to complete
    await page.waitForSelector('.dashboard-container');
    
    // Check that client-side was used as fallback
    const analyzerSource = await page.evaluate(() => window.lastRenderedData.analyzerSource);
    expect(analyzerSource).toBe('client-side');
    
    // Verify the source is displayed correctly
    const sourceText = await page.textContent('.analysis-source');
    expect(sourceText).toContain('client-side');
  });
  
  test('should use client-side when disabled', async ({ page }) => {
    // Setup the config to NOT use server-side analysis
    await page.evaluate(() => {
      window.TemplateDoctorConfig = {
        preferServerSideAnalysis: false
      };
    });
    
    // Setup the analyzer with server-side enabled (but it shouldn't be called)
    await mockTemplateAnalyzer(page, { serverSideEnabled: false });
      // Reinitialize services so the app uses the mocked analyzer
      await page.evaluate(() => {
        if (typeof window.tryReinitializeServices === 'function') {
          window.tryReinitializeServices();
        }
      });
    
    // Trigger an analysis
    await page.evaluate(() => {
      window.analyzeRepo('https://github.com/test-owner/test-repo', 'dod');
    });
    
    // Wait for the analysis to complete
    await page.waitForSelector('.dashboard-container');
    
    // Check that the client-side method was called directly
    const lastMethodCalled = await page.evaluate(() => window.TemplateAnalyzer.lastMethodCalled);
    expect(['analyzeTemplate', 'analyzeTemplateClientSide']).toContain(lastMethodCalled);
    
    // Check that the rendered data came from client-side
    const analyzerSource = await page.evaluate(() => window.lastRenderedData.analyzerSource);
    expect(analyzerSource).toBe('client-side');
    
    // Verify the source is displayed correctly
    const sourceText = await page.textContent('.analysis-source');
    expect(sourceText).toContain('client-side');
  });
});
