"""
HTML templates, used when the info endpoint is accessed from the browser.
"""
import json
from copilotkit.sdk import InfoDict

HEAD_HTML = """
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CopilotKit Remote Endpoint v0.1.12</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 30px;
        }
        header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 40px;
        }
        h1 {
            font-size: 2rem;
            margin: 0;
        }
        h2 {
            font-size: 1.8rem;
            margin-bottom: 20px;
        }
        h3 {
            font-size: 1.4rem;
            margin-bottom: 10px;
        }
        .version {
          font-family: 'Courier New', Courier, monospace;
          font-size: 1.2rem;
        }
        .kite-icon {
            font-size: 38px;
            margin-right: 16px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin-bottom: 40px;
        }
        .card {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 20px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            font-size: 0.75rem;
            font-weight: bold;
            border-radius: 4px;
            margin-left: 10px;
            background-color: #dbeafe;
            color: #1e40af;
        }
        pre {
            background-color: #f1f1f1;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        code {
            font-family: 'Courier New', Courier, monospace;
        }
    </style>
</head>
"""

INFO_TEMPLATE= """
<!DOCTYPE html>
<html lang="en">
{head_html}
<body>
    <div class="container">
        <header>
            <h1><span class="kite-icon">🪁</span>CopilotKit Remote Endpoint <span class="version">(v{version})</span></h1>
        </header>

        <main>
            <section>
                <h2>Actions</h2>
                <div class="grid">
                    {action_html}
                </div>
            </section>
            <section>
                <h2>Agents</h2>
                <div class="grid">
                    {agent_html}
                </div>
            </section>
        </main>
    </div>
</body>
</html>
"""

ACTION_TEMPLATE = """
<div class="card">
    <h3>{name}</h3>
    <p>{description}</p>
    <h4>Arguments:</h4>
    <pre><code>{arguments}</code></pre>
</div>
"""

AGENT_TEMPLATE = """
<div class="card">
    <h3>{name} <span class="badge">{type}</span></h3>
    <p>{description}</p>
</div>
"""

NO_ACTIONS_FOUND_HTML = """
<div class="card">
    <p>No actions found</p>
</div>
"""

NO_AGENTS_FOUND_HTML = """
<div class="card">
    <p>No agents found</p>
</div>
"""

def generate_info_html(info: InfoDict) -> str:
    """
    Generate HTML for the info endpoint
    """
    print(info, flush=True)
    action_html = ""
    for action in info["actions"]:
        action_html += ACTION_TEMPLATE.format(
            name=action["name"],
            description=action["description"],
            arguments=json.dumps(action.get("parameters", []), indent=2),
        )
    agent_html = ""
    for agent in info["agents"]:
        agent_type = agent.get("type", "Unknown")
        if agent_type == "langgraph":
            agent_type = "LangGraph"
        elif agent_type == "crewai":
            agent_type = "CrewAI"

        agent_html += AGENT_TEMPLATE.format(
            name=agent["name"],
            type=agent_type,
            description=agent["description"],
        )
    return INFO_TEMPLATE.format(
        head_html=HEAD_HTML,
        version=info["sdkVersion"],
        action_html=action_html or NO_ACTIONS_FOUND_HTML,
        agent_html=agent_html or NO_AGENTS_FOUND_HTML,
    )
