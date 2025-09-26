#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: htmlMinify } = require('html-minifier-terser');

const isProduction = process.env.MODE !== 'development';

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

console.log(`Building Template Doctor frontend (${isProduction ? 'production' : 'development'} mode)...`);

// Copy and minify JavaScript files
async function processJsFiles() {
  const jsDir = path.join(__dirname, 'js');
  const distJsDir = path.join(distDir, 'js');
  fs.mkdirSync(distJsDir, { recursive: true });

  const jsFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));

  for (const file of jsFiles) {
    const srcPath = path.join(jsDir, file);
    const distPath = path.join(distJsDir, file);
    
    const code = fs.readFileSync(srcPath, 'utf-8');
    
    if (isProduction) {
      try {
        const result = await minify(code, {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          mangle: isProduction, // Enable mangling in production for better minification
          format: {
            comments: false,
          },
        });
        fs.writeFileSync(distPath, result.code);
        console.log(`Minified: ${file}`);
      } catch (error) {
        console.warn(`Failed to minify ${file}, copying as-is:`, error.message);
        fs.writeFileSync(distPath, code);
      }
    } else {
      fs.writeFileSync(distPath, code);
      console.log(`Copied: ${file}`);
    }
  }

  // Handle subdirectories in js/
  const jsSubdirs = fs.readdirSync(jsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const subdir of jsSubdirs) {
    const srcSubdir = path.join(jsDir, subdir);
    const distSubdir = path.join(distJsDir, subdir);
    
    // Copy subdirectory recursively
    copyRecursive(srcSubdir, distSubdir);
  }
}

// Copy and minify CSS files
async function processCssFiles() {
  const cssDir = path.join(__dirname, 'css');
  const distCssDir = path.join(distDir, 'css');
  
  if (fs.existsSync(cssDir)) {
    fs.mkdirSync(distCssDir, { recursive: true });
    
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    const cleanCSS = new CleanCSS({ 
      level: isProduction ? 2 : 0,
      returnPromise: true 
    });

    for (const file of cssFiles) {
      const srcPath = path.join(cssDir, file);
      const distPath = path.join(distCssDir, file);
      
      const css = fs.readFileSync(srcPath, 'utf-8');
      
      if (isProduction) {
        try {
          const result = await cleanCSS.minify(css);
          fs.writeFileSync(distPath, result.styles);
          console.log(`Minified CSS: ${file}`);
        } catch (error) {
          console.warn(`Failed to minify CSS ${file}, copying as-is:`, error.message);
          fs.writeFileSync(distPath, css);
        }
      } else {
        fs.writeFileSync(distPath, css);
        console.log(`Copied CSS: ${file}`);
      }
    }
  }
}

// Process HTML files
async function processHtmlFiles() {
  const htmlFiles = ['index.html', 'callback.html'];
  
  for (const file of htmlFiles) {
    const srcPath = path.join(__dirname, file);
    const distPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
      const html = fs.readFileSync(srcPath, 'utf-8');
      
      if (isProduction) {
        try {
          const minified = await htmlMinify(html, {
            removeComments: true,
            collapseWhitespace: true,
            removeRedundantAttributes: true,
            useShortDoctype: true,
            removeEmptyAttributes: true,
            removeStyleLinkTypeAttributes: true,
            keepClosingSlash: true,
            minifyJS: true,
            minifyCSS: true,
            minifyURLs: true,
          });
          fs.writeFileSync(distPath, minified);
          console.log(`Minified HTML: ${file}`);
        } catch (error) {
          console.warn(`Failed to minify HTML ${file}, copying as-is:`, error.message);
          fs.writeFileSync(distPath, html);
        }
      } else {
        fs.writeFileSync(distPath, html);
        console.log(`Copied HTML: ${file}`);
      }
    }
  }
}

// Copy other directories and files
function copyOtherAssets() {
  const directoriesToCopy = ['assets', 'configs', 'results'];
  const filesToCopy = ['robots.txt', '*.json', '*.md', '*.txt'];

  // Copy directories
  directoriesToCopy.forEach(dir => {
    const srcDir = path.join(__dirname, dir);
    const distDirPath = path.join(distDir, dir);
    
    if (fs.existsSync(srcDir)) {
      copyRecursive(srcDir, distDirPath);
      console.log(`Copied directory: ${dir}`);
    }
  });

  // Copy individual files by pattern
  const allFiles = fs.readdirSync(__dirname);
  
  filesToCopy.forEach(pattern => {
    if (pattern.includes('*')) {
      const ext = pattern.replace('*', '');
      const matchingFiles = allFiles.filter(file => file.endsWith(ext));
      
      matchingFiles.forEach(file => {
        const srcPath = path.join(__dirname, file);
        const distPath = path.join(distDir, file);
        fs.copyFileSync(srcPath, distPath);
        console.log(`Copied: ${file}`);
      });
    } else {
      const srcPath = path.join(__dirname, pattern);
      const distPath = path.join(distDir, pattern);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, distPath);
        console.log(`Copied: ${pattern}`);
      }
    }
  });
}

// Utility function to copy directories recursively
function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src, { withFileTypes: true });

  items.forEach(item => {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);

    if (item.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Run the build process
async function build() {
  try {
    await processJsFiles();
    await processCssFiles();
    await processHtmlFiles();
    copyOtherAssets();
    
    console.log(`\n✅ Build completed successfully!`);
    console.log(`📁 Output directory: ${distDir}`);
    
    // Show size comparison if in production mode
    if (isProduction) {
      const originalSize = getDirSize(__dirname);
      const builtSize = getDirSize(distDir);
      console.log(`📊 Original size: ${(originalSize / 1024).toFixed(1)} KB`);
      console.log(`📊 Built size: ${(builtSize / 1024).toFixed(1)} KB`);
      console.log(`📈 Size reduction: ${((1 - builtSize / originalSize) * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

function getDirSize(dir) {
  let size = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  items.forEach(item => {
    const itemPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist') {
      size += getDirSize(itemPath);
    } else if (item.isFile()) {
      size += fs.statSync(itemPath).size;
    }
  });
  
  return size;
}

build();