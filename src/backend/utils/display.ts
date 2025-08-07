/**
 * Utility functions for displaying template analysis results
 */
import { formatDate, formatPercentage } from './formatting.js';

/**
 * Format analysis results for display
 * @param results - Analysis results
 * @returns Formatted display string
 */
export function formatResults(results: any): string {
  const timestamp = formatDate(results.timestamp);
  const compliance = results.compliance;
  const percentageCompliant = compliance.compliant.find((item: any) => item.category === 'meta')?.details?.percentageCompliant || 0;
  const formattedPercentage = formatPercentage(percentageCompliant);
  
  let output = `Template Analysis Results (${timestamp})\n`;
  output += `Compliance: ${formattedPercentage}\n`;
  output += `Issues Found: ${compliance.issues.length}\n`;
  output += `Passed Checks: ${compliance.compliant.filter((item: any) => item.category !== 'meta').length}\n\n`;
  
  if (compliance.issues.length > 0) {
    output += `Issues to Fix:\n`;
    compliance.issues.forEach((issue: any, index: number) => {
      output += `${index + 1}. ${issue.message}\n`;
      if (issue.error) {
        output += `   - ${issue.error}\n`;
      }
    });
  }
  
  return output;
}