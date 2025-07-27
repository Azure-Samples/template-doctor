#!/usr/bin/env node
import { analyzeTemplate } from "./analyzeTemplate.js";
import { generateDashboard } from "./dashboardGenerator.js";
import { openDashboard } from "./dashboardServer.js";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// List of templates to analyze
const templates = [
  {
    url: "https://github.com/Azure-Samples/azd-templates",
    name: "AZD Templates"
  },
  {
    url: "https://github.com/Azure-Samples/todo-nodejs-mongo",
    name: "Todo Node.js MongoDB"
  },
  {
    url: "https://github.com/Azure-Samples/todo-python-postgresql",
    name: "Todo Python PostgreSQL"
  }
];

async function runDemo() {
  console.log("🚀 Running Template Doctor Demo");
  console.log("==============================\n");
  
  const resultsDir = path.resolve("results");
  if (!existsSync(resultsDir)) {
    await mkdir(resultsDir, { recursive: true });
  }

  // Analyze each template
  for (const template of templates) {
    console.log(`\n📊 Analyzing template: ${template.name} (${template.url})`);
    
    try {
      // Analyze the template
      const result = await analyzeTemplate(template.url);
      
      // Save the analysis result
      const outputPath = path.resolve(resultsDir, `${Date.now()}-analysis.json`);
      await writeFile(outputPath, JSON.stringify(result, null, 2));
      console.log(`✅ Analysis complete. Output saved to: ${outputPath}`);
      
      // Generate the dashboard
      const dashboardPath = await generateDashboard(result, outputPath);
      console.log(`🎨 Dashboard generated at: ${dashboardPath}`);
    } catch (err) {
      console.error(`❌ Failed to analyze ${template.name}:`, err instanceof Error ? err.message : err);
      console.log("Continuing with next template...");
    }
  }

  // Show the template index
  console.log("\n📋 Opening template list dashboard...");
  
  // Check if we have an index file
  const indexPath = path.join(resultsDir, "template-index.html");
  
  if (!existsSync(indexPath)) {
    console.error("❌ Template index not found. This shouldn't happen if at least one template was successfully analyzed.");
    return;
  }

  try {
    const serverInfo = await openDashboard(indexPath, 3000);
    console.log(`🚀 Template index opened at: ${serverInfo.url}`);
    console.log("\n👀 Press Ctrl+C to stop the server and exit");
  } catch (err) {
    console.error("❌ Failed to start dashboard server:", err instanceof Error ? err.message : err);
    console.log(`📄 You can open the template index file directly: file://${indexPath}`);
  }
}

runDemo().catch(err => {
  console.error("❌ Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
