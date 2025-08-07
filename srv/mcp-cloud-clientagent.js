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

  const mcpTool = {
    name: 'get-topic-by-keyword',
    arguments: { keyword: 'joule' }
  };

  // Example: you can call the tool and get the result
//   const mcpToolResult = await client.callTool(mcpTool);
//   console.log('MCP Tool Result:', mcpToolResult.content);

  // You can now use mcpToolResult.content in your workflow/tools if needed
  // For demonstration, we'll just use a minimal agent

  const model = new AzureOpenAiChatClient({
    modelName: 'gpt-4o-mini',
    resourceGroup: 'team-blr',
    deploymentId: 'dab5e8bc05fc825c'
  });

//   const tools = [];
//   const toolNode = new ToolNode(tools);

  async function askHuman() {
    const humanResponse = interrupt('Do you want to show the titles that only involve Skills?');
    return { messages: [new HumanMessage(humanResponse)] };
  }

  async function callModel({ messages }) {
    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  async function callMcpTool({ messages }) {
    const result = await client.callTool(mcpTool);
    // Flatten array of {type, text} to a string
    let content = result.content;
    if (Array.isArray(content)) {
        content = content.map(item => item.text).join('\n');
    }
    return { messages: [new SystemMessage(content)] };
}

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('callMcpTool', callMcpTool)
    //.addNode('askHuman', askHuman)
    .addEdge(START, 'agent')
    .addEdge('agent', 'callMcpTool')
    .addEdge('callMcpTool', END);

  const memory = new MemorySaver();
  const app = workflow.compile({ checkpointer: memory });
  const config = { configurable: { thread_id: 'conv-1' } };

  const initMessages = [
    new SystemMessage(
      `You are a CAP Agent that talks to a CAP application and retrieves information from a OData service about Devtoberfest Topics.`
    ),
    new HumanMessage("Can you get me the Devtoberfest topic titles that talk about Joule?")
  ];

  try {
    let response = await app.invoke({ messages: initMessages }, config);
    console.log('Assistant:', response.messages.at(-1)?.content);
    console.log('next: ', (await app.getState(config)).next);

    response = await app.invoke(
      new Command({ resume: 'Can you suggest the topics that talk specifically about Agents?' }),
      config
    );
    console.log('Assistant:', response.messages.at(-1)?.content);

    response = await app.invoke(
      new Command({ resume: 'Great! Looks perfect' }),
      config
    );
    console.log('Assistant:', response.messages.at(-1)?.content);
  } catch (error) {
    console.error('Error:', error);
  }
})();