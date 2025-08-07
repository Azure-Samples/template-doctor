/**
 * Type definitions for the dod-rules configuration
 */

export interface TemplateConfig {
  /**
   * List of required files that must exist in the repository
   */
  requiredFiles: string[];
  
  /**
   * List of required folders that must exist in the repository
   */
  requiredFolders: string[];
  
  /**
   * Required workflow files that must exist in the repository
   */
  requiredWorkflowFiles?: WorkflowFileRequirement[];
  
  /**
   * Required documentation files that can exist in multiple locations
   */
  requiredDocFiles?: DocFileRequirement[];
  
  /**
   * Requirements for the README.md file
   */
  readmeRequirements?: ReadmeRequirements;
  
  /**
   * Requirements for Bicep files
   */
  bicepChecks: {
    requiredResources: string[];
  };
  
  /**
   * Requirements for the azure.yaml file
   */
  azureYamlRules: {
    mustDefineServices: boolean;
  };
  
  /**
   * OpenAI specific requirements
   */
  openai?: {
    deprecatedModels: string[];
  };
}

/**
 * Definition of a required workflow file
 */
export interface WorkflowFileRequirement {
  /**
   * Regular expression pattern to match the workflow file
   */
  pattern: RegExp;
  
  /**
   * Error message to display if the file is missing
   */
  message: string;
}

/**
 * Definition of a required documentation file
 */
export interface DocFileRequirement {
  /**
   * Array of regular expressions to match the documentation file in different locations
   */
  patterns: RegExp[];
  
  /**
   * Error message to display if the file is missing
   */
  message: string;
}

/**
 * Requirements for the README.md file
 */
export interface ReadmeRequirements {
  /**
   * List of required headings in the README.md
   */
  requiredHeadings: string[];
  
  /**
   * Requirements for the architecture diagram section
   */
  architectureDiagram: {
    /**
     * Heading text for the architecture diagram section
     */
    heading: string;
    
    /**
     * Whether an image is required in the architecture diagram section
     */
    requiresImage: boolean;
  };
}
