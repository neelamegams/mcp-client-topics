require('dotenv').config();
let AzureOpenAiChatClient;

const credentials = {
  clientId: process.env.AI_CORE_CLIENT_ID,
  clientSecret: process.env.AI_CORE_CLIENT_SECRET,
  apiURL : process.env.AI_CORE_API_URL,
  tokenServiceUrl: process.env.AI_CORE_TOKEN_URL,
  resourceGroup: process.env.AI_CORE_RESOURCE_GROUP
};

async function analyzeWithAICore(errorMessage) {

    if (!AzureOpenAiChatClient) {
        ({ AzureOpenAiChatClient } = await import("@sap-ai-sdk/foundation-models"));
    }

    const chatClient = new AzureOpenAiChatClient(
      { modelName: 'gpt-4o-mini', 
        resourceGroup: credentials.resourceGroup, 
        deploymentId: 'dab5e8bc05fc825c' 
      }
    );

    const response = await chatClient.run({
        messages: [
          {
            role: "user",
            content: "Identify the cause and propose solutions for the following error from Cloud Foundry deployment " + errorMessage
          },
        ],
    });
    console.log(response.getContent());
    return response.getContent();
}

// module.exports = cds.service.impl(async function () {
//   this.on("callMCPTool", async (req) => {
//           const error = "Error: Failed to deploy the application due to missing environment variables.";
//             try {
//                 // Ensure AzureOpenAiChatClient is loaded for each CLI run
//                 const result = await analyzeWithAICore(error);
//                 console.log(`Error: ${error}\nAI Core Analysis: ${result}\n`);
//             } catch (err) {
//                 console.error(`Error analyzing: ${error}\n${err.message}\n`);
//             }
//   });
// });


if (require.main === module) {
    (async () => {
            const error = "Error: Failed to deploy the application due to missing environment variables.";
            try {
                // Ensure AzureOpenAiChatClient is loaded for each CLI run
                const result = await analyzeWithAICore(error);
                console.log(`Error: ${error}\nAI Core Analysis: ${result}\n`);
            } catch (err) {
                console.error(`Error analyzing: ${error}\n${err.message}\n`);
            }
    })();
}