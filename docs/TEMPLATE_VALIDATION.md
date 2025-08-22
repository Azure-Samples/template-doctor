# Template Validation Integration Guide

This guide explains how to integrate the Template Validation feature into the Template Doctor dashboard.

## Overview

The Template Validation feature triggers a GitHub Action in the [microsoft/template-validation-action](https://github.com/microsoft/template-validation-action) repository to validate Azure Developer CLI (azd) templates against best practices and requirements.

## Backend Setup

1. Two new Azure Functions have been created in the `packages/functions-aca` directory:
   - `template-validation`: Triggers the GitHub workflow
   - `template-validation-status`: Checks the status and results of the validation

2. Required Environment Variables:
   - Add `GITHUB_TOKEN` to your Function App settings (a GitHub PAT with `repo` and `workflow` permissions)

3. Deploy the Azure Functions:
   ```bash
   # From the repository root
   npm run -w packages/functions-aca start   # Test locally
   # OR
   ./scripts/deploy-functions-aca.sh         # Deploy to Azure
   ```

## Frontend Integration

1. Include the template validation JavaScript in your HTML:

   ```html
   <script src="js/template-validation.js"></script>
   ```

2. Add the integration point in your dashboard HTML (in the report page):

   ```html
   <!-- Add this where you want the validation UI to appear -->
   <div id="templateValidationContainer"></div>
   
   <script>
     // Initialize after the page and report data are loaded
     document.addEventListener('DOMContentLoaded', () => {
       // Make sure reportData is available
       if (window.reportData && window.reportData.repoUrl) {
         // Extract owner/repo from the URL
         let templateName;
         try {
           const url = new URL(window.reportData.repoUrl);
           const parts = url.pathname.split('/');
           if (parts.length >= 3) {
             templateName = `${parts[1]}/${parts[2]}`;
           }
         } catch (error) {
           console.error('Error parsing repository URL:', error);
         }
         
         if (templateName) {
           // Initialize the validation UI
           window.TemplateValidation.init(
             'templateValidationContainer', 
             templateName, 
             window.TemplateDoctorConfig?.apiBase || window.location.origin
           );
         }
       }
     });
   </script>
   ```

3. Update your frontend configuration to ensure API calls go to the correct backend:
   - Ensure `window.TemplateDoctorConfig.apiBase` points to your Functions App URL
   - The default is your Azure Functions URL from `packages/app/config.json`

## How It Works

1. User clicks "Run Validation" on the dashboard
2. Frontend calls `POST /api/template-validation` with the template name
3. Backend function triggers the workflow in microsoft/template-validation-action repo
4. Frontend polls `GET /api/template-validation-status?id={correlationId}` for results
5. Results are displayed in the UI when validation completes

## Testing

To test the integration:

1. Start the Functions app locally:
   ```bash
   npm run -w packages/functions-aca start
   ```

2. Start the frontend locally:
   ```bash
   npm run -w packages/app start
   ```

3. Navigate to a template report page and look for the validation section
4. Click "Run Validation" and observe the workflow being triggered

## Notes

- The GitHub workflow may take several minutes to complete
- Ensure your GITHUB_TOKEN has sufficient permissions and isn't expired
- For production, consider implementing persistent storage for validation results
