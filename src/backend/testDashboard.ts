#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDashboard } from './dashboardServer.js';

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDashboard() {
  // Check for command line argument to determine which dashboard to show
  const showIndex = process.argv.includes('--index');
  
  if (showIndex) {
    await testTemplateIndex();
  } else {
    await testSingleTemplateDashboard();
  }
}

async function testSingleTemplateDashboard() {
  try {
    // Create a test report data file
    const templatePath = path.resolve(__dirname, '..', 'src', 'templates', 'dashboard.html');
    const testHtmlPath = path.resolve(__dirname, 'templates', 'dashboard-test.html');
    
    // Copy the dashboard template
    let dashboardTemplate = await fs.readFile(templatePath, 'utf8');
    
    // Add the test data script
    dashboardTemplate = dashboardTemplate.replace('</body>', `<script src="assets/sample-data.js"></script></body>`);
    
    // Write the test dashboard HTML file
    await fs.writeFile(testHtmlPath, dashboardTemplate);
    
    // Open the dashboard
    console.log(`🚀 Opening test dashboard for single template...`);
    const serverInfo = await openDashboard(testHtmlPath, 3000);
    console.log(`Dashboard available at: ${serverInfo.url}`);
    console.log(`\n👀 Press Ctrl+C to stop the server and exit`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

async function testTemplateIndex() {
  try {
    // Create a test index file
    const templatePath = path.resolve(__dirname, '..', 'src', 'templates', 'index-template.html');
    const testHtmlPath = path.resolve(__dirname, 'templates', 'index-test.html');
    
    // Copy the index template
    let indexTemplate = await fs.readFile(templatePath, 'utf8');
    
    // Add the sample template data script
    const sampleTemplatesData = `
      window.templatesData = [
        {
          "timestamp": "2024-07-21T14:30:00Z",
          "dashboardPath": "sample-template/dashboard.html",
          "dataPath": "sample-template/data.js",
          "repoUrl": "https://github.com/Azure-Samples/azd-templates",
          "compliance": {
            "percentage": 85,
            "issues": 3,
            "passed": 17
          },
          "relativePath": "sample-template/dashboard.html"
        },
        {
          "timestamp": "2024-07-20T10:15:00Z",
          "dashboardPath": "another-template/dashboard.html",
          "dataPath": "another-template/data.js",
          "repoUrl": "https://github.com/Azure-Samples/another-template",
          "compliance": {
            "percentage": 70,
            "issues": 5,
            "passed": 12
          },
          "relativePath": "another-template/dashboard.html"
        },
        {
          "timestamp": "2024-07-19T09:45:00Z",
          "dashboardPath": "third-template/dashboard.html",
          "dataPath": "third-template/data.js",
          "repoUrl": "https://github.com/Azure-Samples/third-template",
          "compliance": {
            "percentage": 95,
            "issues": 1,
            "passed": 19
          },
          "relativePath": "third-template/dashboard.html"
        }
      ];
    `;
    
    // Add the script tag for the sample data
    indexTemplate = indexTemplate.replace('</body>', `<script>${sampleTemplatesData}</script></body>`);
    
    // Write the test index file
    await fs.writeFile(testHtmlPath, indexTemplate);
    
    // Open the index
    console.log(`🚀 Opening test template index...`);
    const serverInfo = await openDashboard(testHtmlPath, 3000);
    console.log(`Template index available at: ${serverInfo.url}`);
    console.log(`\n👀 Press Ctrl+C to stop the server and exit`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testDashboard();
