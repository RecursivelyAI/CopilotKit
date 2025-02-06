#! /bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Save the current directory
root_dir=$(pwd)

# If the first argument is --help, list all possible examples
if [ "$1" == "--help" ]; then
  echo "Usage: $0 [example_directory] [backend]"
  echo "  - example_directory: The name of the example directory (default: coagents-research-canvas)"
  echo "  - backend: The backend to use (fastapi or langgraph-platform, default: fastapi)"
  echo ""
  echo "NOTE: Make sure to have GNU parallel and langgraph CLI installed."
  echo ""
  echo "Available example directories:"
  for dir in $(ls -d "$root_dir/../examples/"*/); do
    # Skip the 'e2e' directory
    if [ "$(basename "$dir")" == "e2e" ]; then
      continue
    fi
    echo "  - $(basename "$dir")"
  done
  exit 0
fi


# Check if GNU parallel is installed
if ! command -v parallel &> /dev/null; then
  echo "Error:GNU parallel is not installed. Please install to proceed. (brew install parallel)"
  exit 1
fi


# The first argument is the example directory name, defaulting to "coagents-research-canvas" if not provided
example_dir="${1:-coagents-research-canvas}"

# Check if the example directory exists
if [ ! -d "$root_dir/../examples/$example_dir" ]; then
  echo "Example directory $example_dir does not exist"
  exit 1
fi

backend="${2:-fastapi}"

# Check if the backend is valid
if [[ "$backend" != "fastapi" && "$backend" != "langgraph-platform" ]]; then
  echo "Invalid backend: $backend. Must be 'fastapi' or 'langgraph-platform'."
  exit 1
fi

# Ensure "langgraph" is installed if the backend is "langgraph-platform"
if [[ "$backend" == "langgraph-platform" ]]; then
  if ! command -v langgraph &> /dev/null; then
    echo "Error: 'langgraph' is not installed. Please install to proceed. (brew install langgraph-cli)"
    exit 1
  fi
fi

on_exit() {
  cd "$root_dir/../examples/$example_dir/agent"

  # Only revert and echo if pyproject.toml or poetry.lock have changes
  if ! git diff --quiet -- pyproject.toml poetry.lock; then
    echo "------------------------------------------------------"
    echo "Reverting changes to pyproject.toml and poetry.lock..."
    echo "------------------------------------------------------"
    git checkout -- pyproject.toml poetry.lock
  fi

  cd "$root_dir"
}

# Ensure cleanup/revert is called when the script exits or on error
trap on_exit EXIT ERR

if [[ "$backend" == "langgraph-platform" ]]; then
  echo "------------------------------------------------------------------"
  echo "URL: http://localhost:3000/?lgcDeploymentUrl=http://localhost:2024"
  echo "------------------------------------------------------------------"
fi

if [[ "$backend" == "fastapi" ]]; then
  echo "--------------------------"
  echo "URL: http://localhost:3000"
  echo "--------------------------"
fi

echo "Linking packages globally..."
turbo link:global

echo "Setting up the JS environment..."
cd "$root_dir/../examples/$example_dir/ui"
rm -rf .next
pnpm i
pnpm link --global @copilotkit/react-ui @copilotkit/react-core @copilotkit/runtime-client-gql \
  @copilotkit/shared @copilotkit/runtime @copilotkit/sdk-js

echo "Setting up the Python environment..."
cd "$root_dir/../examples/$example_dir/agent"
poetry lock
poetry install

# Add sdk-python as an editable package only if the backend is fastapi
if [[ "$backend" == "fastapi" ]]; then
  poetry add --editable ../../../sdk-python
fi

if [[ "$backend" == "langgraph-platform" ]]; then
  python -m pip install -e .
fi

# Define color prompts
copilotkit_prompt="\x1b[1;32m[CopilotKit]\x1b[0m"
agent_prompt="\x1b[1;31m[Agent     ]\x1b[0m"
frontend_prompt="\x1b[1;34m[Frontend  ]\x1b[0m"

# Determine the command to run based on the backend
if [[ "$backend" == "fastapi" ]]; then
  agent_command="poetry run demo"
else
  agent_command="langgraph dev --no-browser"
fi


echo "Running the app..."
parallel --ungroup ::: \
  "cd $root_dir && exec > >(sed 's/^/$copilotkit_prompt /') 2>&1 && turbo run dev" \
  "cd $root_dir/../examples/$example_dir/agent && exec > >(sed 's/^/$agent_prompt /') 2>&1 && $agent_command" \
  "cd $root_dir/../examples/$example_dir/ui && exec > >(sed 's/^/$frontend_prompt /') 2>&1 && pnpm dev"

