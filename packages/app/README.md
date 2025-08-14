# Template Doctor Frontend

This is the frontend part of the Template Doctor application, designed to analyze Azure Developer CLI (AZD) templates for compliance with the official Definition of Done.

## Configuration Rulesets

The application uses three types of rulesets:

1. **DoD (Default)** - The full Definition of Done ruleset with all requirements
2. **Partner** - A simplified ruleset for partner templates
3. **Custom** - User-defined ruleset that can be uploaded via JSON or loaded from a GitHub Gist

### Custom Configuration

Users can define their own custom ruleset by:

- Pasting a JSON configuration
- Loading configuration from a GitHub Gist URL

Custom ruleset configurations are stored in the browser's localStorage.

## Previously Scanned Templates Feature

This feature enhances the Template Doctor by showing previously scanned templates.

### How It Works

1. **Template Data Loading:**
   - The web app loads template scan results from `results/index-data.js`
   - Templates are displayed in a grid below the search section

2. **Integration with Search:**
   - When searching for repositories, previously scanned templates are highlighted
   - Users can view the existing report or rescan the template

3. **Smooth Scroll & Highlight:**
   - Clicking "View Report" on a search result will scroll to and highlight the corresponding template card

## Folder Structure

- `css/` - Contains all CSS styles for the application
- `js/` - Contains JavaScript files
- `configs/` - Contains JSON configuration files for different rulesets
  - `dod-config.json` - Default Definition of Done ruleset
  - `partner-config.json` - Partner ruleset
  - `custom-config.json` - Base template for custom rulesets
- `assets/` - Contains images and other static assets
- `results/` - Contains previously scanned template results

## Development Notes

- The data is loaded asynchronously via the `templates-data-loader.js` script
- Templates are rendered in a responsive grid layout
- Ruleset configurations are loaded from the `configs/` directory

## CSS Styles

- Template cards use a consistent design language matching the rest of the UI
- Highlighting effect uses CSS animations for a subtle pulse effect
- Responsive design adapts to different screen sizes

## Deployment

This directory is designed to be deployed as a standalone static website. All necessary configurations are included within the directory.

Before deploying to GitHub Pages, run:

```bash
./scripts/copy-results-data.sh
```

This will copy the necessary template data to the frontend folder.
