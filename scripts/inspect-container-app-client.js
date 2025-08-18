#!/usr/bin/env node

/**
 * Diagnostic script to check the ContainerAppsAPIClient methods
 * Enhanced to provide detailed information about available job execution methods
 */

const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');
const { DefaultAzureCredential } = require('@azure/identity');

async function inspectClient() {
  try {
    // Check if environment variables are set
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.ACA_RESOURCE_GROUP;
    const containerAppJobName = process.env.ACA_JOB_NAME;

    if (!subscriptionId) {
      console.error('Error: AZURE_SUBSCRIPTION_ID environment variable is not set');
      process.exit(1);
    }

    // Create a DefaultAzureCredential
    console.log('Creating DefaultAzureCredential...');
    const credential = new DefaultAzureCredential();
    
    // Create the ContainerAppsAPIClient
    console.log(`Creating ContainerAppsAPIClient with subscription ID: ${subscriptionId}...`);
    const client = new ContainerAppsAPIClient(credential, subscriptionId);
    
    // Helper function to inspect object properties
    function inspectObject(obj, prefix = '', maxDepth = 2, currentDepth = 0) {
      if (!obj) {
        console.log(`${prefix} is null or undefined`);
        return;
      }
      
      // Get all properties, including non-enumerable ones
      const properties = Object.getOwnPropertyNames(obj);
      
      // Filter out properties from Object.prototype
      const uniqueProperties = properties.filter(
        prop => !Object.getOwnPropertyNames(Object.prototype).includes(prop)
      );
      
      console.log(`${prefix} has ${uniqueProperties.length} properties/methods`);
      
      uniqueProperties.forEach(prop => {
        try {
          // Skip internal properties
          if (prop.startsWith('_')) return;
          
          const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
          const type = typeof obj[prop];
          
          if (type === 'function') {
            // Get function parameters if possible
            let params = '';
            try {
              const funcStr = obj[prop].toString();
              const argsMatch = funcStr.match(/\(([^)]*)\)/);
              if (argsMatch && argsMatch[1]) {
                params = argsMatch[1];
              }
            } catch (e) {
              params = '(unable to determine parameters)';
            }
            
            console.log(`${prefix}.${prop}(${params}) (function)`);
          } else if (type === 'object' && obj[prop] !== null) {
            console.log(`${prefix}.${prop} (object)`);
            // Recursively inspect objects, but avoid circular references
            if (currentDepth < maxDepth) {
              inspectObject(obj[prop], `${prefix}.${prop}`, maxDepth, currentDepth + 1);
            }
          } else {
            console.log(`${prefix}.${prop} (${type}) = ${obj[prop]}`);
          }
        } catch (e) {
          console.log(`${prefix}.${prop} (error accessing property: ${e.message})`);
        }
      });
      
      // Check for prototype methods as well
      if (currentDepth === 0) {
        const proto = Object.getPrototypeOf(obj);
        if (proto && proto !== Object.prototype) {
          const protoProps = Object.getOwnPropertyNames(proto).filter(
            prop => !Object.getOwnPropertyNames(Object.prototype).includes(prop) && !prop.startsWith('_')
          );
          
          if (protoProps.length > 0) {
            console.log(`\n${prefix} prototype has ${protoProps.length} properties/methods:`);
            protoProps.forEach(prop => {
              try {
                const type = typeof proto[prop];
                if (type === 'function') {
                  console.log(`${prefix}.prototype.${prop} (function)`);
                } else {
                  console.log(`${prefix}.prototype.${prop} (${type}) = ${proto[prop]}`);
                }
              } catch (e) {
                console.log(`${prefix}.prototype.${prop} (error accessing property: ${e.message})`);
              }
            });
          }
        }
      }
    }
    
    // Inspect the client properties
    console.log('\nInspecting ContainerAppsAPIClient properties:');
    inspectObject(client, 'client');
    
    // Check for specific job-related client objects
    const jobClientCandidates = [
      { name: 'jobsExecutions', client: client.jobsExecutions },
      { name: 'containerJobsExecutions', client: client.containerJobsExecutions },
      { name: 'containerAppsJobs', client: client.containerAppsJobs }
    ];
    
    console.log('\nChecking for job execution client objects:');
    const availableClients = jobClientCandidates.filter(c => c.client);
    
    if (availableClients.length === 0) {
      console.log('No job execution client objects found!');
      
      // Check other similar properties
      console.log('\nLooking for similar properties:');
      const properties = Object.getOwnPropertyNames(client);
      const similarProps = properties.filter(prop => 
        !prop.startsWith('_') &&
        (prop.toLowerCase().includes('job') || 
         prop.toLowerCase().includes('execut') ||
         prop.toLowerCase().includes('container'))
      );
      
      if (similarProps.length > 0) {
        console.log('Found similar properties:');
        similarProps.forEach(prop => {
          console.log(`- client.${prop}`);
          if (typeof client[prop] === 'object' && client[prop] !== null) {
            inspectObject(client[prop], `client.${prop}`, 1);
          }
        });
      } else {
        console.log('No similar properties found.');
      }
    } else {
      console.log(`Found ${availableClients.length} job execution client objects`);
      
      // Inspect each available client
      availableClients.forEach(({ name, client: jobClient }) => {
        console.log(`\nInspecting client.${name}:`);
        inspectObject(jobClient, `client.${name}`);
        
        // Look for essential methods
        const essentialMethods = ['get', 'list', 'listLogs', 'beginCancel', 'cancel', 'beginCancelAndWait'];
        const availableMethods = essentialMethods.filter(method => typeof jobClient[method] === 'function');
        
        console.log(`\nEssential methods available on client.${name}:`);
        if (availableMethods.length > 0) {
          availableMethods.forEach(method => {
            console.log(`- ${method}`);
          });
        } else {
          console.log('None of the essential methods were found');
        }
      });
    }
    
    // Try to list job executions if resourceGroup and job name are provided
    if (resourceGroupName && containerAppJobName) {
      console.log('\nAttempting to list job executions:');
      console.log(`Resource Group: ${resourceGroupName}`);
      console.log(`Container App Job: ${containerAppJobName}`);
      
      let listed = false;
      
      // Try with each available client
      for (const { name, client: jobClient } of availableClients) {
        if (typeof jobClient.list === 'function') {
          try {
            console.log(`\nUsing client.${name}.list()...`);
            const executions = await jobClient.list(resourceGroupName, containerAppJobName);
            
            console.log(`Successfully listed job executions with client.${name}.list()`);
            if (executions && Array.isArray(executions)) {
              console.log(`Found ${executions.length} executions`);
              
              executions.forEach((execution, i) => {
                console.log(`\nExecution ${i + 1}:`);
                console.log(`Name: ${execution.name}`);
                console.log(`ID: ${execution.id}`);
                console.log(`Status: ${execution.properties?.status || 'unknown'}`);
                console.log(`Start Time: ${execution.properties?.startTime || 'unknown'}`);
                console.log(`End Time: ${execution.properties?.endTime || 'unknown'}`);
              });
              
              listed = true;
              break;
            } else {
              console.log('No executions found or unexpected response format');
            }
          } catch (error) {
            console.error(`Error listing with client.${name}.list():`, error.message);
          }
        }
      }
      
      if (!listed) {
        console.log('Could not list job executions with any available client');
      }
    }
    
    // Print version information
    console.log('\nModule information:');
    try {
      const appContainersPackage = require('@azure/arm-appcontainers/package.json');
      console.log(`@azure/arm-appcontainers version: ${appContainersPackage.version}`);
    } catch (e) {
      console.log('Could not determine @azure/arm-appcontainers version');
    }
    
    // Print recommendations
    console.log('\nRecommendations:');
    if (availableClients.length > 0) {
      const bestClient = availableClients[0];
      console.log(`1. Use client.${bestClient.name} for job execution operations`);
      
      // Check if methods exist
      if (typeof bestClient.client.get === 'function') {
        console.log('2. Use .get() to get job execution details');
      } else {
        console.log('2. WARNING: No .get() method found to retrieve job execution details');
      }
      
      if (typeof bestClient.client.listLogs === 'function') {
        console.log('3. Use .listLogs() to retrieve job logs');
      } else {
        console.log('3. WARNING: No .listLogs() method found to retrieve job logs');
      }
      
      // Check for cancel methods
      const cancelMethods = ['beginCancelAndWait', 'cancelAndWait', 'beginCancel', 'cancel']
        .filter(method => typeof bestClient.client[method] === 'function');
      
      if (cancelMethods.length > 0) {
        console.log(`4. Use .${cancelMethods[0]}() to cancel a job execution`);
      } else {
        console.log('4. WARNING: No cancel method found to stop job executions');
      }
    } else {
      console.log('No job execution client objects found - you may need to update the SDK');
    }
    
  } catch (error) {
    console.error('Error inspecting ContainerAppsAPIClient:', error);
  }
}

// Run the inspection
inspectClient().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
