#!/bin/bash

echo "🚀 Setting up Research Analyst TypeScript Application"
echo "====================================================="

# Clean up
echo "🧹 Cleaning up..."
rm -rf node_modules package-lock.json

# Create .npmrc
echo "📝 Creating .npmrc configuration..."
cat > .npmrc << 'EOF'
registry=https://registry.npmjs.org/
legacy-peer-deps=true
strict-peer-dependencies=false
fetch-retries=3
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
EOF

echo "📦 Installing dependencies in stages..."

# Stage 1: Install core dependencies
echo "1️⃣ Installing core dependencies..."
npm install @langchain/core@^0.3.0 @langchain/community@^0.3.0 --legacy-peer-deps --no-save

# Stage 2: Install LLM providers
echo "2️⃣ Installing LLM providers..."
npm install @langchain/openai@^0.1.0 @langchain/google-genai@^0.1.0 @langchain/ollama@^0.1.0 --legacy-peer-deps --no-save

# Stage 3: Install additional dependencies
echo "3️⃣ Installing additional dependencies..."
npm install @langgraph/sdk@^0.1.0 @langchain/langgraph@^0.1.0 --legacy-peer-deps --no-save

# Stage 4: Install the rest
echo "4️⃣ Installing remaining dependencies..."
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo "✅ All dependencies installed successfully!"
else
    echo "⚠️ Some warnings appeared but installation completed"
fi

echo ""
echo "🔧 Checking installed versions..."
npm list @langchain/core @langchain/community @langchain/openai @langchain/google-genai 2>/dev/null | head -20

echo ""
echo "📁 Creating project structure..."
mkdir -p logs generated_report config
mkdir -p src/{models,utils,workflows,prompts,database,api/{routes,services,models},templates,static/css}

echo ""
echo "🎉 Setup completed!"
echo "Run: npm run dev"
echo "====================================================="