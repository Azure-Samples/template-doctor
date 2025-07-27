#!/usr/bin/env node
import { analyzeTemplate } from "./analyzeTemplate.js";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const [,, ...args] = process.argv;

const repoArg = args.find(a => a.startsWith("--repo="));
const repoUrl = repoArg?.split("=")[1];

if (!repoUrl) {
  console.error("❌ Usage: template-doctor --repo=https://github.com/user/repo");
  process.exit(1);
}

try {
  const result = await analyzeTemplate(repoUrl); // Pass token if analyzeTemplate accepts it

  const resultsDir = path.resolve("results");
  if (!existsSync(resultsDir)) {
    await mkdir(resultsDir, { recursive: true });
  }
  const outputPath = path.resolve(resultsDir, `${Date.now()}-analysis.json`);
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`✅ Analysis complete. Output saved to: ${outputPath}`);
} catch (err) {
  console.error("❌ Analysis failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
