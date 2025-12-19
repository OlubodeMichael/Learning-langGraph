import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { AgentExecutor, createToolCallingAgent } from "@langchain/classic/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { model } from "./model";
import { tools } from "./tools";

const GraphState = Annotation.Root({
    raw: Annotation<string>(),
    output: Annotation<string>(),
});

type S = typeof GraphState.State;

async function buildExecutor() {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant. Use tools when helpful."],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  
    const agent = await createToolCallingAgent({ llm: model, tools, prompt });
    return new AgentExecutor({ agent, tools, verbose: true });
  }

  async function agent_node(state: S) {
    const executor = await buildExecutor();
    const res = await executor.invoke({ input: state.raw, chat_history: [] });
    return { output: res.output };
  }

  const graph = new StateGraph(GraphState)
    .addNode("agent_node", agent_node)
    .addEdge(START, "agent_node")
    .addEdge("agent_node", END)
    .compile();

  (async () => {
    const result = await graph.invoke({ raw: "If I have 3 apples and buy 4 more, how many apples do I have?", output: "" });
    console.log(result);
  })();
