const { GoogleGenerativeAI } = require('@google/generative-ai')
const { searchRepo } = require('./pinecone.service')

const GEMINI_MODEL = process.env.GEMINI_MODEL ||
  'gemini-2.5-flash'

async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const is503 = error.message?.includes('503')
      const is429 = error.message?.includes('429')
      
      if ((is503 || is429) && attempt < maxRetries) {
        const delay = attempt * 2000 // 2s, 4s, 6s
        console.log(`Gemini error (attempt ${attempt}), retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
}

// Build system prompt with repo context
function buildSystemPrompt(context) {
  const {
    owner, repo, description, techStack,
    fileTree, currentTab, selectedIssue,
    selectedFile, isIndexed
  } = context

  let prompt = `You are a helpful coding assistant 
integrated into FirstCommit, a tool that helps 
first-time open source contributors understand 
GitHub repositories.

You are helping a beginner contributor understand 
the repository: ${owner}/${repo}
Description: ${description || 'No description'}
Tech Stack: ${techStack?.join(', ') || 'Unknown'}

Repository file structure (top-level):
${fileTree?.slice(0, 80).join('\n') || 'Not available'}

Current context:`

  if (currentTab === 'readOrder') {
    prompt += '\nUser is viewing the Read Order — a ranked list of files to read first.'
  } else if (currentTab === 'issues') {
    prompt += '\nUser is browsing open issues in this repository.'
  }

  if (selectedIssue) {
    prompt += `\nUser is looking at issue #${selectedIssue.number}: "${selectedIssue.title}"`
    if (selectedIssue.body) {
      prompt += `\nIssue description: ${selectedIssue.body.slice(0, 500)}`
    }
  }

  if (selectedFile) {
    prompt += `\nUser has file open: ${selectedFile}`
  }

  prompt += `

Your role:
- Help beginners understand this specific codebase
- Give concrete, specific answers about THIS repo
- When mentioning files, use their actual paths
- Explain technical concepts in simple terms
- If asked how to run the project, check for 
  package.json scripts or README hints in the file tree
- Be encouraging — users are new to open source
- Keep answers concise but helpful
- If you don't know something specific, say so 
  honestly rather than guessing

${isIndexed ?
      'You have access to the actual code content via RAG search.' :
      'Note: Deep code search not yet available for this repo.'
    }`

  return prompt
}

// Generate chat response with RAG
async function generateChatResponse(
  message,
  history,
  context
) {
  try {
    const client = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    )

    // If repo is indexed, search for relevant chunks
    let ragContext = ''
    if (context.isIndexed && message.length > 10) {
      console.log('Searching Pinecone for:',
        message.slice(0, 50))

      const chunks = await searchRepo(
        context.owner,
        context.repo,
        message,
        5
      )

      if (chunks.length > 0) {
        ragContext = '\n\nRelevant code found:\n' +
          chunks.map(chunk =>
            `[${chunk.filePath} lines ${chunk.startLine}-${chunk.endLine}]\n${chunk.text}`
          ).join('\n\n---\n\n')

        console.log(`Found ${chunks.length} relevant chunks`)
      }
    }

    const systemPrompt = buildSystemPrompt(context)

    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })

    // Build chat history for Gemini
    let geminiHistory = history.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))

    // Gemini history MUST start with a 'user' message
    while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.shift()
    }

    const chat = model.startChat({
      history: geminiHistory
    })

    // Include RAG context in the message if found
    const fullMessage = ragContext
      ? `${message}\n\n${ragContext}`
      : message

    const result = await callWithRetry(() => 
      chat.sendMessage(fullMessage)
    )
    const response = result.response.text()

    return {
      content: response,
      ragUsed: ragContext.length > 0
    }

  } catch (error) {
    console.error('Chat error:', error.message)
    throw error
  }
}

// Generate suggested questions based on context
function getSuggestedQuestions(context) {
  const { currentTab, selectedIssue,
    selectedFile, techStack } = context

  const base = [
    'How do I run this project locally?',
    'What is the best file to start reading?',
    'How do I submit my first PR to this repo?'
  ]

  if (selectedIssue) {
    return [
      `How do I fix issue #${selectedIssue.number}?`,
      'What files should I change for this?',
      'How long will this take to fix?',
      'How do I test my fix?'
    ]
  }

  if (selectedFile) {
    return [
      `What does ${selectedFile} do?`,
      'How is this file connected to others?',
      'What would break if I changed this?',
      'Is this a good file to start contributing to?'
    ]
  }

  if (currentTab === 'issues') {
    return [
      'Which issue is best for a first contribution?',
      'How do I claim an issue on GitHub?',
      'What should I look for in a good first issue?',
      ...base.slice(0, 1)
    ]
  }

  return base
}

module.exports = {
  generateChatResponse,
  getSuggestedQuestions
}
