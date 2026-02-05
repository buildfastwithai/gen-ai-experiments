from typing import TypedDict, List, Dict, Any, Annotated
from langgraph.graph import StateGraph, END
import operator
from langchain_core.messages import SystemMessage, HumanMessage, AnyMessage

# Define the State
class AgentState(TypedDict):
    messages: Annotated[List[AnyMessage], operator.add]
    user_requirement: str
    plan: str
    hld: str
    code_files: Dict[str, str]
    readme: str
    feedback: str
    iteration_count: int

# Node Functions
def planner_node(state: AgentState, llm):
    print("---PLANNER NODE---")
    requirement = state.get("user_requirement", "")
    feedback = state.get("feedback", "")
    current_plan = state.get("plan", "")
    
    system_msg = (
        "You are an expert Software Architect. Your task is to create a detailed execution plan "
        "based on the user's requirements. "
        "If there is existing feedback, refine the plan accordingly."
    )
    
    user_msg = f"Requirement: {requirement}"
    if current_plan:
        user_msg += f"\n\nCurrent Plan:\n{current_plan}\n\nUser Feedback to Refine Plan:\n{feedback}"
        
    messages = [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
    response = llm.invoke(messages)
    
    return {"plan": response.content, "feedback": ""} # Clear feedback after processing

def designer_node(state: AgentState, llm):
    print("---DESIGNER NODE---")
    plan = state.get("plan", "")
    feedback = state.get("feedback", "")
    current_hld = state.get("hld", "")
    
    system_msg = (
        "You are an expert System Designer. Create a High Level Design (HLD) in Markdown format "
        "based on the provided execution plan. Include system architecture, component diagrams (mermaid), "
        "and data flow. "
        "If there is existing feedback, refine the HLD accordingly."
    )
    
    user_msg = f"Approved Plan:\n{plan}"
    if current_hld:
        user_msg += f"\n\nCurrent HLD:\n{current_hld}\n\nUser Feedback to Refine HLD:\n{feedback}"

    messages = [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
    response = llm.invoke(messages)
    
    return {"hld": response.content, "feedback": ""}

def coder_node(state: AgentState, llm):
    print("---CODER NODE---")
    hld = state.get("hld", "")
    plan = state.get("plan", "")
    requirement = state.get("user_requirement", "")
    
    system_msg = (
        "You are an expert Full Stack Developer. Generate the complete codebase based on the HLD and Plan. "
        "You must return the response in a structured JSON format where keys are filenames and values are file contents. "
        "Also include a 'README.md' file with setup instructions. "
        "Example output format (strictly parseable JSON or clear separation): \n"
        "```json\n"
        "{\n"
        "  'main.py': 'import ...',\n"
        "  'utils.py': 'def ...'\n"
        "}\n"
        "```\n"
        "Ensure the code is complete, functional, and production-ready."
    )
    # Note: For robust JSON parsing, we might need output parsers, but for this prototype check, we'll ask for markdown code blocks or parsing logic in the node.
    # Let's try to get raw content and parse it in the node or assume the LLM follows instructions.
    # A safer bet for chat models is to ask for specific delimiters or just one large text block we parse.
    # We will use a prompt that asks for standard markdown code blocks with filenames.
    
    refined_system_msg = (
        "You are an expert Developer. Generate the code for the requested application.\n"
        "For each file, use the following format:\n"
        "## filename.ext\n"
        "```language\n"
        "code content here...\n"
        "```\n"
        "Include a README.md file as well."
    )

    user_msg = f"Requirement: {requirement}\n\nApproved Plan:\n{plan}\n\nApproved HLD:\n{hld}"
    
    messages = [SystemMessage(content=refined_system_msg), HumanMessage(content=user_msg)]
    response = llm.invoke(messages)
    
    # Simple parser for the custom format
    content = response.content
    code_files = {}
    import re
    # Regex to find ## filename then code block
    # This is a basic parser.
    pattern = r"##\s+([^\n]+)\n```\w*\n(.*?)```"
    matches = re.finditer(pattern, content, re.DOTALL)
    
    for match in matches:
        filename = match.group(1).strip()
        file_content = match.group(2)
        code_files[filename] = file_content
    
    # Extract README if not caught (sometimes LLM just puts it separately)
    # If regex returns empty, might need fallback. 
    # For now, let's assume the LLM follows the '## filename' convention as instructed.
    
    readme = code_files.get("README.md", "README not generated.")
    
    return {"code_files": code_files, "readme": readme}


def create_agent_graph(llm):
    # Wrapper to inject LLM
    def call_planner(state):
        return planner_node(state, llm)
    
    def call_designer(state):
        return designer_node(state, llm)
        
    def call_coder(state):
        return coder_node(state, llm)

    workflow = StateGraph(AgentState)
    
    workflow.add_node("planner", call_planner)
    workflow.add_node("designer", call_designer)
    workflow.add_node("coder", call_coder)
    
    # The edges will be controlled by the Streamlit UI state (Human-in-the-loop).
    # In a pure LangGraph run, we would have conditional edges check 'feedback'.
    # Here, we treat the graph as step-functions.
    # We will invoke specific nodes based on the current ui stage.
    # So strictly speaking, we might not need 'edges' if we adhere to manual stepping,
    # OR we can define the full flow and use `interrupt_before`.
    # Let's define the full linear flow for structure:
    
    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "designer")
    workflow.add_edge("designer", "coder")
    workflow.add_edge("coder", END)
    
    return workflow.compile()
