// index.js
import { app } from '@azure/functions';
import path from 'path';
import fs from 'fs';
import { FragmentGateway } from 'web-fragments/gateway';
import { getNodeMiddleware } from 'web-fragments/gateway/node';
import { createServer } from 'http';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';

const distPath = path.resolve('dist');

// Initialize FragmentGateway once
const gateway = new FragmentGateway({
  piercingStyles: `
    
  `,
});

// Register fragments
gateway.registerFragment({
  fragmentId: 'vscodedevazure',
  prePiercingClassNames: ['vscode'],
  routePatterns: ['/main.vscode-cdn.net/:_*', 'github.vscode-unpkg.net/:_*'],
  endpoint: 'https://vscode.dev/azure',
  onSsrFetchError: () => ({
    response: new Response('<p>VS Code fragment not found</p>', {
      headers: { 'content-type': 'text/html' },
    }),
  }),
});

// Static file middleware
const serve = serveStatic(distPath);

// Azure Function HTTP trigger
app.http('gatewayHandler', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: '{*segments}', // Catch-all route
  handler: async (req, context) => {
    return new Promise((resolve) => {
      const res = {
        writeHead: (status, headers) => {
          context.res = {
            status,
            headers,
            body: '',
          };
        },
        end: (body) => {
          context.res.body = body;
          resolve(context.res);
        },
        setHeader: (name, value) => {
          if (!context.res) context.res = { headers: {} };
          context.res.headers[name] = value;
        },
      };

      // Run gateway middleware first
      const middleware = getNodeMiddleware(gateway, { mode: 'development' });
      middleware(req, res, () => {
        // Handle static files
        serve(req, res, finalhandler(req, res));
      });
    });
  },
});
