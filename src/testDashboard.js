#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDashboard } from './dashboardServer.js';

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDashboard() {
  try {
    // Create a test report data file
    const testDataPath = path.resolve(__dirname, 'templates', 'assets', 'test-data.js');
    const testHtmlPath = path.resolve(__dirname, 'templates', 'dashboard-test.html');
    
    // Copy the dashboard template
    const templatePath = path.resolve(__dirname, 'templates', 'dashboard.html');
    let dashboardTemplate = await fs.readFile(templatePath, 'utf8');
    
    // Add the test data script
    dashboardTemplate = dashboardTemplate.replace('</body>', `<script src="assets/sample-data.js"></script></body>`);
    
    // Write the test dashboard HTML file
    await fs.writeFile(testHtmlPath, dashboardTemplate);
    
    // Open the dashboard
    console.log(`🚀 Opening test dashboard...`);
    const serverInfo = await openDashboard(testHtmlPath, 3000);
    console.log(`Dashboard available at: ${serverInfo.url}`);
    console.log(`\n👀 Press Ctrl+C to stop the server and exit`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testDashboard();
