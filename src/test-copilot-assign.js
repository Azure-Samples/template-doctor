#!/usr/bin/env node
import { assignIssueToCopilotBot } from "./mcpClient.js";

// You need to provide these arguments when running the script
const [repoUrl, issueNumberStr] = process.argv.slice(2);
const issueNumber = parseInt(issueNumberStr, 10);

if (!repoUrl || !issueNumber) {
  console.error("Usage: node test-copilot-assign.js <repo-url> <issue-number>");
  process.exit(1);
}

async function testCopilotAssign() {
  try {
    console.log(`Attempting to assign issue #${issueNumber} in ${repoUrl} to Copilot bot...`);
    const result = await assignIssueToCopilotBot(repoUrl, issueNumber);
    
    if (result) {
      console.log("✅ Successfully assigned issue to Copilot bot");
    } else {
      console.log("❌ Failed to assign issue to Copilot bot");
    }
  } catch (error) {
    console.error("Error assigning issue to Copilot bot:", error);
    process.exit(1);
  }
}

testCopilotAssign();
