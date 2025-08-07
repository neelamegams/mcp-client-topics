service MCPToolClientService {
  //function callMCPTool(logs: String) returns Array of AnalysisResult;
}

type AnalysisResult {
  error: String;
  analysis: String;
}