import "dotenv/config";
import { AgentExecutor, createToolCallingAgent } from "@langchain/classic/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { tools } from "./tools";
import { model } from "./model"; // <-- your existing ChatModel (ChatOpenAI, ChatAnthropic, etc.)

async function main() {

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "You are a helpful assistant.",
        "Use tools when they help. If a tool is needed, call it.",
        "If not needed, answer directly.",
      ].join("\n"),
    ],
    // Optional chat history placeholder (safe even if you pass none)
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Build agent runnable
  const agent = await createToolCallingAgent({
    llm: model,
    tools,
    prompt,
  });

  // Executor runs the tool loop
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });

  // Try a few inputs:
  const tests = [
    "What is (19 * 7) + 4?",
    "Lowercase this: HELLO WORLD",
    "How many words are in: LangGraph is awesome",
  ];

  for (const input of tests) {
    const result = await executor.invoke({
      input,
      chat_history: [], // keep empty for now
    });

    console.log("\n======================");
    console.log("INPUT:", input);
    console.log("OUTPUT:", result.output.content);
  }
}

main().catch(console.error);
