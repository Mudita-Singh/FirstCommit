const { Pinecone } = require('@pinecone-database/pinecone')

let pineconeClient = null
let pineconeIndex = null

function getPineconeClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    })
  }
  return pineconeClient
}

function getPineconeIndex() {
  if (!pineconeIndex) {
    const client = getPineconeClient()
    pineconeIndex = client.index(
      process.env.PINECONE_INDEX_NAME,
      process.env.PINECONE_HOST
    )
  }
  return pineconeIndex
}

// Check if a repo is already indexed
async function isRepoIndexed(owner, repo) {
  try {
    const index = getPineconeIndex()
    const namespace = `${owner}__${repo}`
    const stats = await index.describeIndexStats()
    const ns = stats.namespaces?.[namespace]
    return ns && ns.recordCount > 0
  } catch (error) {
    console.error('Pinecone stats error:', error.message)
    return false
  }
}

// Index a repo's files into Pinecone
// Uses Pinecone's built-in llama-text-embed-v2 model
async function indexRepo(owner, repo, files) {
  try {
    const index = getPineconeIndex()
    const namespace = `${owner}__${repo}`
    
    console.log(`Indexing ${files.length} files for ${owner}/${repo}`)
    
    const records = []
    
    for (const file of files) {
      if (!file.content || file.content.length < 10) 
        continue
      
      // Split file into chunks of ~50 lines
      const lines = file.content.split('\n')
      const chunkSize = 50
      
      for (let i = 0; i < lines.length; 
           i += chunkSize) {
        const chunkLines = lines.slice(i, i + chunkSize)
        const chunkText = chunkLines.join('\n').trim()
        
        if (chunkText.length < 20) continue
        
        const startLine = i + 1
        const endLine = Math.min(
          i + chunkSize, 
          lines.length
        )
        
        records.push({
          id: `${owner}__${repo}__${file.path}__${startLine}`,
          text: `File: ${file.path}\nLines: ${startLine}-${endLine}\n\n${chunkText}`,
          owner,
          repo,
          filePath: file.path,
          startLine: Number(startLine),
          endLine: Number(endLine),
          language: file.path.split('.').pop() || 'txt'
        })
      }
    }
    
    if (records.length === 0) {
      console.log('No records to index')
      return 0
    }
    
    // Upsert in batches of 96 (Pinecone limit)
    const batchSize = 96
    for (let i = 0; i < records.length; 
         i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      await index.namespace(namespace).upsertRecords({ records: batch })
      console.log(`Indexed batch ${Math.floor(i/batchSize) + 1}`)
    }
    
    console.log(`Successfully indexed ${records.length} chunks for ${owner}/${repo}`)
    return records.length
    
  } catch (error) {
    console.error('Pinecone index error:', error.message)
    throw error
  }
}

// Search Pinecone for relevant code chunks
async function searchRepo(owner, repo, query, topK = 5) {
  try {
    const index = getPineconeIndex()
    const namespace = `${owner}__${repo}`
    
    const results = await index
      .namespace(namespace)
      .searchRecords({
        query: {
          inputs: { text: query },
          topK
        },
        fields: ['filePath', 'startLine', 'endLine', 'text']
      })
    
    return results.result?.hits?.map(hit => ({
      score: hit._score,
      filePath: hit.fields?.filePath,
      startLine: hit.fields?.startLine ? Number(hit.fields.startLine) : undefined,
      endLine: hit.fields?.endLine ? Number(hit.fields.endLine) : undefined,
      text: hit.fields?.text
    })) || []
    
  } catch (error) {
    console.error('Pinecone search error:', error.message)
    return []
  }
}

// Delete a repo's index (for re-indexing)
async function deleteRepoIndex(owner, repo) {
  try {
    const index = getPineconeIndex()
    const namespace = `${owner}__${repo}`
    await index.namespace(namespace).deleteAll()
    console.log(`Deleted index for ${owner}/${repo}`)
  } catch (error) {
    console.error('Pinecone delete error:', error.message)
  }
}

module.exports = { 
  isRepoIndexed, 
  indexRepo, 
  searchRepo,
  deleteRepoIndex
}
