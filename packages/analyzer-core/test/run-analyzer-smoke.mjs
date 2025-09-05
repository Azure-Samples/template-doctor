// Simple smoke test for the analyzer
import { runAnalyzer } from '../dist/index.js';

const main = async () => {
  try {
    // Dummy test data
    const result = await runAnalyzer('https://github.com/example/test-repo', [
      { path: 'README.md', sha: '123', content: '# Test Repo\n\nThis is a test repository.' },
      { path: 'LICENSE', sha: '456', content: 'MIT License' },
      { path: 'src/index.js', sha: '789', content: 'console.log("Hello world");' }
    ], {
      ruleSet: 'dod',
      categories: ['documentation'],
      azureDeveloperCliEnabled: true,
      aiDeprecationCheckEnabled: true
    });

    console.log('Test result:', JSON.stringify(result, null, 2));
    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

main();