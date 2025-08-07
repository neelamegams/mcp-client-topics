## MCP Client

- This tool calls the MCP server
- The .env file and .aicore-config.json setup does not work for SAP Cloud AI SDK(JS)
- Use this tool in hybrid mode for testing, ie run these commands
  - cf l -a https://api.cf.us10.hana.ondemand.com
  - cds bind -a default_aicore
  - cds watch --profile hybrid
- Launch the browser and access the service to trigger the call to AI Core service