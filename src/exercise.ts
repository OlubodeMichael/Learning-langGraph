import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { model } from "./model";

const GraphState = Annotation.Root({
  raw: Annotation<string>(),
  clean: Annotation<string>(),
  type: Annotation<string>(),
  attempts: Annotation<number>(),
  maxAttempts: Annotation<number>(),
  response: Annotation<string>(),
  done: Annotation<boolean>(),
  route: Annotation<string>(),
});

type AgentState = typeof GraphState.State;

function clean_input(state: AgentState) {
  return {
    clean: state.raw.trim().toLowerCase(),
  };
}

function analyze_input(state: AgentState) {
  const cleaned = state.clean;

  if (cleaned.length === 0) {
    return { type: "empty" };
  }

  const greetings = ["hi", "hello", "hey", "yo", "sup"];
  if (greetings.includes(cleaned)) {
    return { type: "greeting" };
  }

  if (cleaned.includes("?")) {
    return { type: "question" };
  }

  return { type: "other" };
}

function handle_empty(state: AgentState) {
  const attempts = state.attempts + 1;

  if (attempts < state.maxAttempts) {
    return {
      done: false,
      response: "I didn't catch that, could you type something?",
      attempts,
    };
  }

  return {
    done: true,
    response: "I'll stop here since I haven't received any input.",
    attempts,
  };
}

function respond_static(state: AgentState) {
  return {
    response: "Hey! 👋 How can I help you today?",
    done: true,
  };
}

async function respond_llm(state: AgentState) {
  const prompt = `
You are a helpful assistant that can answer questions and help with tasks.
User input: ${state.clean}
  `.trim();

  const response = await model.invoke(prompt);

  return {
    response: typeof response === "string" ? response : (response as any).content ?? JSON.stringify(response),
    done: true,
  };
}

function router(state: AgentState) {
  // stop condition
  if (state.done === true) {
    return { route: "end" };
  }

  // branch by type
  if (state.type === "empty") return { route: "handle_empty" };
  if (state.type === "greeting") return { route: "respond_static" };

  // question + other
  return { route: "respond_llm" };
}

const graph = new StateGraph(GraphState)
  .addNode("clean_input", clean_input)
  .addNode("analyze_input", analyze_input)
  .addNode("router", router)
  .addNode("handle_empty", handle_empty)
  .addNode("respond_static", respond_static)
  .addNode("respond_llm", respond_llm)

  .addEdge(START, "clean_input")
  .addEdge("clean_input", "analyze_input")
  .addEdge("analyze_input", "router")

  // ✅ FIXED: mapping keys now match router outputs
  .addConditionalEdges("router", (state: AgentState) => state.route, {
    handle_empty: "handle_empty",
    respond_static: "respond_static",
    respond_llm: "respond_llm",
    end: END,
  })

  // loop: after empty handling, go back to router (will eventually end)
  .addEdge("handle_empty", "router")

  // these branches end immediately
  .addEdge("respond_static", END)
  .addEdge("respond_llm", END)
  .compile();

(async () => {
  const result = await graph.invoke({
    raw: " hey are you there?",
    clean: "",
    type: "",
    attempts: 0,
    maxAttempts: 3,
    response: "",
    done: false,
    route: "",
  });

  console.log(result);
})();
