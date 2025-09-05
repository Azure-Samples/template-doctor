// Build script for CommonJS version
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Create the cjs directory if it doesn't exist
if (!fs.existsSync(path.join(process.cwd(), 'dist', 'cjs'))) {
  fs.mkdirSync(path.join(process.cwd(), 'dist', 'cjs'), { recursive: true });
}

// Copy the package.json with type: commonjs
const packageJson = {
  type: 'commonjs'
};

fs.writeFileSync(
  path.join(process.cwd(), 'dist', 'cjs', 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Run the TypeScript compiler with CJS output
exec('tsc -p tsconfig.json --module CommonJS --outDir dist/cjs', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`CommonJS build completed: ${stdout}`);
});