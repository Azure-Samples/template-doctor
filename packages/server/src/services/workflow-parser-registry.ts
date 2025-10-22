/**
 * Workflow Artifact Parser Registry
 * 
 * Provides two types of parsers:
 * 1. Format Parsers (markdown, json, log) - handle file formats
 * 2. Content Parsers (azd-validation, etc.) - handle validation-specific structure
 * 
 * Format parsers extract basic structure from files.
 * Content parsers interpret validation results and can use format parsers internally.
 */

import { ArtifactParser, ParserRegistryEntry, WorkflowConfig } from '../types/workflow.js';
import { parseAzdValidationResult } from './azd-validation.js';

const parserRegistry = new Map<string, ParserRegistryEntry>();

/**
 * Format Parser: Markdown - extracts common markdown patterns
 */
export const markdownParser: ArtifactParser = (content: string, config: WorkflowConfig) => {
  return {
    format: 'markdown',
    content,
    rawText: content,
    // Extract common sections
    sections: extractMarkdownSections(content),
    // Extract lists
    checklists: extractChecklists(content),
    // Extract code blocks
    codeBlocks: extractCodeBlocks(content),
  };
};

/**
 * Format Parser: Log - extracts log file patterns
 */
export const logParser: ArtifactParser = (content: string, config: WorkflowConfig) => {
  return {
    format: 'log',
    content,
    rawText: content,
    lines: content.split('\n'),
    errors: extractLogErrors(content),
    warnings: extractLogWarnings(content),
  };
};

/**
 * Format Parser: JSON - parses JSON artifacts
 */
export const jsonParser: ArtifactParser = (content: string, config: WorkflowConfig) => {
  try {
    const parsed = JSON.parse(content);
    return {
      format: 'json',
      content,
      data: parsed,
    };
  } catch (error) {
    return {
      format: 'json',
      content,
      error: 'Failed to parse JSON',
      rawText: content,
    };
  }
};

/**
 * Content Parser: AZD Validation - parses AZD validation results
 * Uses markdown parser internally for preprocessing
 */
export const azdValidationParser: ArtifactParser = (content: string, config: WorkflowConfig) => {
  const parsed = parseAzdValidationResult(content);
  return {
    format: 'azd-validation',
    ...parsed,
  };
};

/**
 * Register default parsers
 * 
 * Format Parsers: Handle file formats (markdown, json, log)
 * Content Parsers: Handle validation-specific structure (azd-validation, ossf-scorecard, trivy-scanner, etc.)
 */
function registerDefaultParsers() {
  // Format Parsers
  parserRegistry.set('markdown', {
    name: 'markdown',
    parser: markdownParser,
    description: 'Format Parser: Markdown file structure extraction',
  });

  parserRegistry.set('log', {
    name: 'log',
    parser: logParser,
    description: 'Format Parser: Log file pattern extraction',
  });

  parserRegistry.set('json', {
    name: 'json',
    parser: jsonParser,
    description: 'Format Parser: JSON parsing',
  });

  // Content Parsers
  parserRegistry.set('azd-validation', {
    name: 'azd-validation',
    parser: azdValidationParser,
    description: 'Content Parser: AZD template validation results',
  });
}

// Register default parsers on module load
registerDefaultParsers();

/**
 * Register a custom artifact parser
 */
export function registerParser(name: string, parser: ArtifactParser, description?: string): void {
  parserRegistry.set(name, {
    name,
    parser,
    description,
  });
}

/**
 * Get parser by name, fallback to auto-detection
 */
export function getParser(parserName?: string, fileExtension?: string): ArtifactParser {
  // If parser name specified, use it
  if (parserName && parserRegistry.has(parserName)) {
    return parserRegistry.get(parserName)!.parser;
  }

  // Auto-detect based on file extension
  if (fileExtension) {
    const ext = fileExtension.toLowerCase();
    if (ext === '.md' || ext === '.markdown') {
      return markdownParser;
    }
    if (ext === '.log' || ext === '.txt') {
      return logParser;
    }
    if (ext === '.json') {
      return jsonParser;
    }
  }

  // Default to markdown parser
  return markdownParser;
}

/**
 * List all registered parsers
 */
export function listParsers(): ParserRegistryEntry[] {
  return Array.from(parserRegistry.values());
}

// Helper functions

function extractMarkdownSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const headerRegex = /^#{1,6}\s+(.+)$/gm;
  let match;
  let lastHeader = '';
  let lastIndex = 0;

  while ((match = headerRegex.exec(content)) !== null) {
    if (lastHeader) {
      sections[lastHeader] = content.substring(lastIndex, match.index).trim();
    }
    lastHeader = match[1];
    lastIndex = headerRegex.lastIndex;
  }

  if (lastHeader) {
    sections[lastHeader] = content.substring(lastIndex).trim();
  }

  return sections;
}

function extractChecklists(content: string): Array<{ checked: boolean; text: string }> {
  const checklistRegex = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  const checklists: Array<{ checked: boolean; text: string }> = [];
  let match;

  while ((match = checklistRegex.exec(content)) !== null) {
    checklists.push({
      checked: match[1].toLowerCase() === 'x',
      text: match[2],
    });
  }

  return checklists;
}

function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks: Array<{ language: string; code: string }> = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return codeBlocks;
}

function extractLogErrors(content: string): string[] {
  const errorRegex = /^.*(\berror\b|\berr\b|\bfatal\b|\bfailed\b|\bfailure\b).*$/gim;
  const errors: string[] = [];
  let match;

  while ((match = errorRegex.exec(content)) !== null) {
    errors.push(match[0].trim());
  }

  return errors;
}

function extractLogWarnings(content: string): string[] {
  const warningRegex = /^.*(\bwarning\b|\bwarn\b|\bcaution\b).*$/gim;
  const warnings: string[] = [];
  let match;

  while ((match = warningRegex.exec(content)) !== null) {
    warnings.push(match[0].trim());
  }

  return warnings;
}
