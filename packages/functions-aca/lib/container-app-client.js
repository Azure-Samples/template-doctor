// Helper functions to interact with Azure Container Apps
const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { DefaultAzureCredential } = require('@azure/identity');

// Cache the client instance
let _containerAppClient = null;

/**
 * Get a Container App client using DefaultAzureCredential
 * @returns {Promise<ContainerAppsAPIClient>} The Container App client
 */
async function getContainerAppClient() {
  if (!_containerAppClient) {
    const credential = new DefaultAzureCredential();
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (!subscriptionId) {
      throw new Error('Missing required environment variable: AZURE_SUBSCRIPTION_ID');
    }
    _containerAppClient = new ContainerAppsAPIClient(credential, subscriptionId);
  }
  return _containerAppClient;
}

/**
 * Start a Container App job
 * @param {string} executionName The unique execution ID
 * @param {string} templateName The template name to run
 * @param {string} action The action to run (init, up, down)
 * @returns {Promise<object>} The job details
 */
async function startContainerJob(executionName, templateName, action = 'init') {
  try {
    // Get environment variables
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.ACA_RESOURCE_GROUP;
    const containerAppJobName = process.env.ACA_JOB_NAME || 'template-doctor-job';
    
    if (!subscriptionId || !resourceGroupName) {
      throw new Error('Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP');
    }
    
    // Get the client
    const client = await getContainerAppClient();
    
    // Get the current job configuration
    const jobConfig = await client.jobs.get(resourceGroupName, containerAppJobName);
    
    // Create a job execution with updated environment variables
    const jobExecution = {
      location: jobConfig.location,
      properties: {
        environmentVariables: [
          { name: 'TEMPLATE_NAME', value: templateName },
          { name: 'AZD_ACTION', value: action },
          { name: 'EXECUTION_ID', value: executionName }
        ],
        // Use the same configuration as the base job
        configuration: jobConfig.properties.configuration,
        template: jobConfig.properties.template
      }
    };
    
    // Start the job execution
    const jobExecutionName = `${containerAppJobName}-${executionName}`;
    const result = await client.jobsExecutions.beginCreateAndWait(
      resourceGroupName,
      containerAppJobName,
      jobExecutionName,
      jobExecution
    );
    
    return {
      executionName,
      jobExecutionName,
      status: result.properties.status,
      templateName,
      action,
      startTime: result.properties.startTime,
      resourceId: result.id
    };
  } catch (error) {
    console.error(`Error starting container job: ${error.message}`);
    throw error;
  }
}

/**
 * Get logs from a Container App job execution
 * @param {string} executionName The unique execution ID
 * @returns {Promise<Array<object>>} The job logs
 */
async function getContainerJobLogs(executionName) {
  try {
    // Get environment variables
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.ACA_RESOURCE_GROUP;
    const containerAppJobName = process.env.ACA_JOB_NAME || 'template-doctor-job';
    
    if (!subscriptionId || !resourceGroupName) {
      throw new Error('Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP');
    }
    
    // Get the client
    const client = await getContainerAppClient();
    
    // Correctly format the job execution name
    let jobExecutionName;
    if (executionName.startsWith(containerAppJobName)) {
      // Already contains the job name, use as is
      jobExecutionName = executionName;
      console.log(`Using provided full execution name for logs: ${jobExecutionName}`);
    } else if (executionName.startsWith('template-doctor-aca-job-')) {
      // Already has the container job prefix, use as is
      jobExecutionName = executionName;
      console.log(`Using provided execution name with prefix for logs: ${jobExecutionName}`);
    } else {
      // Add the job name prefix
      jobExecutionName = `${containerAppJobName}-${executionName}`;
      console.log(`Adding job name prefix to execution name for logs: ${jobExecutionName} (from ${executionName})`);
    }
    
    // Debug log to help with troubleshooting
    console.log(`Looking for container job logs with execution name: ${jobExecutionName}`);
    
    // Add detailed debugging info about what we're retrieving
    console.log(`Retrieving logs for container job:
  Resource Group: ${resourceGroupName}
  Container App Job: ${containerAppJobName}
  Execution Name: ${jobExecutionName}
`);

    // First get the job execution status
    let execution;
    try {
      console.log(`Checking if job execution exists: ${jobExecutionName}`);
      execution = await client.jobsExecutions.get(
        resourceGroupName,
        containerAppJobName,
        jobExecutionName
      );
      
      console.log(`Job execution exists with status: ${execution?.properties?.status || 'unknown'}`);
    } catch (getError) {
      console.error(`Error getting job execution: ${getError.message}`);
      
      // If the error is that the execution wasn't found, try with a different name format
      if (getError.statusCode === 404) {
        // Try alternative formats:
        // 1. If we tried with prefix, try without
        // 2. If we tried without prefix, try with
        let alternativeJobName;
        
        if (jobExecutionName.includes('-')) {
          // Try extracting just the execution ID portion
          const parts = jobExecutionName.split('-');
          alternativeJobName = parts[parts.length - 1];
          console.log(`Trying alternative job name without prefix: ${alternativeJobName}`);
        } else {
          // We tried without prefix, now try with container-app-job prefix
          alternativeJobName = `template-doctor-aca-job-${executionName}`;
          console.log(`Trying alternative job name with prefix: ${alternativeJobName}`);
        }
        
        try {
          console.log(`Checking if alternative job execution exists: ${alternativeJobName}`);
          execution = await client.jobsExecutions.get(
            resourceGroupName,
            containerAppJobName,
            alternativeJobName
          );
          
          console.log(`Alternative job execution exists with status: ${execution?.properties?.status || 'unknown'}`);
          
          // Update the job execution name for subsequent operations
          jobExecutionName = alternativeJobName;
        } catch (altError) {
          console.error(`Error with alternative job execution name: ${altError.message}`);
          throw new Error(`Could not find job execution with name ${jobExecutionName} or ${alternativeJobName}: ${altError.message}`);
        }
      } else {
        throw getError;
      }
    }
    
    // Get the logs for all containers in the job
    console.log(`Getting logs for job execution: ${jobExecutionName}`);
    const logs = await client.jobsExecutions.listLogs(
      resourceGroupName,
      containerAppJobName,
      jobExecutionName,
      { follow: false, tail: 500 }
    );
    
    // Debug: Log the raw logs object structure to understand the format
    console.log(`Raw logs object structure for ${jobExecutionName}:`, 
      JSON.stringify({
        type: typeof logs,
        hasValue: !!logs.value,
        valueType: logs.value ? typeof logs.value : 'undefined',
        isValueArray: Array.isArray(logs.value),
        valueLength: logs.value ? logs.value.length : 0,
        sampleEntry: logs.value && logs.value.length > 0 ? logs.value[0] : null
      })
    );
    
    // Log raw response data for debugging
    console.log(`Raw logs response status: ${typeof logs?.value}`);
    if (logs?.value && logs.value.length > 0) {
      console.log(`First log entry sample: ${JSON.stringify(logs.value[0])}`);
    } else {
      console.log(`No logs available yet for execution: ${jobExecutionName}`);
    }
    
    // Transform the logs to a standard format
    const processedLogs = [];
    
    if (logs && logs.value && Array.isArray(logs.value)) {
      for (const logEntry of logs.value) {
        // Each log entry should have time and message properties
        // If the format is different, process accordingly
        if (typeof logEntry === 'string') {
          // Simple string log format
          processedLogs.push({
            time: new Date().toISOString(),
            message: logEntry
          });
        } else if (logEntry && typeof logEntry === 'object') {
          // Object format, extract relevant fields
          const time = logEntry.time || new Date().toISOString();
          let message = '';
          
          // Check for common log properties
          if (logEntry.message) {
            message = logEntry.message;
          } else if (logEntry.log) {
            message = logEntry.log;
          } else if (logEntry.content) {
            message = logEntry.content;
          } else if (logEntry.stdout) {
            message = logEntry.stdout;
          } else {
            // If no recognized property, stringify the entire object
            try {
              message = JSON.stringify(logEntry);
            } catch (e) {
              message = 'Unable to process log entry format';
            }
          }
          
          processedLogs.push({
            time,
            message
          });
        }
      }
    }
    
    // Add debug info
    console.log(`Retrieved ${processedLogs.length} logs for job execution ${jobExecutionName}`);
    
    // Add a status log if the job has failed but we have no logs
    if (execution.properties.status === 'Failed' && processedLogs.length === 0) {
      console.log(`Job execution ${jobExecutionName} failed but has no logs. Adding error message.`);
      processedLogs.push({
        time: new Date().toISOString(),
        message: `ERROR: Job execution failed but no logs were available. Please check the Azure portal for details.`
      });
    }
    
    return {
      status: execution.properties.status,
      startTime: execution.properties.startTime,
      endTime: execution.properties.endTime,
      logs: processedLogs,
      done: ['Succeeded', 'Failed', 'Canceled', 'Terminated'].includes(execution.properties.status)
    };
  } catch (error) {
    console.error(`Error getting container job logs: ${error.message}`);
    // Log more details about the error for debugging
    console.error(`Error details:`, {
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Stop a running Container App job execution
 * @param {string} executionName The unique execution ID
 * @returns {Promise<object>} The job status
 */
async function stopContainerJob(executionName) {
  try {
    // Get environment variables
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.ACA_RESOURCE_GROUP;
    const containerAppJobName = process.env.ACA_JOB_NAME || 'template-doctor-job';
    
    if (!subscriptionId || !resourceGroupName) {
      throw new Error('Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP');
    }
    
    // Get the client
    const client = await getContainerAppClient();
    
    // Correctly format the job execution name
    let jobExecutionName;
    if (executionName.startsWith(containerAppJobName)) {
      // Already contains the job name, use as is
      jobExecutionName = executionName;
      console.log(`Using provided full execution name: ${jobExecutionName}`);
    } else if (executionName.startsWith('template-doctor-aca-job-')) {
      // Already has the container job prefix, use as is
      jobExecutionName = executionName;
      console.log(`Using provided execution name with prefix: ${jobExecutionName}`);
    } else {
      // Add the job name prefix
      jobExecutionName = `${containerAppJobName}-${executionName}`;
      console.log(`Adding job name prefix to execution name: ${jobExecutionName} (from ${executionName})`);
    }
    
    console.log(`Attempting to stop container job execution: ${jobExecutionName}`);
    
    // Debug information
    console.log(`Stop job request details:
  Resource Group: ${resourceGroupName}
  Container App Job: ${containerAppJobName}
  Execution Name: ${jobExecutionName}
  Original Execution Name: ${executionName}
`);

    // First check if the execution exists
    try {
      console.log(`Checking if job execution exists: ${jobExecutionName}`);
      const existingExecution = await client.jobsExecutions.get(
        resourceGroupName,
        containerAppJobName,
        jobExecutionName
      );
      
      console.log(`Job execution exists with status: ${existingExecution?.properties?.status || 'unknown'}`);
      
      // Cancel the job execution
      console.log(`Cancelling job execution: ${jobExecutionName}`);
      await client.jobsExecutions.beginCancelAndWait(
        resourceGroupName,
        containerAppJobName,
        jobExecutionName
      );
      
      // Get the updated status
      const execution = await client.jobsExecutions.get(
        resourceGroupName,
        containerAppJobName,
        jobExecutionName
      );
      
      console.log(`Job execution cancelled successfully. New status: ${execution?.properties?.status || 'unknown'}`);
      
      return {
        status: execution.properties.status,
        startTime: execution.properties.startTime,
        endTime: execution.properties.endTime,
        done: true
      };
    } catch (getError) {
      // If the execution doesn't exist with the normal name, try with a different format
      console.error(`Error checking job execution: ${getError.message}`);
      
      // If the error is that the execution wasn't found, try with a different name format
      if (getError.statusCode === 404) {
        // Try alternative formats:
        // 1. If we tried with prefix, try without
        // 2. If we tried without prefix, try with
        let alternativeJobName;
        
        if (jobExecutionName.includes('-')) {
          // Try extracting just the execution ID portion
          const parts = jobExecutionName.split('-');
          alternativeJobName = parts[parts.length - 1];
          console.log(`Trying alternative job name without prefix: ${alternativeJobName}`);
        } else {
          // We tried without prefix, now try with container-app-job prefix
          alternativeJobName = `template-doctor-aca-job-${executionName}`;
          console.log(`Trying alternative job name with prefix: ${alternativeJobName}`);
        }
        
        try {
          console.log(`Checking if alternative job execution exists: ${alternativeJobName}`);
          const existingExecution = await client.jobsExecutions.get(
            resourceGroupName,
            containerAppJobName,
            alternativeJobName
          );
          
          console.log(`Alternative job execution exists with status: ${existingExecution?.properties?.status || 'unknown'}`);
          
          // Cancel the job execution
          console.log(`Cancelling alternative job execution: ${alternativeJobName}`);
          await client.jobsExecutions.beginCancelAndWait(
            resourceGroupName,
            containerAppJobName,
            alternativeJobName
          );
          
          // Get the updated status
          const execution = await client.jobsExecutions.get(
            resourceGroupName,
            containerAppJobName,
            alternativeJobName
          );
          
          console.log(`Alternative job execution cancelled successfully. New status: ${execution?.properties?.status || 'unknown'}`);
          
          return {
            status: execution.properties.status,
            startTime: execution.properties.startTime,
            endTime: execution.properties.endTime,
            done: true
          };
        } catch (altError) {
          console.error(`Error with alternative job execution name: ${altError.message}`);
          throw new Error(`Could not find job execution with name ${jobExecutionName} or ${alternativeJobName}: ${altError.message}`);
        }
      } else {
        throw getError;
      }
    }
  } catch (error) {
    console.error(`Error stopping container job: ${error.message}`);
    console.error(`Error details:`, {
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  getContainerAppClient,
  startContainerJob,
  getContainerJobLogs,
  stopContainerJob
};
