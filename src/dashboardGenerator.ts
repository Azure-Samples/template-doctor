import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Generates an HTML dashboard from the analysis results
 * @param analysisResults - The analysis results JSON object
 * @param outputPath - The directory where the dashboard should be saved
 * @returns Path to the generated dashboard HTML file
 */
export async function generateDashboard(analysisResults: any, outputPath: string): Promise<string> {
  try {
    // Get the directory name using import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Read the dashboard template
    const templatePath = path.resolve(__dirname, 'templates', 'dashboard.html');
    let dashboardTemplate = await fs.readFile(templatePath, 'utf8');

    // Convert the analysis results to a JavaScript object string and replace the placeholder
    const jsonData = JSON.stringify(analysisResults);
    dashboardTemplate = dashboardTemplate.replace('{{REPORT_DATA}}', jsonData);

    // Create the dashboard HTML file
    const dashboardFilename = path.basename(outputPath, '.json') + '-dashboard.html';
    const dashboardPath = path.join(path.dirname(outputPath), dashboardFilename);
    await fs.writeFile(dashboardPath, dashboardTemplate);

    return dashboardPath;
  } catch (err) {
    console.error('Error generating dashboard:', err);
    throw err;
  }
}
