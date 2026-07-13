#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
  # Read variables, ignoring comments
  export $(grep -v '^#' .env | xargs)
fi

echo "🚀 Iniciando processo de sincronização e deploy..."

# 1. PUSH TO GITHUB
if [ ! -z "$GITHUB_TOKEN" ] && [ ! -z "$GITHUB_USER" ] && [ ! -z "$GITHUB_REPO" ]; then
  echo "📦 Sincronizando com o GitHub..."
  
  # Configure git identity if not set
  if [ -z "$(git config user.name)" ]; then
    git config --global user.name "AI Studio Assistant"
    git config --global user.email "assistant@aistudio.google"
  fi

  # Initialize repository if not already done
  if [ ! -d .git ]; then
    git init
    git branch -M main
  fi

  git add .
  git commit -m "Update from AI Studio - $(date)"
  
  # Push to GitHub
  git push -f "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$GITHUB_REPO.git" main
  echo "✅ GitHub atualizado com sucesso!"
else
  echo "⚠️ Configurações do GitHub ausentes ou incompletas (defina GITHUB_TOKEN, GITHUB_USER e GITHUB_REPO no painel de Secrets)."
fi

# 2. DEPLOY TO VERCEL
if [ ! -z "$VERCEL_TOKEN" ] && [ ! -z "$VERCEL_ORG_ID" ] && [ ! -z "$VERCEL_PROJECT_ID" ]; then
  echo "⚡ Iniciando deploy no Vercel..."
  
  # Deploy to Vercel production using the token and project details
  npx vercel --token=$VERCEL_TOKEN --prod --yes --force
  echo "✅ Vercel implantado com sucesso!"
else
  echo "⚠️ Configurações do Vercel ausentes ou incompletas (defina VERCEL_TOKEN, VERCEL_ORG_ID e VERCEL_PROJECT_ID no painel de Secrets)."
fi
