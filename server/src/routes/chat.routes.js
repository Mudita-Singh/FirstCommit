const express = require('express')
const router = express.Router()
const { 
  generateChatResponse,
  getSuggestedQuestions
} = require('../services/chat.service')
const { 
  isRepoIndexed, 
  indexRepo 
} = require('../services/pinecone.service')
const githubService = require('../services/github.service')

// POST /api/chat/message
// Send a chat message and get a response
router.post('/message', async (req, res) => {
  try {
    const { 
      message, history, context
    } = req.body
    
    if (!message || !context?.owner || !context?.repo) {
      return res.status(400).json({ 
        error: 'Message and repo context required' 
      })
    }
    
    // Check if repo is indexed in Pinecone
    const indexed = await isRepoIndexed(
      context.owner, 
      context.repo
    )
    context.isIndexed = indexed
    
    console.log(`Chat: ${context.owner}/${context.repo}`, 
      `RAG: ${indexed}`)
    
    const response = await generateChatResponse(
      message,
      history || [],
      context
    )
    
    res.json({
      content: response.content,
      ragUsed: response.ragUsed,
      isIndexed: indexed
    })
    
  } catch (error) {
    console.error('Chat route error:', error.message)
    
    if (error.message?.includes('429') || 
        error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'AI quota exceeded',
        message: 'Daily limit reached. Try again tomorrow.'
      })
    }
    
    res.status(500).json({ 
      error: 'Chat failed',
      message: error.message 
    })
  }
})

// POST /api/chat/index
// Index a repo's files into Pinecone for RAG
router.post('/index', async (req, res) => {
  try {
    const { owner, repo, files } = req.body
    
    if (!owner || !repo || !files?.length) {
      return res.status(400).json({ 
        error: 'Owner, repo, and files required' 
      })
    }
    
    // Check if already indexed
    const alreadyIndexed = await isRepoIndexed(owner, repo)
    if (alreadyIndexed) {
      console.log(`${owner}/${repo} already indexed`)
      return res.json({ 
        success: true, 
        alreadyIndexed: true,
        message: 'Already indexed'
      })
    }
    
    console.log(`Starting RAG indexing for ${owner}/${repo} with ${files.length} files`)
    
    // Fetch content for each file
    // Only index source code files, skip binary/large
    const sourceExtensions = [
      'js', 'ts', 'jsx', 'tsx', 'py', 'go', 
      'rs', 'java', 'cpp', 'c', 'cs', 'rb',
      'md', 'json', 'yaml', 'yml', 'toml'
    ]
    
    const filesToIndex = files
      .filter(f => {
        const ext = f.split('.').pop()?.toLowerCase()
        return sourceExtensions.includes(ext)
      })
      .slice(0, 50) // Max 50 files to control cost
    
    const filesWithContent = []
    
    for (const filePath of filesToIndex) {
      try {
        const content = await githubService
          .fetchFileContent(owner, repo, filePath)
        if (content && content.length < 50000) {
          filesWithContent.push({ 
            path: filePath, 
            content 
          })
        }
      } catch (err) {
        // Skip files that fail to fetch
        console.log(`Skipping ${filePath}: ${err.message}`)
      }
    }
    
    const count = await indexRepo(
      owner, 
      repo, 
      filesWithContent
    )
    
    res.json({ 
      success: true, 
      chunksIndexed: count,
      filesIndexed: filesWithContent.length
    })
    
  } catch (error) {
    console.error('Index route error:', error.message)
    res.status(500).json({ 
      error: 'Indexing failed',
      message: error.message 
    })
  }
})

// GET /api/chat/suggested
// Get suggested questions for current context
router.get('/suggested', (req, res) => {
  try {
    const context = {
      currentTab: req.query.tab,
      selectedFile: req.query.file,
      selectedIssue: req.query.issueNumber 
        ? { number: req.query.issueNumber,
            title: req.query.issueTitle }
        : null,
      techStack: req.query.techStack?.split(',')
    }
    
    const questions = getSuggestedQuestions(context)
    res.json({ questions })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/chat/status/:owner/:repo
// Check if repo is indexed
router.get('/status/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params
    const indexed = await isRepoIndexed(owner, repo)
    res.json({ indexed, owner, repo })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
