import "dotenv/config";
import { StateGraph,START, END, Annotation } from "@langchain/langgraph";
import { model } from "./model";

const State = Annotation.Root({
    raw: Annotation<string>(),
    cleaned: Annotation<string>(),
    type: Annotation<string>(),
    response: Annotation<string>(),
    route: Annotation<string>(), // static or llm
});

type AgentState = typeof State.State;


function clean_input(state: AgentState) {
    return {
        cleaned: state.raw.trim().toLowerCase(),
    }
}

function analyze_input(state: AgentState) {
    const cleaned = state.cleaned.trim();

    if (cleaned.length === 0) {
        return {
            type: "empty",
        }
    } 
    if (cleaned.includes("?")) {
        return {
            type: "question",
        }
    }
    const greetings = ["hi", "hello", "hey", "yo", "sup"];
    if (greetings.includes(cleaned)) {
        return {
            type: "greeting",
        }
    }
    return {
        type: "statement",
    }
}
function router (state: AgentState) {
    if (state.type === "empty" || state.type === "greeting") {
        return { route: "static" };
    }
   
    return { route: "llm" };
}

function respond_static(state: AgentState) {
    if (state.type === "empty") {
      return { response: "You didn't type anything. Try saying something 🙂" };
    }
  
    if (state.type === "greeting") {
      return { response: "Hey! 👋 How can I help you today?" };
    }
  
    // fallback, shouldn't really happen
    return { response: "Thanks for your message." };
  }
async function respond_llm(state: AgentState) {
    const prompt = `
  You are a helpful assistant that responds to user input.
  User input: "${state.cleaned}"
  User input type: ${state.type}
  Respond briefly and appropriately based on the type.
    `.trim();
  
    const response = await model.invoke(prompt);
  
    // If your model returns an AIMessage, you might want:
    const content =
      typeof response === "string"
        ? response
        : (response as any).content ?? JSON.stringify(response);
  
    return {
      response: content,
    };
  }

const graph = new StateGraph(State)
    .addNode("clean_input", clean_input)
    .addNode("analyze_input", analyze_input)
    .addNode("router", router)
    .addNode("respond_static", respond_static)
    .addNode("respond_llm", respond_llm)
    .addEdge(START, "clean_input")
    .addEdge("clean_input", "analyze_input")
    .addEdge("analyze_input", "router")
    .addConditionalEdges("router",
        (state: AgentState) => state.route, {
            "static": "respond_static",
            "llm": "respond_llm",
        }
    )
    .addEdge("respond_static", END)
    .addEdge("respond_llm", END)
    .compile();

(async () => {
    const result = await graph.invoke({
        raw: "   Why is the sky blue   ",
        cleaned: "",
        type: "",
        response: "",
        route: "",
      });
    console.log(result);
})();