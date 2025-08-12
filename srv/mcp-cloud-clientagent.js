import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
  START,
  END,
  interrupt,
  Command
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AzureOpenAiChatClient } from '@sap-ai-sdk/langchain';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

(async () => {
  const client = new Client({ name: 'my-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost:4004/mcp/'));
  await client.connect(transport);




  // Example: you can call the tool and get the result
//   const mcpToolResult = await client.callTool(mcpTool);
//   console.log('MCP Tool Result:', mcpToolResult.content);

  // You can now use mcpToolResult.content in your workflow/tools if needed
  // For demonstration, we'll just use a minimal agent



  async function askHuman() {
    console.log('Asking human for input...')
    const humanResponse = interrupt('Do you want to show the titles that only involve Skills?');
    return { messages: [new HumanMessage(humanResponse)] };
  }

  async function callModel({ messages }) {
    const response = await modelWithTools.invoke(messages);
    return { messages: [response] };
  }

  const mcpTool = {
    name: 'get-topic-by-keyword',
    arguments: { keyword: 'joule' }
  };

  async function callMcpTool({ messages }) {
    //console.log('Calling MCP Tool with messages:', messages)
    const result = await client.callTool(mcpTool);
    // Flatten array of {type, text} to a string
    let content = result.content;
    if (Array.isArray(content)) {
        content = content.map(item => item.text).join('\n');
    }
    //console.log('MCP Tool Result:', content);
    return { messages: [new SystemMessage(content)] };
}

  const getDevtoberfestDataTool = tool(
    async ({ keyword }) => {
      const result = await client.callTool({
        name: 'get-topic-by-keyword',
        arguments: { keyword }
      });
      return result.content;
    },
    {
      name: 'get_devtoberfest_data',
      description: 'Get Devtoberfest topics by keyword',
      schema: z.object({ keyword: z.string().describe('The keyword to search for') })
    }
  );
 

  const tools = [getDevtoberfestDataTool];
  const toolNode = new ToolNode(tools);

  const model = new AzureOpenAiChatClient({
    modelName: 'gpt-4o-mini',
    resourceGroup: 'team-blr',
    deploymentId: 'dab5e8bc05fc825c'
  });

  // create a model with access to the tools
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
      `You are a CAP Agent that talks to a CAP OData service and retrieves information from the service about Devtoberfest Topics.`
    ),
    new HumanMessage("Can you get me the Devtoberfest topic titles that talks about Joule?")
  ];

  try {
    let response = await app.invoke({ messages: initMessages }, config);
    console.log('showing responses for topics that talk about Joule');
    console.log('Assistant:', response.messages.at(-1)?.content);
    console.log('next: ', (await app.getState(config)).next);

    response = await app.invoke(
      new Command({ resume: 'Can you suggest the topics that talk specifically about Agents?' }),
      config
    );
    console.log('showing responses for topics that talk about Agents');
    console.log('Assistant:', response.messages.at(-1)?.content);

    // response = await app.invoke(
    //   new Command({ resume: 'Great! Looks perfect' }),
    //   config
    // );
    // console.log('Assistant:', response.messages.at(-1)?.content);
  } catch (error) {
    console.error('Error:', error);
  }
})();