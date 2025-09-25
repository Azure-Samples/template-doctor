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

## Build System

The frontend uses a custom build system that optimizes the application for production deployment:

### Build Commands

- `npm run build` - Production build with minification and optimization
- `npm run build:dev` - Development build without minification (for debugging)
- `npm run clean` - Remove the dist folder

### Build Process

The build system:
1. **Minifies JavaScript**: All `.js` files are minified using Terser with:
   - Console statements removed in production
   - Function names preserved for easier debugging
   - Comments removed
2. **Minifies CSS**: All `.css` files are minified using CleanCSS
3. **Minifies HTML**: HTML files are minified with whitespace removal and optimization
4. **Copies Assets**: Static files (images, configs, results) are copied to the output directory
5. **Size Optimization**: Achieves ~59% size reduction compared to original source

### Build Output

- **Production build output**: `dist/` directory
- **Build reports**: Shows original size vs optimized size
- **File structure**: Maintains the same structure as the source files

### Development vs Production

- **Development mode**: Files are copied without minification for easier debugging
- **Production mode**: Full optimization with minification, console removal, and compression

## Development Notes

- The data is loaded asynchronously via the `templates-data-loader.js` script
- Templates are rendered in a responsive grid layout
- Ruleset configurations are loaded from the `configs/` directory
- Build artifacts are ignored in git via `.gitignore`

## CSS Styles

- Template cards use a consistent design language matching the rest of the UI
- Highlighting effect uses CSS animations for a subtle pulse effect
- Responsive design adapts to different screen sizes
- CSS is minified in production builds for better performance

## Deployment

This directory is designed to be deployed as a standalone static website optimized for production:

### Production Deployment

1. Run the build process:
```bash
npm run build
```

2. Deploy the `dist/` folder contents to your static hosting service

### Azure Static Web Apps

When deploying to Azure Static Web Apps:
- Set `outputLocation` to `dist` in your SWA configuration
- Set `appBuildCommand` to `npm run build`
- The build system will automatically create an optimized bundle

### Development Testing

For local development without build optimization:
```bash
npm run build:dev
npm run start
```
