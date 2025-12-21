import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

/**
 * STATE MANAGEMENT DEMO
 *
 * We will manage memory using:
 * - attempts: a counter that increments
 * - logs: an array that APPENDS (doesn't overwrite)
 * - lastMessage: a string that overwrites (latest wins)
 *
 * The "management" part is: deciding merge rules for each field.
 */

// ---- 1) Define State with reducers (the "management rules") ----
const GraphState = Annotation.Root({
  // Overwrite: last write wins (default behavior is fine for strings)
  lastMessage: Annotation<string>(),

  // Counter: we want to INCREMENT, not overwrite
  attempts: Annotation<number>({
    reducer: (prev, next) => (prev ?? 0) + (next ?? 0),
    default: () => 0,
  }),

  // Append-only list: we want to ACCUMULATE logs over time
  logs: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...(next ?? [])],
    default: () => [],
  }),

  // Track tools used: also append-only
  toolsUsed: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...(next ?? [])],
    default: () => [],
  }),
});

type S = typeof GraphState.State;

// ---- 2) Nodes return PARTIAL updates ----

function add_log(state: S) {
  // returning only logs update; NOT touching attempts, etc.
  return {
    logs: [`log: starting with message="${state.lastMessage}"`],
  };
}

function attempt_step(_state: S) {
  // IMPORTANT: we return { attempts: 1 } meaning "increment by 1"
  // because reducer adds it to existing attempts.
  return {
    attempts: 1,
    logs: ["log: increment attempts by 1"],
  };
}

function use_tool_fake(_state: S) {
  // Simulate tool usage by writing into toolsUsed
  return {
    toolsUsed: ["calculator"],
    logs: ["log: used tool calculator"],
  };
}

function update_message(_state: S) {
  // Overwrite lastMessage (no reducer needed)
  return {
    lastMessage: "updated message ✅",
    logs: ["log: overwrote lastMessage"],
  };
}

// ---- 3) Build Graph ----
// Conditional function to decide whether to loop or continue
function should_loop(state: S): string {
  // Loop once: if attempts < 2, go to use_tool_fake, otherwise continue
  return state.attempts < 2 ? "use_tool_fake" : "update_message";
}

const graph = new StateGraph(GraphState)
  .addNode("add_log", add_log)
  .addNode("attempt_step", attempt_step)
  .addNode("use_tool_fake", use_tool_fake)
  .addNode("update_message", update_message)
  .addEdge(START, "add_log")
  .addEdge("add_log", "attempt_step")
  .addConditionalEdges("attempt_step", should_loop) // Use conditional edge to control loop
  .addEdge("use_tool_fake", "attempt_step") // loop once more to prove accumulation
  .addEdge("update_message", END)
  .compile();

// ---- 4) Run ----
(async () => {
  const result = await graph.invoke({
    lastMessage: "hello",
    // attempts/logs/toolsUsed will use defaults if omitted,
    // but we can pass them explicitly too.
    attempts: 0,
    logs: [],
    toolsUsed: [],
  });

  console.log("\nFINAL STATE:");
  console.log(result);
})();
