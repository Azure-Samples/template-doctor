// GitHub Issue Handler - Functions for creating GitHub issues from compliance reports

/**
 * Create a GitHub issue for all compliance issues
 */
function createGitHubIssue() {
    // Make sure we have report data
    if (!window.reportData) {
        console.error('No report data available');
        alert('No compliance data available to create GitHub issue');
        return;
    }
    
    // Show a confirmation dialog
    if (!confirm('This will create GitHub issues for all compliance problems in the repository. Proceed?')) {
        return;
    }
    
    // Add today's date in square brackets for the issue title
    const today = new Date();
    const formattedDate = `[${today.toISOString().split('T')[0]}]`;
    
    // Create summary of issues for the GitHub issue body
    let issueBody = "# Template Doctor Analysis\n\n";
    issueBody += `Template: ${window.reportData.repoUrl}\n\n`;
    issueBody += `Analyzed on: ${new Date().toLocaleString()}\n\n`;
    issueBody += `## Summary\n\n`;
    issueBody += `- Compliance: ${window.reportData.compliance.compliant.find(item => item.category === 'meta')?.details?.percentageCompliant || 0}%\n`;
    issueBody += `- Issues Found: ${window.reportData.compliance.issues.length}\n`;
    issueBody += `- Passed Checks: ${window.reportData.compliance.compliant.filter(item => item.category !== 'meta').length}\n\n`;
    
    if (window.reportData.compliance.issues.length > 0) {
        issueBody += `## Issues to Fix\n\n`;
        window.reportData.compliance.issues.forEach((issue, index) => {
            issueBody += `${index + 1}. **${issue.message}**\n`;
            if (issue.error) {
                issueBody += `   - ${issue.error}\n`;
            }
            issueBody += `\n`;
        });
    }
    
    // Add unique ID to help identify this issue
    const uniqueId = `template-doctor-${Date.now()}`;
    issueBody += `\n---\n*This issue was created by Template Doctor, an automated compliance checking tool.*`;
    issueBody += `\n\n<!-- Issue Tracker ID: ${uniqueId} -->`;
    
    // Get the repository owner and name from the URL
    const repoUrl = window.reportData.repoUrl;
    let owner, repo;
    
    try {
        const urlParts = new URL(repoUrl).pathname.split('/');
        if (urlParts.length >= 3) {
            owner = urlParts[1];
            repo = urlParts[2];
        }
    } catch (e) {
        console.error('Failed to parse repository URL', e);
    }
    
    if (!owner || !repo) {
        alert('Could not determine repository owner and name from URL. Please check the repository URL.');
        return;
    }
    
    // Show the creating status
    const createIssueButton = document.getElementById('create-github-issue-btn');
    const originalText = createIssueButton.innerHTML;
    createIssueButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Issue...';
    createIssueButton.disabled = true;
    
    // We'll simulate the issue creation since we don't have the actual API endpoint
    // In a real implementation, you would make a fetch request to the GitHub API
    
    setTimeout(() => {
        try {
            // Simulate issue creation success
            const issueNumber = Math.floor(Math.random() * 100) + 1;
            const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
            
            alert(`GitHub issue #${issueNumber} created successfully! Since this is a frontend-only implementation, no actual issue was created on GitHub.`);
            
            // Log the issue details for reference
            console.log('Issue that would be created:', {
                title: `Template Doctor Analysis: ${window.reportData.compliance.summary} ${formattedDate}`,
                body: issueBody,
                labels: ['template-doctor-full-scan'],
                repo: `${owner}/${repo}`
            });
            
            // Restore button state
            createIssueButton.innerHTML = originalText;
            createIssueButton.disabled = false;
            
        } catch (error) {
            console.error('Error creating GitHub issue:', error);
            alert(`Error creating GitHub issue: ${error.message}`);
            
            // Restore button state
            createIssueButton.innerHTML = originalText;
            createIssueButton.disabled = false;
        }
    }, 1500);
}

/**
 * Test AZD provision for the template
 */
function testAzdProvision() {
    // Make sure we have report data
    if (!window.reportData) {
        console.error('No report data available');
        alert('No compliance data available to test AZD provision');
        return;
    }
    
    // Show a confirmation dialog
    if (!confirm('This would test AZD provisioning for the template. Since this is a frontend-only implementation, this will be simulated. Proceed?')) {
        return;
    }
    
    // Show loading state
    const testProvisionButton = document.getElementById('testProvisionButton');
    const originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting Test...';
    testProvisionButton.disabled = true;
    
    // Simulate the AZD provision test
    const runId = Math.random().toString(36).substring(2, 15);
    
    // Simulate a long-running process with status updates
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        testProvisionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Running (${progress}%)`;
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            
            // Simulate random success/failure
            const success = Math.random() > 0.3; // 70% chance of success
            
            if (success) {
                testProvisionButton.innerHTML = '<i class="fas fa-check"></i> Provision Completed';
                testProvisionButton.style.backgroundColor = '#107c10'; // Success green
                alert('AZD provision test completed successfully! (Simulated)');
            } else {
                testProvisionButton.innerHTML = '<i class="fas fa-times"></i> Provision Failed';
                testProvisionButton.style.backgroundColor = '#d83b01'; // Error color
                alert('AZD provision test failed. (Simulated)\n\nCommon issues:\n- Missing required resources\n- Invalid parameter values\n- Naming conflicts');
            }
            
            // Reset button after 5 seconds
            setTimeout(() => {
                testProvisionButton.innerHTML = originalText;
                testProvisionButton.style.backgroundColor = '#0078d4'; // Original color
                testProvisionButton.disabled = false;
            }, 5000);
        }
    }, 500);
}
