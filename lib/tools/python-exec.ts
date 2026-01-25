import type { ToolResult } from '@/lib/schemas';

const EXEC_TIMEOUT = 30000;

export async function pythonExec(code: string): Promise<ToolResult> {
  // For now, we'll use a simple evaluation approach for basic math
  // In production, this would connect to a sandboxed Python environment
  // like Pyodide (browser-based) or a containerized service

  try {
    // Basic security check - reject obviously dangerous patterns
    const dangerousPatterns = [
      /import\s+os/i,
      /import\s+subprocess/i,
      /import\s+sys/i,
      /__import__/i,
      /exec\s*\(/i,
      /eval\s*\(/i,
      /open\s*\(/i,
      /file\s*\(/i,
      /input\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          type: 'python_exec',
          result: {
            output: '',
            error: 'Security: This code contains potentially unsafe operations',
          },
        };
      }
    }

    // Try to execute simple mathematical expressions using JavaScript
    // This is a limited fallback - real implementation would use Pyodide
    const result = evaluateMathExpression(code);

    if (result.success) {
      return {
        type: 'python_exec',
        result: {
          output: result.output,
        },
      };
    } else {
      return {
        type: 'python_exec',
        result: {
          output: '',
          error: result.error || 'Execution failed. Note: Only basic math operations are supported in this demo.',
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown execution error';
    return {
      type: 'python_exec',
      result: {
        output: '',
        error: message,
      },
    };
  }
}

interface EvalResult {
  success: boolean;
  output: string;
  error?: string;
}

function evaluateMathExpression(code: string): EvalResult {
  try {
    // Handle simple print statements
    const printMatch = code.match(/print\s*\(\s*(.+?)\s*\)/);
    if (printMatch) {
      const expr = printMatch[1];
      // Remove string quotes if it's a simple string
      if (/^["'].*["']$/.test(expr.trim())) {
        return { success: true, output: expr.slice(1, -1) };
      }
      // Try to evaluate as math
      const result = safeMathEval(expr);
      if (result !== null) {
        return { success: true, output: String(result) };
      }
    }

    // Handle variable assignment and print
    const lines = code.split('\n').filter(l => l.trim());
    const variables: Record<string, number> = {};
    let lastOutput = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Variable assignment: x = expression
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (assignMatch) {
        const [, varName, expr] = assignMatch;
        const value = safeMathEval(expr, variables);
        if (value !== null) {
          variables[varName] = value;
          continue;
        }
      }

      // Print statement
      const printMatch2 = trimmed.match(/^print\s*\(\s*(.+?)\s*\)$/);
      if (printMatch2) {
        const expr = printMatch2[1];
        // Check if it's a string
        if (/^["'].*["']$/.test(expr.trim())) {
          lastOutput += expr.slice(1, -1) + '\n';
          continue;
        }
        // Check if it's a variable
        if (variables[expr] !== undefined) {
          lastOutput += String(variables[expr]) + '\n';
          continue;
        }
        // Try math eval
        const value = safeMathEval(expr, variables);
        if (value !== null) {
          lastOutput += String(value) + '\n';
          continue;
        }
      }

      // Simple expression (last line returns value)
      const value = safeMathEval(trimmed, variables);
      if (value !== null) {
        lastOutput = String(value);
      }
    }

    if (lastOutput) {
      return { success: true, output: lastOutput.trim() };
    }

    return {
      success: false,
      output: '',
      error: 'Could not evaluate expression. Only basic math is supported.',
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Evaluation failed',
    };
  }
}

function safeMathEval(expr: string, variables: Record<string, number> = {}): number | null {
  try {
    // Replace Python-specific syntax with JS equivalents
    let jsExpr = expr
      .replace(/\*\*/g, '**') // Python power operator (same in JS)
      .replace(/\/\//g, 'Math.floor') // Integer division (partial support)
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\babs\s*\(/g, 'Math.abs(')
      .replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
      .replace(/\bpow\s*\(/g, 'Math.pow(')
      .replace(/\bround\s*\(/g, 'Math.round(')
      .replace(/\bfloor\s*\(/g, 'Math.floor(')
      .replace(/\bceil\s*\(/g, 'Math.ceil(')
      .replace(/\bmin\s*\(/g, 'Math.min(')
      .replace(/\bmax\s*\(/g, 'Math.max(')
      .replace(/\bsum\s*\(\s*\[([^\]]+)\]\s*\)/g, '($1).reduce((a,b)=>a+b,0)')
      .replace(/\blen\s*\(\s*\[([^\]]+)\]\s*\)/g, '[$1].length');

    // Replace variables
    for (const [name, value] of Object.entries(variables)) {
      jsExpr = jsExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(value));
    }

    // Only allow safe characters
    if (!/^[\d\s+\-*/%().,$<>=!&|?:\[\],Math.absceilfloorminmaxpowroundsqrtreduce=>]+$/i.test(jsExpr.replace(/\s/g, ''))) {
      return null;
    }

    // Evaluate using Function constructor (safer than eval)
    const fn = new Function(`"use strict"; return (${jsExpr});`);
    const result = fn();

    if (typeof result === 'number' && !isNaN(result)) {
      return result;
    }
    if (typeof result === 'boolean') {
      return result ? 1 : 0;
    }

    return null;
  } catch {
    return null;
  }
}
