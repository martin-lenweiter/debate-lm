import { webSearch } from './web-search';
import { webFetch } from './web-fetch';
import { pythonExec } from './python-exec';
import { fileRead, fileWrite } from './file-ops';
import type { ToolResult } from '@/lib/schemas';

export const DEBATER_TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for information. Use this to find current facts, data, and sources to support your arguments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch and read content from a specific URL. Use this to read articles, papers, or other web content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'python_exec',
    description: 'Execute Python code for calculations, data analysis, or generating results. Useful for mathematical proofs or data processing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'file_read',
    description: 'Read content from a file. Use this to access context documents provided by the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'file_write',
    description: 'Write content to a file. Use this to save analysis, notes, or intermediate results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to write the file to'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  }
];

export interface ToolInput {
  name: string;
  input: Record<string, unknown>;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  sessionId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'web_search':
        return await webSearch(input.query as string);
      case 'web_fetch':
        return await webFetch(input.url as string);
      case 'python_exec':
        return await pythonExec(input.code as string);
      case 'file_read':
        return await fileRead(input.path as string, sessionId);
      case 'file_write':
        return await fileWrite(input.path as string, input.content as string, sessionId);
      default:
        return { type: 'error', error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { type: 'error', error: message };
  }
}

export function formatToolResult(result: ToolResult): string {
  switch (result.type) {
    case 'web_search':
      if (result.results.length === 0) {
        return 'No search results found.';
      }
      return result.results
        .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
        .join('\n\n');
    case 'web_fetch':
      return `Content from ${result.result.url}:\n\n${result.result.content}`;
    case 'python_exec':
      if (result.result.error) {
        return `Python Error:\n${result.result.error}`;
      }
      return `Python Output:\n${result.result.output}`;
    case 'file_read':
      return `File content (${result.result.path}):\n\n${result.result.content}`;
    case 'file_write':
      return result.result.success
        ? `Successfully wrote to ${result.result.path}`
        : `Failed to write to ${result.result.path}`;
    case 'error':
      return `Tool Error: ${result.error}`;
  }
}
