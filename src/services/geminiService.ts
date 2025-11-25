import { 
  GeminiGenerateContentRequest, 
  GeminiGenerateContentResponse, 
  GeminiModelsResponse, 
  GeminiStreamResponse,
  GeminiErrorResponse 
} from '../types/gemini';
import { geminiMockModels } from '../data/geminiMockData';
import { markdownTestCases } from '../data/testCases';
import { findGeminiModelById } from '../utils/geminiHelpers';

/**
 * Get Gemini model list
 */
export function getGeminiModels(): GeminiModelsResponse {
  const models = geminiMockModels.map(model => ({
    name: `models/${model.id}`,
    version: "001",
    displayName: model.name,
    description: model.description,
    inputTokenLimit: 30720,
    outputTokenLimit: 2048,
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
    temperature: 0.9,
    topP: 1.0,
    topK: 1
  }));

  return { models };
}

/**
 * Build echo response content from Gemini request
 */
function buildGeminiEchoContent(request: GeminiGenerateContentRequest): string {
  let echoContent = "# Echo Response\n\n";
  
  // Gemini doesn't have a separate system prompt, but we can look for "system" role content
  const systemContents = request.contents.filter(c => c.role === 'system');
  if (systemContents.length > 0) {
    echoContent += "## System Prompt\n\n";
    systemContents.forEach(content => {
      content.parts.forEach(part => {
        if (part.text) {
          echoContent += part.text + "\n\n";
        }
      });
    });
  }
  
  // Handle user messages
  const userContents = request.contents.filter(c => c.role === 'user' || !c.role);
  if (userContents.length > 0) {
    echoContent += "## User Messages\n\n";
    userContents.forEach((content, index) => {
      echoContent += `### Message ${index + 1}\n\n`;
      content.parts.forEach(part => {
        if (part.text) {
          echoContent += part.text + "\n\n";
        }
      });
    });
  }
  
  return echoContent;
}

/**
 * Generate content (non-streaming)
 */
export function generateContent(request: GeminiGenerateContentRequest, modelId?: string): GeminiGenerateContentResponse | GeminiErrorResponse {
  // Validate request
  if (!request.contents || request.contents.length === 0) {
    return {
      error: {
        code: 400,
        message: "Request must contain at least one content item",
        status: "INVALID_ARGUMENT"
      }
    };
  }

  // Get the latest user message
  const lastContent = request.contents[request.contents.length - 1];
  const userText = lastContent.parts.map(part => part.text || '').join(' ');

  // Check if this is an echo model
  const model = modelId ? findGeminiModelById(modelId) : null;
  let responseText: string;
  
  if (model && model.type === 'echo') {
    responseText = buildGeminiEchoContent(request);
  } else {
    // Use the first test case from markdown test cases
    const testCase = markdownTestCases[0];
    responseText = testCase.response;
  }
  
  const promptTokenCount = Math.ceil(userText.length / 4);
  const candidatesTokenCount = Math.ceil(responseText.length / 4);

  return {
    candidates: [{
      content: {
        parts: [{
          text: responseText
        }],
        role: "model"
      },
      finishReason: "STOP",
      index: 0,
      safetyRatings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          probability: "NEGLIGIBLE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          probability: "NEGLIGIBLE"
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          probability: "NEGLIGIBLE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          probability: "NEGLIGIBLE"
        }
      ]
    }],
    usageMetadata: {
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount: promptTokenCount + candidatesTokenCount
    }
  };
}

/**
 * Generate content (streaming)
 */
export function* streamGenerateContent(request: GeminiGenerateContentRequest, modelId?: string): Generator<string, void, unknown> {
  // Validate request
  if (!request.contents || request.contents.length === 0) {
    const errorResponse = {
      error: {
        code: 400,
        message: "Request must contain at least one content item",
        status: "INVALID_ARGUMENT"
      }
    };
    yield `data: ${JSON.stringify(errorResponse)}\n\n`;
    return;
  }

  // Get the latest user message
  const lastContent = request.contents[request.contents.length - 1];
  const userText = lastContent.parts.map(part => part.text || '').join(' ');

  // Check if this is an echo model
  const model = modelId ? findGeminiModelById(modelId) : null;
  let chunks: string[];
  
  if (model && model.type === 'echo') {
    // Build echo chunks
    chunks = ["# Echo Response\n\n"];
    
    // Add system content if present
    const systemContents = request.contents.filter(c => c.role === 'system');
    if (systemContents.length > 0) {
      chunks.push("## System Prompt\n\n");
      systemContents.forEach(content => {
        content.parts.forEach(part => {
          if (part.text) {
            chunks.push(part.text + "\n\n");
          }
        });
      });
    }
    
    // Add user messages
    const userContents = request.contents.filter(c => c.role === 'user' || !c.role);
    if (userContents.length > 0) {
      chunks.push("## User Messages\n\n");
      userContents.forEach((content, index) => {
        chunks.push(`### Message ${index + 1}\n\n`);
        content.parts.forEach(part => {
          if (part.text) {
            chunks.push(part.text + "\n\n");
          }
        });
      });
    }
  } else {
    // Use the first test case from markdown test cases
    const testCase = markdownTestCases[0];
    chunks = testCase.streamChunks || [testCase.response];
  }
  
  const promptTokenCount = Math.ceil(userText.length / 4);
  let totalCandidatesTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = Math.ceil(chunk.length / 4);
    totalCandidatesTokens += chunkTokens;

    const streamResponse: GeminiStreamResponse = {
      candidates: [{
        content: {
          parts: [{
            text: chunk
          }],
          role: "model"
        },
        finishReason: i === chunks.length - 1 ? "STOP" : "NONE",
        index: 0,
        safetyRatings: [
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            probability: "NEGLIGIBLE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            probability: "NEGLIGIBLE"
          },
          {
            category: "HARM_CATEGORY_HARASSMENT",
            probability: "NEGLIGIBLE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            probability: "NEGLIGIBLE"
          }
        ]
      }]
    };

    // Add usage metadata for the final chunk
    if (i === chunks.length - 1) {
      streamResponse.usageMetadata = {
        promptTokenCount,
        candidatesTokenCount: totalCandidatesTokens,
        totalTokenCount: promptTokenCount + totalCandidatesTokens
      };
    }

    yield `data: ${JSON.stringify(streamResponse)}\n\n`;
  }

  yield `data: [DONE]\n\n`;
}