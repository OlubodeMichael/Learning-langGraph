import "dotenv/config";

import { StateGraph,START, END, Annotation } from "@langchain/langgraph";
import { model } from "./model";

const AgentDefinition = Annotation.Root({
    input: Annotation<string>,
    messages: Annotation<string[]>,
    done: Annotation<boolean>
})

type AgentState = typeof AgentDefinition.State;

function node1(state: AgentState) {
    return {
        messages: [...state.messages, `we just received the input: ${JSON.stringify({input: state.input})}`],
        done: true
    }
}

function node2(state: AgentState) {
    return {
        messages: [...state.messages, `we just received the messages: ${JSON.stringify({messages: state.messages})}`],
        done: true
    }
}

async function callLLM(state: AgentState) {
    const response = await model.invoke(state.input);

    const aiMessage = {role: "assistant", content: response.content};
    return {
        messages: [...state.messages, aiMessage],
        done: true
    }
}

export const graph = new StateGraph(AgentDefinition)
    .addNode("node1", node1)
    .addNode("node2", node2)
    .addNode("callLLM", callLLM)
    .addEdge(START, "node1")
    .addEdge("node1", "node2")
    .addEdge("node2", "callLLM")
    .addEdge("callLLM", END)
    .compile();

(async () => {
    const result = await graph.invoke({input: "what is the capital of France?", messages: [], done: false});
    console.log("Result:", result);
})();