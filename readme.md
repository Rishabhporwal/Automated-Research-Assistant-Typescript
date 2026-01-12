# Agentic Research Analyst - TypeScript Edition

A complete TypeScript/Node.js port of the Python research analyst application using LangGraph and LangChain.

## Features

- 🤖 **Multi-Agent Research Workflow**: Automated interview and report generation
- 📊 **Multiple LLM Support**: OpenAI, Google Gemini, Groq, and Ollama
- 🔍 **Web Search Integration**: Tavily search for real-time information
- 📄 **Report Generation**: Export to DOCX and PDF formats
- 🔐 **User Authentication**: Secure login/signup with bcrypt
- 📈 **Workflow State Management**: Track and resume research sessions
- 🎨 **Web Interface**: User-friendly dashboard for report management

## Prerequisites

- Node.js 18+ 
- npm or yarn
- LLM API keys (OpenAI, Google, Groq, or Tavily)
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd research-analyst-ts

npm install

cp .env.example .env

# Edit .env with your API keys
# Edit config/configuration.yaml for LLM preferences

npm run build
```
## Running the Application

```bash

    # Development Mode
    npm run dev

    # Production Mode
    npm run build
    npm start

    # Docker Deployment
    docker-compose up -d
```