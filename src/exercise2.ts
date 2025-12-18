import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { model } from "./model";

/*
raw (string): original user request
clean (string): trimmed/lowercased
phase (string): "plan" | "execute" | "validate" | "error" | "done"
plan (string): the plan you generate
draft (string): the current answer draft
final (string): final answer when validated
attempts (number): how many times you’ve looped
maxAttempts (number): stopping condition
error (string): error message if something breaks
route (string): router output (next node key)
issues (string[]): validation issues list
*/
const GraphState = Annotation.Root({
  raw: Annotation<string>(),
  clean: Annotation<string>(),
  phase: Annotation<string>(),
  plan: Annotation<string>(),
  draft: Annotation<string>(),
  final: Annotation<string>(),
  attempts: Annotation<number>(),
  maxAttempts: Annotation<number>(),
  error: Annotation<string>(),
  route: Annotation<string>(),
  issues: Annotation<string[]>(),
});

type AgentState = typeof GraphState.State;

function clean_input(state: AgentState) {
  return {
    clean: state.raw.trim().toLowerCase(),
  };
}

/*
FIX #1: Router now checks attempts >= maxAttempts BEFORE phase routing.
- This is the real stopping condition for retries.
FIX #2: Router only routes to "give_up" when attempts exceed the limit,
        not as a generic fallback for unknown phases.
*/
function router(state: AgentState) {
  // ✅ FIX #1: enforce maxAttempts guard globally
  if (state.attempts >= state.maxAttempts) {
    return { route: "give_up" };
  }

  const phase = state.phase;

  if (phase === "done") return { route: "end" };
  if (phase === "plan") return { route: "make_plan" };
  if (phase === "execute") return { route: "make_draft" };
  if (phase === "validate") return { route: "validate_draft" };
  if (phase === "error") return { route: "handle_error" };

  // ✅ FIX #2: unknown phase routes to error instead of give_up
  return { route: "handle_error" };
}

async function make_plan(state: AgentState) {
  const prompt = `
You are a helpful assistant that can generate a plan for a task.
Return a short numbered plan (3-6 steps). Do NOT write the final answer yet.
User input: ${state.clean}
  `.trim();

  const response = await model.invoke(prompt);

  return {
    plan:
      typeof response === "string"
        ? response
        : (response as any).content ?? JSON.stringify(response),
    phase: "execute",
  };
}

async function make_draft(state: AgentState) {
  const prompt = `
You are a helpful assistant that can generate a draft answer for a task.
Use the plan to structure the response with at least 2 bullet points or 2 numbered steps.
User input: ${state.clean}
Plan: ${state.plan}
  `.trim();

  const response = await model.invoke(prompt);

  return {
    draft:
      typeof response === "string"
        ? response
        : (response as any).content ?? JSON.stringify(response),
    phase: "validate",
  };
}

function validate_draft(state: AgentState) {
  const issues: string[] = [];
  const draft = state.draft ?? "";

  // Rule A: at least 80 characters
  if (draft.length < 80) issues.push("too short");

  // Rule B: must contain at least 2 bullet points or numbered steps
  const bulletMatches = draft.match(/[-•]\s+/g) ?? [];
  const numberMatches = draft.match(/\d+\.\s+/g) ?? [];
  if (bulletMatches.length + numberMatches.length < 2) {
    issues.push("missing bullets or steps");
  }

  // Rule C: must not contain refusal language
  const refusalPhrases = ["i don't know", "i cant", "i can't", "unable to"];
  const lowerDraft = draft.toLowerCase();
  if (refusalPhrases.some((p) => lowerDraft.includes(p))) {
    issues.push("contains refusal");
  }

  // ✅ PASS
  if (issues.length === 0) {
    return {
      final: draft,
      phase: "done",
      issues: [],
    };
  }

  // ❌ FAIL
  const attempts = state.attempts + 1;

  // Decide where to loop back
  const nextPhase = issues.includes("contains refusal") ? "plan" : "execute";

  return {
    issues,
    attempts,
    phase: nextPhase,
  };
}

function handle_error(state: AgentState) {
  return {
    final: "Something went wrong. Please try again.",
    phase: "done",
  };
}

/*
FIX #3: give_up now ALWAYS finalizes and sets phase="done".
- Previously, give_up sometimes returned phase:"plan", which made it not a true "give up".
*/
function give_up(state: AgentState) {
  return {
    final: `I couldn't produce a valid answer in ${state.maxAttempts} attempts. Here is my best draft:\n\n${state.draft || ""}`,
    phase: "done",
  };
}

const builder = new StateGraph(GraphState)
  .addNode("clean_input", clean_input)
  .addNode("router", router)
  .addNode("make_plan", make_plan)
  .addNode("make_draft", make_draft)
  .addNode("validate_draft", validate_draft)
  .addNode("handle_error", handle_error)
  .addNode("give_up", give_up)

  .addEdge(START, "clean_input")
  .addEdge("clean_input", "router")

  .addConditionalEdges("router", (state: AgentState) => state.route, {
    make_plan: "make_plan",
    make_draft: "make_draft",
    validate_draft: "validate_draft",
    handle_error: "handle_error",
    give_up: "give_up",
    end: END,
  })

  .addEdge("make_plan", "router")
  .addEdge("make_draft", "router")
  .addEdge("validate_draft", "router")
  .addEdge("handle_error", "router")

  /*
  FIX #4: Removed conflicting edges from give_up.
  - Previously you had give_up -> router AND give_up -> END.
  - Now give_up deterministically ends.
  */
  .addEdge("give_up", END);

const graph = builder.compile();

(async () => {
  const result = await graph.invoke({
    raw: "What is the capital of France?",
    clean: "",
    phase: "plan",
    plan: "",
    draft: "",
    final: "",
    attempts: 0,
    maxAttempts: 3,
    error: "",
    route: "",
    issues: [],
  });

  console.log(result);
})();
