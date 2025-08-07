const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Map file extensions to content types
const contentTypeMap = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// Create the server
const server = http.createServer((req, res) => {
  // Parse the URL
  const parsedUrl = url.parse(req.url);
  
  // Get the path from the URL
  let pathname = parsedUrl.pathname;
  
  // Default to index.html if path is /
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Construct the file path (relative to frontend directory)
  const filePath = path.join(__dirname, pathname);
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set the content type based on the file extension
  const contentType = contentTypeMap[extname] || 'text/plain';
  
  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      // If the file doesn't exist, return 404
      if (err.code === 'ENOENT') {
        console.error(`File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 Not Found</h1><p>File ${pathname} not found</p>`);
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>500 Server Error</h1><p>${err.code}</p>`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop`);
});

// Handle server termination
process.on('SIGINT', () => {
  console.log('Shutting down server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
