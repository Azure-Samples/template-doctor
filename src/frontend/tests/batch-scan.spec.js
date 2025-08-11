// @ts-nocheck
import { test, expect } from '@playwright/test';

// Helper to mock auth, core services, and ensure app picks up the analyzer
async function mockAuthAndDeps(page) {
	await page.evaluate(() => {
		const mockUserInfo = {
			login: 'test-user',
			name: 'Test User',
			avatarUrl: 'https://avatars.githubusercontent.com/u/0'
		};

		localStorage.setItem('gh_access_token', 'mock_access_token');
		localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

		// Show the search UI and hide welcome
		const searchSection = document.getElementById('search-section');
		const welcomeSection = document.getElementById('welcome-section');
		if (searchSection) searchSection.style.display = 'block';
		if (welcomeSection) welcomeSection.style.display = 'none';

		// Minimal GitHub client/auth used by app.js
		window.GitHubClient = {
			auth: {
				isAuthenticated: () => true,
				getUsername: () => 'test-user',
				getToken: () => 'mock_access_token'
			}
		};

		// Prevent PR submissions
		window.submitAnalysisToGitHub = undefined;

		// Default analyzer stub and counters
		window.__analyzeCounts = {};
		window.TemplateAnalyzer = {
			analyzeTemplate: async (url, ruleSet) => {
				window.__analyzeCounts[url] = (window.__analyzeCounts[url] || 0) + 1;
				return {
					repoUrl: url,
					ruleSet,
					timestamp: new Date().toISOString(),
					compliance: {
						issues: [],
						compliant: [{ id: 'rule-1' }, { id: 'rule-2' }]
					}
				};
			}
		};

		// Minimal dashboard renderer
		window.DashboardRenderer = { render: () => {} };

		// Notify app to (re)bind services
		document.dispatchEvent(new Event('template-analyzer-ready'));
	});
}

function buildFakeResult(repoUrl, issues = 2, passed = 5) {
	return {
		repoUrl,
		ruleSet: 'dod',
		timestamp: new Date().toISOString(),
		compliance: {
			issues: Array.from({ length: issues }, (_, i) => ({ id: `i-${i}` })),
			compliant: Array.from({ length: passed }, (_, i) => ({ id: `p-${i}` }))
		}
	};
}

test.describe('Batch Scan', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await mockAuthAndDeps(page);
		await page.waitForSelector('#scan-mode-toggle');
		await page.waitForSelector('#batch-urls');
		await page.waitForSelector('#batch-scan-button');
	});

	test('toggles to batch mode and shows inputs', async ({ page }) => {
		await page.check('#scan-mode-toggle');
		await expect(page.locator('#batch-urls-container')).toHaveClass(/active/);
		await expect(page.locator('#single-scan-container')).toBeHidden();
	});

	test('processes multiple URLs and updates progress', async ({ page }) => {
		await page.check('#scan-mode-toggle');
		const urls = [
			'https://github.com/owner1/repo-one',
			'https://github.com/owner2/repo-two'
		].join('\n');
		await page.fill('#batch-urls', urls);
		await page.click('#batch-scan-button');

		await expect(page.locator('#batch-results')).toHaveClass(/active/);
		await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
		await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(2);
		await expect(page.locator('#batch-progress-text')).toHaveText(/2\s*\/\s*2\s*Completed/);
		const viewBtns = page.locator('#batch-items .batch-item .view-btn');
		await expect(viewBtns).toHaveCount(2);
		const btnCount = await viewBtns.count();
		for (let i = 0; i < btnCount; i++) {
			await expect(viewBtns.nth(i)).toBeEnabled();
		}
	});

	test('handles error then retry success for a URL', async ({ page }) => {
		await page.check('#scan-mode-toggle');

		// Override analyzer to be flaky for a specific URL
		await page.evaluate(() => {
			const original = window.TemplateAnalyzer.analyzeTemplate;
			window.__retryKey = 'https://github.com/owner-error/fail-repo';
			window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
				if (url === window.__retryKey) {
					const count = (window.__analyzeCounts[url] || 0) + 1;
					window.__analyzeCounts[url] = count;
					if (count === 1) throw new Error('Simulated analysis failure');
				}
				return original(url, ruleSet);
			};
			document.dispatchEvent(new Event('template-analyzer-ready'));
		});

		await page.fill(
			'#batch-urls',
			'https://github.com/owner-error/fail-repo\nhttps://github.com/owner-ok/success-repo'
		);
		await page.click('#batch-scan-button');

		// One should error, one should succeed
		await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
		await expect(page.locator('#batch-items .batch-item.error')).toHaveCount(1);
		await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(1);

		// Retry errored item
		const retryBtn = page.locator('#batch-items .batch-item.error .retry-btn');
		await expect(retryBtn).toBeEnabled();
		await retryBtn.click();

		// After retry, both success and progress updated
		await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(2);
		await expect(page.locator('#batch-progress-text')).toHaveText(/2\s*\/\s*2\s*Completed/);
	});
});

