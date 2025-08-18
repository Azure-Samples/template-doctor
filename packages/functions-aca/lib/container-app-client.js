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
 * Checks if a method exists on an object
 * @param {Object} obj The object to check
 * @param {string} methodName The method name to check for
 * @returns {boolean} Whether the method exists
 */
function methodExists(obj, methodName) {
  return obj && typeof obj[methodName] === 'function';
}

/**
 * Gets the correct client object for job operations
 * @param {ContainerAppsAPIClient} client The Container Apps API client
 * @param {string} operation Optional operation name to check for (get, list, etc)
 * @returns {Object} The correct client object for job operations
 */
function getJobClient(client, operation = null) {
  // Check for different possible property names based on SDK versions
  // If a specific operation is requested, check for that operation
  // Otherwise, accept any client that exists
  
  const checkClient = (clientObj, propName) => {
    if (!clientObj) return false;
    if (operation && !methodExists(clientObj, operation)) return false;
    console.log(`Using client.${propName} for job operations${operation ? ` (${operation})` : ''}`);
    return true;
  };
  
  if (client.jobExecutions && checkClient(client.jobExecutions, 'jobExecutions')) {
    return client.jobExecutions;
  }
  if (client.jobsExecutions && checkClient(client.jobsExecutions, 'jobsExecutions')) {
    return client.jobsExecutions;
  }
  if (client.containerJobs && checkClient(client.containerJobs, 'containerJobs')) {
    return client.containerJobs;
  }
  if (client.containerJobExecutions && checkClient(client.containerJobExecutions, 'containerJobExecutions')) {
    return client.containerJobExecutions;
  }
  if (client.jobs && checkClient(client.jobs, 'jobs')) {
    return client.jobs;
  }
  
  // List all available client properties for debugging
  console.log('Available client properties:');
  Object.keys(client).forEach(key => {
    if (!key.startsWith('_') && typeof client[key] === 'object' && client[key] !== null) {
      console.log(`- client.${key}`);
      // Check methods on this property
      if (client[key]) {
        Object.keys(client[key]).forEach(method => {
          if (typeof client[key][method] === 'function') {
            console.log(`  - client.${key}.${method}`);
          }
        });
      }
    }
  });
  
  if (operation) {
    throw new Error(`Could not find job operations client with '${operation}' method. The SDK structure may have changed.`);
  } else {
    throw new Error('Could not find job operations client. The SDK structure may have changed.');
  }
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
    
    // Get the jobs client
    const jobsClient = client.jobs || client;
    
    // Get the current job configuration
    const jobConfig = await jobsClient.get(resourceGroupName, containerAppJobName);
    
    // Create a job execution with updated environment variables
    const jobExecution = {
      location: jobConfig.location,
      properties: {
        environmentVariables: [
          { name: 'TEMPLATE_NAME', value: templateName },
          { name: 'AZD_ACTION', value: action },
          { name: 'EXECUTION_ID', value: executionName },
          // Add the TD execution name as an environment variable
          // so we can track it in job logs and correlate it
          { name: 'TD_EXECUTION_NAME', value: executionName }
        ],
        // Use the same configuration as the base job
        configuration: jobConfig.properties.configuration,
        template: jobConfig.properties.template
      }
    };
    
    // Find the correct client for job execution operations
    const jobExecutionsClient = getJobClient(client);
    
    // Let Azure generate the job execution name
    // Don't specify our own name - let Azure generate one with a random suffix
    // We'll use environment variables to track our execution ID
    
    // Determine which method to use for creating the job execution
    let result;
    if (methodExists(jobExecutionsClient, 'beginCreateAndWait')) {
      console.log(`Using beginCreateAndWait method for job execution`);
      result = await jobExecutionsClient.beginCreateAndWait(
        resourceGroupName,
        containerAppJobName,
        /* No job execution name - let Azure generate one */
        jobExecution
      );
    } else if (methodExists(jobExecutionsClient, 'createAndWait')) {
      console.log(`Using createAndWait method for job execution`);
      result = await jobExecutionsClient.createAndWait(
        resourceGroupName,
        containerAppJobName,
        /* No job execution name - let Azure generate one */
        jobExecution
      );
    } else if (methodExists(jobExecutionsClient, 'beginCreate')) {
      console.log(`Using beginCreate method for job execution`);
      const poller = await jobExecutionsClient.beginCreate(
        resourceGroupName,
        containerAppJobName,
        /* No job execution name - let Azure generate one */
        jobExecution
      );
      result = await poller.pollUntilDone();
    } else if (methodExists(jobExecutionsClient, 'create')) {
      console.log(`Using create method for job execution`);
      result = await jobExecutionsClient.create(
        resourceGroupName,
        containerAppJobName,
        /* No job execution name - let Azure generate one */
        jobExecution
      );
    } else {
      throw new Error('Could not find method to create job execution');
    }
    
    // Store the actual job execution name in global memory
    if (!global.executionLogs) {
      global.executionLogs = {};
    }
    
    if (!global.executionLogs[executionName]) {
      global.executionLogs[executionName] = {
        status: 'running',
        logs: [],
        done: false,
        startTime: new Date().toISOString(),
        endTime: null
      };
    }
    
    // Store the actual job name for later lookups
    global.executionLogs[executionName].jobName = result.name;
    
    console.log(`Created job execution ${result.name} for TD execution ${executionName}`);
    
    return {
      executionName,
      jobExecutionName: result.name,
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
 * Get logs from a Container App job execution using the Azure CLI
 * @param {string} executionName The unique execution ID
 * @returns {Promise<object>} The job status and logs
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
    
    // Initialize the cache for this execution if it doesn't exist
    if (!global.executionLogs) {
      global.executionLogs = {};
    }
    
    if (!global.executionLogs[executionName]) {
      global.executionLogs[executionName] = {
        status: 'running',
        logs: [],
        done: false,
        startTime: new Date().toISOString(),
        endTime: null,
        lastLogTimestamp: null,
        lastLogsLength: 0
      };
    }
    
    // Get the client
    const client = await getContainerAppClient();
    
    // Find the actual job execution name from our memory cache
    let actualJobExecutionName = null;
    
    // Check if we have a record of this execution in our global memory
    if (global.executionLogs[executionName] && global.executionLogs[executionName].jobName) {
      actualJobExecutionName = global.executionLogs[executionName].jobName;
      console.log(`Found actual job name in memory: ${actualJobExecutionName} for TD execution: ${executionName}`);
    }
    
    // Debug log to help with troubleshooting
    console.log(`Looking for container job logs for execution: ${executionName}`);
    if (actualJobExecutionName) {
      console.log(`Using actual job execution name from memory: ${actualJobExecutionName}`);
    }
    
    // Add detailed debugging info about what we're retrieving
    console.log(`Retrieving logs for container job:
  Resource Group: ${resourceGroupName}
  Container App Job: ${containerAppJobName}
  Execution Name: ${executionName}
  Actual Job Execution Name: ${actualJobExecutionName || 'unknown'}
`);

    // Find the correct client for job execution operations with list() method
    const jobExecutionsClient = getJobClient(client, 'list');
    
    // Get the execution from the API
    console.log(`Listing all job executions to find match for ${executionName}`);
    const allExecutions = await jobExecutionsClient.list(
      resourceGroupName,
      containerAppJobName
    );
    
    // Find the matching execution
    let execution = null;
    
    if (allExecutions && allExecutions.value && Array.isArray(allExecutions.value)) {
      console.log(`Found ${allExecutions.value.length} total job executions`);
      
      // If we know the actual job execution name, look for it directly
      if (actualJobExecutionName) {
        console.log(`Looking for job with name: ${actualJobExecutionName}`);
        execution = allExecutions.value.find(e => e.name === actualJobExecutionName);
        
        if (execution) {
          console.log(`Found job execution with exact name: ${execution.name}`);
        } else {
          console.log(`Could not find job with exact name: ${actualJobExecutionName}`);
        }
      }
      
      // If we didn't find it or didn't have an actual job name, look for jobs with our environment variables
      if (!execution) {
        console.log(`Looking at all job executions by start time (newest first)...`);
        
        // Sort by start time (newest first)
        allExecutions.value.sort((a, b) => {
          const aTime = a.properties?.startTime ? new Date(a.properties.startTime).getTime() : 0;
          const bTime = b.properties?.startTime ? new Date(b.properties.startTime).getTime() : 0;
          return bTime - aTime; // Sort descending (newest first)
        });
        
        // Get the most recent execution
        if (allExecutions.value.length > 0) {
          execution = allExecutions.value[0];
          console.log(`Using most recent job execution: ${execution.name} (started at ${execution.properties?.startTime})`);
          
          // Store this for future use
          global.executionLogs[executionName].jobName = execution.name;
          console.log(`Stored job name ${execution.name} for future lookups for execution ${executionName}`);
          actualJobExecutionName = execution.name;
        }
      }
    } else {
      console.log(`No job executions found or unexpected response format`);
    }
    
    if (!execution) {
      throw new Error(`Could not find job execution for ${executionName}`);
    }
    
    // Get the execution status
    const status = execution.properties?.status || 'Unknown';
    const isDone = ['Succeeded', 'Failed', 'Canceled', 'Terminated'].includes(status);
    
    // Cache in global memory
    global.executionLogs[executionName].status = status;
    global.executionLogs[executionName].done = isDone;
    
    if (isDone && !global.executionLogs[executionName].endTime) {
      global.executionLogs[executionName].endTime = execution.properties?.endTime || new Date().toISOString();
    }
    
    // Since the SDK doesn't have a direct way to get logs, we'll use the Azure CLI via spawn
    // This is a more robust way to get logs compared to the previous approach
    const util = require('util');
    const { spawn } = require('child_process');
    const containerName = 'template-doctor-aca-job'; // Use the container name from the job template
    
    // Use our Azure CLI logging helper
    try {
      // Get logs using the Azure CLI
      console.log(`Fetching logs for execution ${actualJobExecutionName} using Azure CLI`);
      
      // Prepare the CLI command
      // az containerapp job logs show -n template-doctor-aca-job -g template-doctor-rg --execution template-doctor-aca-job-15wpgb8 --container template-doctor-aca-job
      const args = [
        'containerapp', 'job', 'logs', 'show',
        '-n', containerAppJobName,
        '-g', resourceGroupName,
        '--execution', actualJobExecutionName,
        '--container', containerName,
        '--format', 'json'
      ];
      
      console.log(`Running Azure CLI command: az ${args.join(' ')}`);
      
      // Execute the command
      const azProcess = spawn('az', args, { shell: true });
      
      let stdoutData = '';
      let stderrData = '';
      
      // Collect stdout data
      for await (const chunk of azProcess.stdout) {
        stdoutData += chunk;
      }
      
      // Collect stderr data
      for await (const chunk of azProcess.stderr) {
        stderrData += chunk;
      }
      
      // Wait for process to finish
      const exitCode = await new Promise((resolve) => {
        azProcess.on('close', resolve);
      });
      
      // Handle errors
      if (exitCode !== 0) {
        console.error(`Azure CLI command failed with exit code ${exitCode}`);
        console.error(`STDERR: ${stderrData}`);
        
        // If there's a specific error about no replicas, we should handle it gracefully
        if (stderrData.includes('No replicas found for execution')) {
          console.log('No replicas found for execution. This is common for recently created or completed jobs.');
          
          // Return the execution status without logs
          return {
            status,
            startTime: execution.properties?.startTime,
            endTime: execution.properties?.endTime,
            logs: global.executionLogs[executionName].logs || [],
            done: isDone,
            noReplicas: true
          };
        } else {
          throw new Error(`Failed to get logs from Azure CLI: ${stderrData}`);
        }
      }
      
      // Parse logs (if available)
      if (stdoutData) {
        try {
          const logData = JSON.parse(stdoutData);
          
          if (Array.isArray(logData)) {
            // Process log entries
            const newLogs = logData.map(entry => ({
              timestamp: Date.now(),
              time: new Date().toISOString(),
              message: entry
            }));
            
            // Only add new logs if we have any
            if (newLogs.length > 0) {
              // Store the logs in global memory
              if (!global.executionLogs[executionName].logs) {
                global.executionLogs[executionName].logs = [];
              }
              
              // Append new logs
              global.executionLogs[executionName].logs.push(...newLogs);
              global.executionLogs[executionName].lastLogTimestamp = Date.now();
              global.executionLogs[executionName].lastLogsLength = global.executionLogs[executionName].logs.length;
              
              console.log(`Added ${newLogs.length} new log entries for execution ${executionName}`);
            } else {
              console.log(`No new logs found for execution ${executionName}`);
            }
          }
        } catch (parseError) {
          console.error(`Error parsing log output: ${parseError.message}`);
          // Store the raw output as a single log entry if we can't parse it
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            time: new Date().toISOString(),
            message: stdoutData
          });
        }
      } else {
        console.log(`No log output received for execution ${executionName}`);
      }
    } catch (cliError) {
      console.error(`Error running Azure CLI for logs: ${cliError.message}`);
      
      // If the CLI approach fails, fall back to a simulated approach with status messages
      if (global.executionLogs[executionName].logs.length === 0) {
        // Add a fallback message if we have no logs at all
        global.executionLogs[executionName].logs.push({
          timestamp: Date.now(),
          time: new Date().toISOString(),
          message: `[Log retrieval] Container job ${actualJobExecutionName} is in status: ${status}`
        });
        
        if (isDone) {
          // Add a completion message
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            time: new Date().toISOString(),
            message: `[Log retrieval] Container job ${actualJobExecutionName} completed with status: ${status}`
          });
        }
      }
    }
    
    // Try alternate method: Azure Monitor logs if we have Log Analytics workspace info
    const logAnalyticsWorkspace = process.env.LOG_ANALYTICS_WORKSPACE;
    const logAnalyticsWorkspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
    
    if (logAnalyticsWorkspace && logAnalyticsWorkspaceId && !isDone &&
        global.executionLogs[executionName].logs.length === 0) {
      console.log(`Trying Log Analytics for logs for execution ${actualJobExecutionName}`);
      
      try {
        // Query Log Analytics for container logs
        const kusto = `
          ContainerAppConsoleLogs_CL
          | where ContainerAppName_s == "${containerAppJobName}"
          | where ContainerName_s == "${containerName}"
          | where ExecutionName_s == "${actualJobExecutionName}"
          | project TimeGenerated, Log_s
          | order by TimeGenerated asc
        `;
        
        const logArgs = [
          'monitor', 'log-analytics', 'query',
          '--workspace', logAnalyticsWorkspaceId,
          '--analytics-query', kusto,
          '--output', 'json'
        ];
        
        console.log(`Running Azure Log Analytics query: az ${logArgs.join(' ')}`);
        
        const logProcess = spawn('az', logArgs, { shell: true });
        
        let logStdout = '';
        let logStderr = '';
        
        // Collect stdout data
        for await (const chunk of logProcess.stdout) {
          logStdout += chunk;
        }
        
        // Collect stderr data
        for await (const chunk of logProcess.stderr) {
          logStderr += chunk;
        }
        
        // Wait for process to finish
        const logExitCode = await new Promise((resolve) => {
          logProcess.on('close', resolve);
        });
        
        if (logExitCode === 0 && logStdout) {
          // Parse logs
          try {
            const logResults = JSON.parse(logStdout);
            
            if (Array.isArray(logResults) && logResults.length > 0) {
              // Process log entries
              const newLogs = logResults.map(entry => ({
                timestamp: Date.now(),
                time: entry.TimeGenerated || new Date().toISOString(),
                message: entry.Log_s
              }));
              
              // Only add new logs if we have any
              if (newLogs.length > 0) {
                // Store the logs in global memory
                if (!global.executionLogs[executionName].logs) {
                  global.executionLogs[executionName].logs = [];
                }
                
                // Append new logs
                global.executionLogs[executionName].logs.push(...newLogs);
                global.executionLogs[executionName].lastLogTimestamp = Date.now();
                global.executionLogs[executionName].lastLogsLength = global.executionLogs[executionName].logs.length;
                
                console.log(`Added ${newLogs.length} log entries from Log Analytics for execution ${executionName}`);
              } else {
                console.log(`No new logs found in Log Analytics for execution ${executionName}`);
              }
            }
          } catch (parseError) {
            console.error(`Error parsing Log Analytics output: ${parseError.message}`);
          }
        } else {
          console.log(`Log Analytics query failed or returned no results: ${logStderr}`);
        }
      } catch (logAnalyticsError) {
        console.error(`Error querying Log Analytics: ${logAnalyticsError.message}`);
      }
    }
    
    // Return the execution status and logs
    return {
      status,
      startTime: execution.properties?.startTime,
      endTime: execution.properties?.endTime,
      logs: global.executionLogs[executionName].logs || [],
      done: isDone
    };
  } catch (error) {
    console.error(`Error getting container job logs: ${error.message}`);
    console.error(`Error details:`, {
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      stack: error.stack,
    });
    
    // Return an error status with any logs we might have
    if (global.executionLogs && global.executionLogs[executionName]) {
      return {
        status: 'Error',
        startTime: global.executionLogs[executionName].startTime,
        endTime: new Date().toISOString(),
        logs: global.executionLogs[executionName].logs || [],
        done: true,
        error: error.message
      };
    }
    
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
    
    // Find the correct client for job execution operations with list() method
    const jobExecutionsClient = getJobClient(client, 'list');
    
    // Find the actual job execution name from our memory cache
    let actualJobExecutionName = null;
    
    // Check if we have a record of this execution in our global memory
    if (global.executionLogs && global.executionLogs[executionName] && global.executionLogs[executionName].jobName) {
      actualJobExecutionName = global.executionLogs[executionName].jobName;
      console.log(`Found actual job name in memory: ${actualJobExecutionName} for TD execution: ${executionName}`);
    }
    
    console.log(`Attempting to stop container job execution for: ${executionName}`);
    
    // Debug information
    console.log(`Stop job request details:
  Resource Group: ${resourceGroupName}
  Container App Job: ${containerAppJobName}
  Execution Name: ${executionName}
  Actual Job Execution Name: ${actualJobExecutionName || 'unknown'}
`);

    // Since we don't have direct get() method, we need to:
    // 1. List all job executions
    // 2. Find the one that matches our execution name
    console.log(`Listing all job executions to find match for ${executionName}`);
    const allExecutions = await jobExecutionsClient.list(
      resourceGroupName,
      containerAppJobName
    );
    
    // Find the matching execution
    let execution = null;
    let actualExecutionName = null;
    
    if (allExecutions && allExecutions.value && Array.isArray(allExecutions.value)) {
      console.log(`Found ${allExecutions.value.length} total job executions`);
      
      // If we know the actual job execution name, look for it directly
      if (actualJobExecutionName) {
        console.log(`Looking for job with name: ${actualJobExecutionName}`);
        execution = allExecutions.value.find(e => e.name === actualJobExecutionName);
        
        if (execution) {
          console.log(`Found job execution with exact name: ${execution.name}`);
          actualExecutionName = execution.name;
        } else {
          console.log(`Could not find job with exact name: ${actualJobExecutionName}`);
        }
      }
      
      // If we didn't find it or didn't have an actual job name, look for the most recent job
      if (!execution) {
        console.log(`Looking at all job executions by start time (newest first)...`);
        
        // Sort by start time (newest first)
        allExecutions.value.sort((a, b) => {
          const aTime = a.properties?.startTime ? new Date(a.properties.startTime).getTime() : 0;
          const bTime = b.properties?.startTime ? new Date(b.properties.startTime).getTime() : 0;
          return bTime - aTime; // Sort descending (newest first)
        });
        
        // Get the most recent execution
        if (allExecutions.value.length > 0) {
          execution = allExecutions.value[0];
          actualExecutionName = execution.name;
          console.log(`Using most recent job execution: ${execution.name} (started at ${execution.properties?.startTime})`);
          
          // Store this for future use
          if (global.executionLogs && global.executionLogs[executionName]) {
            global.executionLogs[executionName].jobName = execution.name;
            console.log(`Stored job name ${execution.name} for future lookups for execution ${executionName}`);
          }
        }
      }
    }
    
    if (!execution) {
      throw new Error(`Could not find job execution for ${executionName}`);
    }
    
    // Check if the job is already done
    const status = execution.properties?.status || 'Unknown';
    const isDone = ['Succeeded', 'Failed', 'Canceled', 'Terminated'].includes(status);
    
    if (isDone) {
      console.log(`Job execution ${actualExecutionName} is already in final state: ${status}`);
      
      return {
        status,
        startTime: execution.properties?.startTime,
        endTime: execution.properties?.endTime,
        done: true
      };
    }
    
    // If the job is still running, check if we have the cancel method
    const cancelClient = getJobClient(client, 'cancel');
    
    // If we found a client with cancel method, use it
    if (cancelClient) {
      console.log(`Found client with cancel method, attempting to cancel job: ${actualExecutionName}`);
      
      try {
        // Call the appropriate cancel method
        if (methodExists(cancelClient, 'beginCancelAndWait')) {
          await cancelClient.beginCancelAndWait(
            resourceGroupName,
            containerAppJobName,
            actualExecutionName
          );
        } else if (methodExists(cancelClient, 'cancelAndWait')) {
          await cancelClient.cancelAndWait(
            resourceGroupName,
            containerAppJobName,
            actualExecutionName
          );
        } else if (methodExists(cancelClient, 'beginCancel')) {
          const poller = await cancelClient.beginCancel(
            resourceGroupName,
            containerAppJobName,
            actualExecutionName
          );
          await poller.pollUntilDone();
        } else if (methodExists(cancelClient, 'cancel')) {
          await cancelClient.cancel(
            resourceGroupName,
            containerAppJobName,
            actualExecutionName
          );
        }
        
        console.log(`Successfully sent cancel request for job execution: ${actualExecutionName}`);
        
        // Wait a bit and get the updated status
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the latest list of executions
        const updatedExecutions = await jobExecutionsClient.list(
          resourceGroupName,
          containerAppJobName
        );
        
        // Find the job again
        const updatedExecution = updatedExecutions.value.find(e => e.name === actualExecutionName);
        
        if (updatedExecution) {
          console.log(`Updated job status: ${updatedExecution.properties?.status || 'Unknown'}`);
          
          return {
            status: updatedExecution.properties?.status || 'Canceled',
            startTime: updatedExecution.properties?.startTime,
            endTime: updatedExecution.properties?.endTime || new Date().toISOString(),
            done: true
          };
        }
      } catch (cancelError) {
        console.error(`Error cancelling job: ${cancelError.message}`);
        throw new Error(`Could not cancel job execution: ${cancelError.message}`);
      }
    } else {
      console.log(`No client with cancel method found. Cannot cancel job: ${actualExecutionName}`);
      throw new Error(`Could not find method to cancel job execution`);
    }
    
    // If we can't get updated status, return the original status
    return {
      status: 'CancelRequested',
      startTime: execution.properties?.startTime,
      endTime: new Date().toISOString(),
      done: true
    };
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
