const { ContainerAppsAPIClient } = require('@azure/arm-appcontainers');

// Create a simple client instance to inspect its structure
const dummyClient = new ContainerAppsAPIClient({ credential: { getToken: () => {} }}, "subscription-id");

// Print the available properties on the client
console.log("Available properties on ContainerAppsAPIClient:");
console.log(Object.keys(dummyClient));

// Check if containerJobExecutions exists
if (dummyClient.containerJobExecutions) {
    console.log("\ncontainerJobExecutions exists and contains methods:");
    console.log(Object.keys(dummyClient.containerJobExecutions));
} else {
    console.log("\ncontainerJobExecutions does NOT exist!");
    
    // Look for similar properties that might be named differently
    const jobRelatedProps = Object.keys(dummyClient).filter(key => 
        key.toLowerCase().includes('job') || 
        key.toLowerCase().includes('execution') || 
        key.toLowerCase().includes('container')
    );
    
    console.log("\nPossible job-related properties:");
    console.log(jobRelatedProps);
}
