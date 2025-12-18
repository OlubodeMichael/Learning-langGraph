import "dotenv/config";
import { StateGraph, START, END, Annotation, Command } from "@langchain/langgraph";

const State = Annotation.Root({
    mode: Annotation<string>(),      // "idle" | "running" | "error" | "done"
    attempts: Annotation<number>(),  // how many tries so far
    maxAttempts: Annotation<number>(), // when to give up
    error: Annotation<string>(),     // last error message
    result: Annotation<string>(), 
})
type AgentState = typeof State.State;

function init(state: AgentState) {
    return {
        mode: "idle",
        attempts: 0,
        maxAttempts: 3,
        error: "",
        result: "",
    }
}

function do_task(state: AgentState) {
    const attempt = state.attempts + 1;
  
    // Simulate success/failure: 50% chance
    const success = Math.random() > 0.5;
  
    if (success) {
      return {
        mode: "done",
        attempts: attempt,
        result: `✅ Task succeeded on attempt ${attempt}`,
        error: "",
      };
    }
  
    // Failure path → go to error state
    return {
      mode: "error",
      attempts: attempt,
      error: `❌ Task failed on attempt ${attempt}`,
    };
  }
  

  function handle_error(state: AgentState) {
    // If we've hit maxAttempts, stop trying
    if (state.attempts >= state.maxAttempts) {
      return {
        mode: "done",
        result: `⚠️ Gave up after ${state.attempts} attempts. Last error: ${state.error}`,
      };
    }
  
    // Otherwise, try again → go back to running
    return {
      mode: "running",
    };
  }
  

function router(state: AgentState) {
    return {
        mode: state.mode,
    }
}

const builder = new StateGraph(State)
    .addNode("init", init)
    .addNode("do_task", do_task)
    .addNode("handle_error", handle_error)
    .addNode("router", router)

    .addEdge(START, "init")
    .addEdge("init", "do_task")
    .addEdge("do_task", "router")
    .addConditionalEdges("router", 
        (state: AgentState) => state.mode, {
            running: "do_task",
            error: "handle_error",
            done: END,
        }
    )
    .addEdge("do_task", "router")
    .addEdge("handle_error", "router")

const graph = builder.compile();

graph.invoke({});

(async () => {
    const result = await graph.invoke({
      mode: "idle",       // initial mode
      attempts: 0,
      maxAttempts: 3,     // try up to 3 times
      error: "",
      result: "",
    });
  
    console.log("FINAL STATE:");
    console.dir(result, { depth: null });
  })();
  