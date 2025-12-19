import { tool } from "@langchain/core/tools";
import { z } from "zod";


export const calculator = tool(
  async ({ expression }: { expression: string }) => {
    // Very basic safety: allow digits, spaces, decimal points, parentheses, and operators.
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return "Invalid expression. Use only numbers and + - * / ( ) .";
    }

    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression});`)();
    return String(result);
  },
  {
    name: "calculator",
    description: "Evaluate basic math expressions. Input example: '19 * 7 + 4'.",
    schema: z.object({
      expression: z.string().describe("Math expression to evaluate"),
    }),
  }
);

/**
 * Tool 2: Lowercase
 */
export const toLower = tool(
  async ({ text }: { text: string }) => text.toLowerCase(),
  {
    name: "toLower",
    description: "Convert text to lowercase.",
    schema: z.object({
      text: z.string().describe("Text to lowercase"),
    }),
  }
);

/**
 * Tool 3: Word count
 */
export const wordCount = tool(
  async ({ text }: { text: string }) => {
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    return String(count);
  },
  {
    name: "wordCount",
    description: "Count the number of words in a piece of text.",
    schema: z.object({
      text: z.string().describe("Text to count words in"),
    }),
  }
);

export const text_stats = tool(
    async ({text}: {text: string}) => {
        const count = text.trim() ? text.trim().split(/\s+/).length : 0;
        return {
            wordCount: count,
            characterCount: text.length,
            sentenceCount: text.split(".").length,
        }
    },
    {
        name: "text_stats",
        description: "Get the number of words, characters, and sentences in a piece of text.",
        schema: z.object({
            text: z.string().describe("Text to get stats for"),
        }),
    }
)

export const normalize_text = tool(
    async ({text}: {text: string}) => {
        return text.toLowerCase().trim();
    },
    {
        name: "normalize_text",
        description: "Normalize text by converting to lowercase and removing whitespace.",
        schema: z.object({
            text: z.string().describe("Text to normalize"),
        }),
    }
)

export const tools = [calculator, toLower, wordCount, text_stats];
