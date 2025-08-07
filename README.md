## MCP Client

- This tool calls the MCP server
- The .env file and .aicore-config.json setup does not work for SAP Cloud AI SDK(JS)
- Use this tool in hybrid mode for testing, ie run these commands
  - cf l -a https://api.cf.us10.hana.ondemand.com
  - cds bind -a default_aicore

## Start the client
`cds watch --profile hybrid`
The results will be shown in the console.

## References

https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients
https://sap.github.io/ai-sdk/docs/js/tutorials/getting-started-with-agents
https://www.npmjs.com/package/@gavdi/cap-mcp
https://github.com/gavdilabs/cap-mcp-plugin
https://medium.com/@simonvlaursen/introducing-cap-mcp-transform-your-sap-applications-into-ai-ready-systems-410a01fda5aa
https://modelcontextprotocol.io/quickstart/client
https://pages.github.tools.sap/btp-ai/mcp-plugin/docs/how-to-run