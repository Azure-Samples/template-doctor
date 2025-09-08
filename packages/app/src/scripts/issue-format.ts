// Utility to turn analyzer compliance issues into structured GitHub issue prompts
// Focus: Provide GitHub Copilot with clear current vs expected state & concrete fix steps

export interface RuleViolation {
  rule: string;               // canonical rule id/category
  description: string;        // human friendly description (what is wrong)
  currentValue?: string;      // observed state
  expectedValue?: string;     // desired state wording
  filePath?: string;          // path relevant to violation
  snippet?: string;           // optional code / config snippet
}

export interface FormattedIssue { title: string; body: string; }

// Optional context values passed from analyzer when available
export interface IssueTemplateContext {
  compliancePercentage?: number; // current overall compliance to reference in acceptance criteria
  mainIssueAnchor?: string;      // e.g., link or markdown anchor to tracking umbrella issue
}

// Core templating function with optional context for richer acceptance criteria.
export function formatViolationAsIssue(v: RuleViolation, ctx: IssueTemplateContext = {}): FormattedIssue {
  const title = `[Policy] ${v.description}`;

  // Tailored Required fix guidance for a few common rule families
  let requiredFixLines: string[] = [];
  switch (v.rule) {
    case 'defaultBranch':
      requiredFixLines = [
        'Rename the current default branch to main (or create main & move history).',
        'Update all workflow / README / script references from old name to main.',
        'Set main as the default branch in repository settings.'
      ];
      break;
    case 'requiredFile':
      requiredFixLines = [
        `Add the missing file ${v.filePath || ''} with appropriate content.`,
        'Commit & push to default branch.',
        'Ensure any referenced docs / workflows resolve correctly.'
      ];
      break;
    case 'requiredFolder':
      requiredFixLines = [
        `Create the folder ${v.filePath || ''} and populate required files.`,
        'Follow project conventions (naming, casing, structure).'
      ];
      break;
    case 'bicepFilesPresent':
      requiredFixLines = [
        'Add at least one infrastructure .bicep file under infra/.',
        'Model required Azure resources adhering to naming & security guidelines.'
      ];
      break;
    case 'bicepResource':
      requiredFixLines = [
        `Add the missing resource to the relevant .bicep file (${v.filePath || 'infra/'})`,
        'Validate with bicep build / az deployment what-if.'
      ];
      break;
    case 'azureYamlFile':
      requiredFixLines = [
        'Create azure.yaml (or azure.yml) at repository root.',
        'Define services and required pipeline metadata.'
      ];
      break;
    case 'azureYamlServices':
      requiredFixLines = [
        'Add a top-level services: section enumerating deployable components.',
        'Ensure each service subpath matches actual infra/app code.'
      ];
      break;
    case 'readmeMissingHeading':
      requiredFixLines = [
        'Add the missing README heading (level H2).',
        'Match heading text exactly to project guidance.'
      ];
      break;
    case 'readmeMissingArchitectureDiagramHeading':
      requiredFixLines = [
        'Add an Architecture (H2) section to the README.',
        'Position it before deployment / operations sections.'
      ];
      break;
    case 'readmeMissingArchitectureDiagramImage':
      requiredFixLines = [
        'Insert an architecture diagram image in the Architecture section.',
        'Provide descriptive alt text explaining key components.'
      ];
      break;
    default:
      requiredFixLines = [
        'Update repository code/configuration to satisfy this rule.',
        'Replace any outdated references.',
        'Ensure all affected files are updated.'
      ];
  }

  const body = `\n## Rule violated\n${v.description}\n\n## Why this matters\nThis rule is part of the repository governance policy to ensure consistency, security, and maintainability.\n\n## Current state\n${v.currentValue ? `- ${v.currentValue}` : 'Detected state does not match policy.'}${v.filePath ? `\n\n\`\`\`\n${v.filePath}\n${(v.snippet||'').trim()}\n\`\`\`` : ''}\n\n## Expected state\n${v.expectedValue || 'Repository should comply with the rule requirements.'}\n\n## Required fix\n${requiredFixLines.map((l,i)=>`${i+1}. ${l}`).join('\n')}\n\n## Acceptance criteria\n- The repository satisfies the rule.\n- All workflows/docs/scripts reflect the corrected configuration.\n- No analyzer findings for this rule after re-run.\n${typeof ctx.compliancePercentage === 'number' ? `- Overall compliance improves above current ${ctx.compliancePercentage}%.\n` : ''}${ctx.mainIssueAnchor ? `\n> Tracking: ${ctx.mainIssueAnchor}\n` : ''}`;

  return { title, body };
}

// Heuristic mapper from existing analyzer issue objects to RuleViolation
export function mapAnalyzerIssueToViolation(issue: any): RuleViolation | undefined {
  if(!issue || !issue.id) return undefined;
  const id: string = issue.id;
  const msg: string = issue.message || issue.error || 'Policy violation';
  // Default shape
  let v: RuleViolation = { rule: 'policy', description: msg };

  if(id.startsWith('missing-') && !id.startsWith('missing-workflow-') && !id.startsWith('missing-folder-')){
    // missing required file
    const file = id.replace('missing-','');
    v = { rule: 'requiredFile', description: msg, currentValue: `File ${file} absent`, expectedValue: `File ${file} present with correct content`, filePath: file };
  } else if(id.startsWith('missing-workflow-')){
    v = { rule: 'requiredWorkflowFile', description: msg, currentValue: 'Workflow file absent', expectedValue: 'Required GitHub Actions workflow exists under .github/workflows/' };
  } else if(id.startsWith('missing-folder-')){
    const folder = id.replace('missing-folder-','');
    v = { rule: 'requiredFolder', description: msg, currentValue: `Folder ${folder}/ absent`, expectedValue: `Folder ${folder}/ exists with expected structure`, filePath: folder+'/' };
  } else if(id === 'missing-bicep'){
    v = { rule: 'bicepFilesPresent', description: msg, currentValue: 'No .bicep files in infra/', expectedValue: 'At least one infrastructure .bicep file in infra/' };
  } else if(id.startsWith('bicep-missing-')){
    const resource = id.replace('bicep-missing-','');
    v = { rule: 'bicepResource', description: msg, currentValue: `Resource ${resource} not declared`, expectedValue: `Resource ${resource} declared in appropriate .bicep file` };
  } else if(id === 'missing-azure-yaml'){
    v = { rule: 'azureYamlFile', description: msg, currentValue: 'azure.yaml not present', expectedValue: 'azure.yaml present at repository root' };
  } else if(id === 'azure-yaml-missing-services'){
    v = { rule: 'azureYamlServices', description: msg, currentValue: 'No services: section', expectedValue: 'services: section lists deployable components' };
  } else if(id.startsWith('readme-missing-heading-')){
    v = { rule: 'readmeMissingHeading', description: msg, currentValue: 'README missing required heading', expectedValue: 'README contains required heading with appropriate content', filePath: 'README.md' };
  } else if(id === 'readme-missing-architecture-diagram-heading'){
    v = { rule: 'readmeMissingArchitectureDiagramHeading', description: msg, currentValue: 'Architecture section heading missing', expectedValue: 'Architecture (H2) heading present', filePath: 'README.md' };
  } else if(id === 'readme-missing-architecture-diagram-image'){
    v = { rule: 'readmeMissingArchitectureDiagramImage', description: msg, currentValue: 'Architecture section lacks diagram image', expectedValue: 'Architecture section includes a diagram image with alt text', filePath: 'README.md' };
  } else if(id.startsWith('default-branch-not-')){
    const expected = id.replace('default-branch-not-','');
    v = { rule: 'defaultBranch', description: msg, currentValue: issue.error || 'Default branch differs', expectedValue: `Default branch set to '${expected}'` };
  }
  return v;
}
