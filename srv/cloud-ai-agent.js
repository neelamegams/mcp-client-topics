const {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
  START,
  END,
  interrupt,
  Command
} = require('@langchain/langgraph');
const { ToolNode } = require('@langchain/langgraph/prebuilt');
const { AzureOpenAiChatClient } = require('@sap-ai-sdk/langchain');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');


// This example demonstrates how to create a travel itinerary assistant using LangGraph.
// The assistant can check the weather and recommend restaurants based on the city provided.
// It uses tools to fetch weather and restaurant data, and maintains conversation context.

const mockWeatherData = {
  paris: { temperature: '22°C', condition: 'Mild and pleasant' },
  reykjavik: { temperature: '3°C', condition: 'Cold and windy' }
};

const mockRestaurantData = {
  paris: ['Le Comptoir du Relais', "L'As du Fallafel", 'Breizh Café'],
  reykjavik: ['Dill Restaurant', 'Fish Market', 'Grillmarkaðurinn']
};

const getWeatherTool = tool(
  async ({ city }) => {
    const weather = mockWeatherData[city.toLowerCase()];
    return weather
      ? `Current weather in ${city}: ${weather.temperature}, ${weather.condition}`
      : `Weather data not available for ${city}.`;
  },
  {
    name: 'get_weather',
    description: 'Get current weather information for a city',
    schema: z.object({ city: z.string().describe('The city name') })
  }
);

const getRestaurantsTool = tool(
  async ({ city }) => {
    const restaurants = mockRestaurantData[city.toLowerCase()];
    return restaurants
      ? `Popular restaurants in ${city}: ${restaurants.join(', ')}`
      : `No restaurant data available for ${city}.`;
  },
  {
    name: 'get_restaurants',
    description: 'Get restaurant recommendations for a city',
    schema: z.object({ city: z.string().describe('The city name') })
  }
);

const tools = [getWeatherTool, getRestaurantsTool];
const toolNode = new ToolNode(tools);

const model = new AzureOpenAiChatClient({
    modelName: 'gpt-4o-mini', 
    resourceGroup: 'team-blr', 
    deploymentId: 'dab5e8bc05fc825c'
});

const modelWithTools = model.bindTools(tools);

async function shouldContinueAgent({ messages }) {
  const lastMessage = messages.at(-1);
  if (lastMessage.tool_calls?.length) {
    return 'tools';
  }
  const result = await model.invoke([
    new SystemMessage(
      'You are a classifier. Respond with exactly "FAREWELL" if this is a farewell/goodbye message wishing someone happy travels. Respond with exactly "CONTINUE" if the conversation should continue.'
    ),
    new HumanMessage(`Assistant message: "${lastMessage.content}"`)
  ]);
  return result.content === 'FAREWELL' ? END : 'askHuman';
}

async function askHuman() {
  const humanResponse = interrupt('Do you want to adjust the itinerary?');
  return { messages: [new HumanMessage(humanResponse)] };
}

async function callModel({ messages }) {
  const response = await modelWithTools.invoke(messages);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', toolNode)
  .addNode('askHuman', askHuman)
  .addConditionalEdges('agent', shouldContinueAgent, ['tools', 'askHuman', END])
  .addEdge('tools', 'agent')
  .addEdge('askHuman', 'agent')
  .addEdge(START, 'agent');

const memory = new MemorySaver();
const app = workflow.compile({ checkpointer: memory });
const config = { configurable: { thread_id: 'conv-1' } };

const initMessages = [
  new SystemMessage(
    `You are a helpful travel assistant.  \nYou will generate a 3-item itinerary based on a provided city. You should use weather forecast and restaurant recommendations when creating the itinerary.\nAfter presenting the itinerary, ask the user if they are satisfied with it or if they want to make changes.`
  ),
  new HumanMessage("I'm traveling to Paris. Can you help me prepare an itinerary?")
];

// (async () => {
//   try {
//     let response = await app.invoke({ messages: initMessages }, config);
//     console.log('Assistant:', response.messages.at(-1)?.content);
//     console.log('next: ', (await app.getState(config)).next);

//     response = await app.invoke(
//       new Command({ resume: 'Can you suggest something more outdoorsy?' }),
//       config
//     );
//     console.log('Assistant:', response.messages.at(-1)?.content);

//     response = await app.invoke(
//       new Command({ resume: 'Great! Looks perfect' }),
//       config
//     );
//     console.log('Assistant:', response.messages.at(-1)?.content);
//   } catch (error) {
//     console.error('Error:', error);
//   }
// })();