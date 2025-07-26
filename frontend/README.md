# Template Doctor - Previously Scanned Templates Feature

This feature enhances the Template Doctor by showing previously scanned templates in the GitHub Pages version.

## How It Works

1. **Template Data Loading:**
   - The web app loads template scan results from `results/index-data.js`
   - Templates are displayed in a grid below the search section

2. **Integration with Search:**
   - When searching for repositories, previously scanned templates are highlighted
   - Users can view the existing report or rescan the template

3. **Smooth Scroll & Highlight:**
   - Clicking "View Report" on a search result will scroll to and highlight the corresponding template card

## Development Notes

- The data is loaded asynchronously via the `templates-data-loader.js` script
- Templates are rendered in a responsive grid layout
- For GitHub Pages deployment, run `scripts/copy-results-data.sh` to copy template data to the correct location

## CSS Styles

- Template cards use a consistent design language matching the rest of the UI
- Highlighting effect uses CSS animations for a subtle pulse effect
- Responsive design adapts to different screen sizes

## Deployment

Before deploying to GitHub Pages, run:

```bash
./scripts/copy-results-data.sh
```

This will copy the necessary template data to the frontend folder.
