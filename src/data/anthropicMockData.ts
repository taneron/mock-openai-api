import { MockModel } from "../types";
import { markdownTestCases, echoTestCases } from './testCases';

export const anthropicMockModels: MockModel[] = [
  {
    id: "mock-claude-markdown",
    name: "Mock Claude Markdown Sample",
    description: "Pure text model specialized in outputting standard Markdown format, does not support function calling, focuses on content display and UI debugging",
    type: "markdown",
    testCases: markdownTestCases
  },
  {
    id: "mocked-claude-echo",
    name: "Mock Claude Echo",
    description: "Model that echoes back the system and user prompts, useful for debugging input processing",
    type: "echo",
    testCases: echoTestCases
  }
]
