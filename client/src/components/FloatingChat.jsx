import { useState, useRef, useEffect } from 'react'
import { sendChatMessage, indexRepo, 
         checkIndexStatus } from '../services/chatApi'

export default function FloatingChat({ 
  owner,
  repo,
  description,
  techStack,
  fileTree,
  currentTab,
  selectedIssue,
  selectedFile
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isIndexed, setIsIndexed] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = 
    useState([
      'How do I run this project locally?',
      'What is the best file to start reading?',
      'How do I submit my first PR?'
    ])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const [size, setSize] = useState({ width: 440, height: 600 })
  const [isExpanded, setIsExpanded] = useState(false)

  const [chunksCount, setChunksCount] = useState(() => {
    if (owner && repo) {
      const saved = localStorage.getItem(`chunks_${owner}_${repo}`)
      return saved ? parseInt(saved, 10) : null
    }
    return null
  })
  const [progress, setProgress] = useState(0)

  // Dragging states
  const [position, setPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef(null)
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  // Check if repo is indexed on mount
  useEffect(() => {
    if (owner && repo) {
      checkIndexStatus(owner, repo)
        .then(data => setIsIndexed(data.indexed))
        .catch(() => setIsIndexed(false))
    }
  }, [owner, repo])

  // Update chunksCount from localStorage when repo changes
  useEffect(() => {
    if (owner && repo) {
      const saved = localStorage.getItem(`chunks_${owner}_${repo}`)
      setChunksCount(saved ? parseInt(saved, 10) : null)
    }
  }, [owner, repo])

  // Handle expanding dimensions
  useEffect(() => {
    if (isExpanded) {
      setSize({ width: 520, height: 700 })
    } else {
      setSize({ width: 440, height: 600 })
    }
  }, [isExpanded])

  // Scroll to bottom on user query, scroll to start of AI message on response
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    
    if (isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (lastMessage?.role === 'assistant') {
      const container = messagesContainerRef.current
      if (container) {
        const messageElements = container.querySelectorAll('.message-item')
        if (messageElements.length > 0) {
          const lastMsgElement = messageElements[messageElements.length - 1]
          lastMsgElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }, [messages, isLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Resizable window listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      
      const deltaX = e.clientX - resizeStart.current.x
      const deltaY = e.clientY - resizeStart.current.y
      
      let newWidth = resizeStart.current.width
      let newHeight = resizeStart.current.height
      let newX = position ? position.x : null
      let newY = position ? position.y : null
      
      if (resizeDirection.includes('left')) {
        const proposedWidth = resizeStart.current.width - deltaX
        if (proposedWidth >= 320 && proposedWidth <= 800) {
          newWidth = proposedWidth
          if (position !== null) {
            newX = resizeStart.current.left + deltaX
          }
        }
      } else if (resizeDirection.includes('right')) {
        const proposedWidth = resizeStart.current.width + deltaX
        if (proposedWidth >= 320 && proposedWidth <= 800) {
          newWidth = proposedWidth
        }
      }
      
      if (resizeDirection.includes('top')) {
        const proposedHeight = resizeStart.current.height - deltaY
        if (proposedHeight >= 400 && proposedHeight <= 900) {
          newHeight = proposedHeight
          if (position !== null) {
            newY = resizeStart.current.top + deltaY
          }
        }
      } else if (resizeDirection.includes('bottom')) {
        const proposedHeight = resizeStart.current.height + deltaY
        if (proposedHeight >= 400 && proposedHeight <= 900) {
          newHeight = proposedHeight
        }
      }
      
      setSize({ width: newWidth, height: newHeight })
      if (newX !== null || newY !== null) {
        setPosition({ x: newX, y: newY })
      }
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection(null)
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeDirection, position])

  // Draggable window listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      })
    }
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleIndexRepo = async () => {
    setIsIndexing(true)
    setProgress(0)
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval)
          return prev
        }
        const increment = Math.floor(Math.random() * 10) + 5
        return Math.min(prev + increment, 95)
      })
    }, 400)

    try {
      const result = await indexRepo(owner, repo, fileTree)
      clearInterval(interval)
      setProgress(100)
      if (result.success) {
        setIsIndexed(true)
        setChunksCount(result.chunksIndexed)
        if (owner && repo) {
          localStorage.setItem(`chunks_${owner}_${repo}`, result.chunksIndexed)
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Repository indexed! I can now search through ${result.filesIndexed} files and ${result.chunksIndexed} code chunks to give you more accurate answers.`
        }])
      }
    } catch (error) {
      clearInterval(interval)
      console.error('Indexing failed:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSend = async (messageText) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return
    
    const userMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const context = {
        owner, repo, description,
        techStack, fileTree,
        currentTab, selectedIssue, selectedFile
      }
      
      const response = await sendChatMessage(
        text,
        messages,
        context
      )
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content,
        ragUsed: response.ragUsed
      }])
      
      if (response.isIndexed && !isIndexed) {
        setIsIndexed(true)
      }
      
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error.message?.includes('quota')
          ? '⚠️ Daily AI limit reached. Please try again tomorrow.'
          : '❌ Something went wrong. Please try again.',
        isError: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getDisplayFileName = () => {
    if (!selectedFile) return '';
    return typeof selectedFile === 'object' ? (selectedFile.path || '') : selectedFile;
  }

  // Update questions logic using display name safely
  useEffect(() => {
    const fileName = getDisplayFileName();
    if (selectedIssue) {
      setSuggestedQuestions([
        `How do I fix issue #${selectedIssue.number}?`,
        'What files should I change?',
        'How do I test my fix?',
        'How long will this take?'
      ])
    } else if (fileName) {
      setSuggestedQuestions([
        `What does ${fileName} do?`,
        'How is this connected to other files?',
        'What would break if I changed this?'
      ])
    } else if (currentTab === 'issues') {
      setSuggestedQuestions([
        'Which issue is best for a beginner?',
        'How do I claim an issue on GitHub?',
        'How do I run this project locally?'
      ])
    } else {
      setSuggestedQuestions([
        'How do I run this project locally?',
        'What is the best file to start reading?',
        'How do I submit my first PR?'
      ])
    }
  }, [currentTab, selectedIssue, selectedFile])

  const getQuestionIcon = (q) => {
    const lower = q.toLowerCase();
    if (lower.startsWith('how do i run') || lower.includes('run this project') || lower.includes('run locally')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      );
    }
    if (lower.startsWith('what file to start') || lower.includes('best file to start') || lower.includes('what files should i change')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
      );
    }
    if (lower.includes('submit') || lower.includes('pr') || lower.includes('claim')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <line x1="6" y1="3" x2="6" y2="15"/>
          <circle cx="18" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
      );
    }
    if (lower.includes('fix issue') || lower.includes('how do i fix') || lower.includes('test my fix') || lower.includes('how long')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
    }
    if (lower.includes('what does') || lower.includes('do?') || lower.includes('connected') || lower.includes('break')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    );
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-floating-btn"
        >
          &lt;&gt; Ask AI
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div 
          ref={panelRef}
          className={`chat-panel ${isExpanded ? 'expanded' : ''} ${isResizing ? 'resizing' : ''}`}
          style={
            position === null ? {
              position: 'fixed',
              bottom: '5rem',
              right: '1.5rem',
              width: `${size.width}px`,
              height: `${size.height}px`
            } : {
              position: 'fixed',
              left: position.x,
              top: position.y,
              bottom: 'auto',
              right: 'auto',
              width: `${size.width}px`,
              height: `${size.height}px`
            }
          }
        >
          
          {/* Resize handles */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsResizing(true)
              setResizeDirection('top-left')
              const rect = panelRef.current.getBoundingClientRect()
              resizeStart.current = {
                x: e.clientX, y: e.clientY,
                width: rect.width, height: rect.height,
                left: rect.left, top: rect.top
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '10px',
              height: '10px',
              cursor: 'nwse-resize',
              zIndex: 1010
            }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsResizing(true)
              setResizeDirection('top-right')
              const rect = panelRef.current.getBoundingClientRect()
              resizeStart.current = {
                x: e.clientX, y: e.clientY,
                width: rect.width, height: rect.height,
                left: rect.left, top: rect.top
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '10px',
              height: '10px',
              cursor: 'nesw-resize',
              zIndex: 1010
            }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsResizing(true)
              setResizeDirection('bottom-left')
              const rect = panelRef.current.getBoundingClientRect()
              resizeStart.current = {
                x: e.clientX, y: e.clientY,
                width: rect.width, height: rect.height,
                left: rect.left, top: rect.top
              }
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '10px',
              height: '10px',
              cursor: 'nesw-resize',
              zIndex: 1010
            }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsResizing(true)
              setResizeDirection('bottom-right')
              const rect = panelRef.current.getBoundingClientRect()
              resizeStart.current = {
                x: e.clientX, y: e.clientY,
                width: rect.width, height: rect.height,
                left: rect.left, top: rect.top
              }
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '10px',
              height: '10px',
              cursor: 'nwse-resize',
              zIndex: 1010
            }}
          />
          
          {/* Header */}
          <div 
            onMouseDown={(e) => {
              if (e.target.closest('button')) return
              setIsDragging(true)
              const rect = panelRef.current.getBoundingClientRect()
              dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              }
              e.preventDefault()
            }}
            style={{
              padding: '1rem 1.25rem',
              background: '#E8EAFF',
              borderRadius: '20px 20px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 'auto',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Row 1 */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'monospace',
                  color: '#1E1B4B',
                  fontWeight: '800',
                  fontSize: '1rem',
                  marginRight: '0.5rem',
                  lineHeight: 1
                }}>&lt;&gt;</span>
                <span style={{
                  color: '#1E1B4B',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  lineHeight: 1
                }}>FirstCommit Assistant</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isIndexing ? (
                <span 
                  className="header-status-dot blue" 
                  title="Indexing repository..."
                />
              ) : isIndexed ? (
                <span 
                  className="header-status-dot green" 
                  title="RAG enabled — searching actual code"
                />
              ) : (
                <span 
                  className="header-status-dot gray" 
                  title="Context-aware mode"
                />
              )}
              
              {/* Expand / Shrink toggle button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="chat-expand-btn"
                title={isExpanded ? "Shrink chat window" : "Expand chat window"}
                style={{ color: '#1E1B4B' }}
              >
                {isExpanded ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="10" y1="14" x2="3" y2="21" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="15" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false)
                  setPosition(null)
                  setSize({ width: 440, height: 600 })
                  setIsExpanded(false)
                }}
                className="chat-close-btn"
                style={{ color: '#1E1B4B' }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Repo Context Bar */}
          <div style={{
            background: '#F8FAFF',
            borderBottom: '1px solid #E5E7EB',
            padding: '0.5rem 1.25rem',
            fontSize: '0.75rem',
            color: '#374151',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {owner}/{repo}
            </span>
            {currentTab && <span> · Viewing {currentTab}</span>}
            {selectedIssue && <span> · Issue #{selectedIssue.number}</span>}
            {getDisplayFileName() && <span> · {getDisplayFileName()}</span>}
          </div>

          {/* Messages area */}
          <div 
            ref={messagesContainerRef}
            className="chat-messages-area"
            style={{
              background: '#F9FAFB',
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            
            {/* Empty state with suggestions */}
            {messages.length === 0 && (
              <div>
                {/* Welcome Card */}
                <div style={{
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <path d="M8 10l-2 2 2 2M16 10l2 2-2 2" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem' }}>
                    Hi! I know this codebase.
                  </div>
                  <div style={{ color: '#374151', fontSize: '0.82rem', fontWeight: '500' }}>
                    Ask me anything about {owner}/{repo}
                  </div>
                </div>
                
                {/* Index CTA if not indexed */}
                {!isIndexed && fileTree?.length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #EFF6FF, #F5F3FF)',
                    border: '1px solid #BFDBFE',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '0.75rem'
                  }}>
                    {isIndexing ? (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold', 
                        color: '#1D4ED8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <span>Indexing... {progress}%</span>
                        <span className="animated-dots" />
                      </div>
                    ) : (
                      <>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.375rem', 
                          fontWeight: 'bold', 
                          color: '#1D4ED8', 
                          fontSize: '0.85rem',
                          marginBottom: '0.25rem'
                        }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <span>Enable deep code search</span>
                        </div>
                        <div style={{ 
                          fontSize: '0.78rem', 
                          color: '#3B82F6', 
                          marginBottom: '0.625rem',
                          lineHeight: '1.4'
                        }}>
                          I'll search actual code content for more accurate answers
                        </div>
                        <button
                          onClick={handleIndexRepo}
                          className="index-cta-btn"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Index repository
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                )}
                
                {/* Suggested questions */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.4rem' 
                }}>
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="suggestion-chip"
                    >
                      <span>{getQuestionIcon(q)}</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={i}
                    className="message-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      background: '#E8EAFF',
                      color: '#1E1B4B',
                      borderRadius: '16px 16px 4px 16px',
                      padding: '0.625rem 1rem',
                      maxWidth: '80%',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      fontWeight: '500',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              } else {
                return (
                  <div
                    key={i}
                    className="message-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '0.5rem',
                      justifyContent: 'flex-start',
                      width: '100%'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: '#1e1b4b',
                      color: 'white',
                      fontFamily: 'monospace',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      alignSelf: 'flex-end'
                    }}>
                      &lt;&gt;
                    </div>
                    
                    {/* Bubble + optional RAG */}
                    <div style={{
                      maxWidth: '82%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{
                        background: msg.isError ? '#FEF2F2' : 'white',
                        border: msg.isError ? '1px solid #FECACA' : '1px solid #E5E7EB',
                        borderRadius: '16px 16px 16px 4px',
                        padding: '0.625rem 1rem',
                        fontSize: '0.85rem',
                        lineHeight: '1.65',
                        color: msg.isError ? '#991B1B' : '#111827',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {msg.content}
                      </div>
                      {msg.ragUsed && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.68rem',
                          color: '#6B7280',
                          marginTop: '0.25rem'
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <span>Searched actual code</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '0.5rem',
                justifyContent: 'flex-start',
                width: '100%'
              }}>
                {/* Avatar */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#1e1b4b',
                  color: 'white',
                  fontFamily: 'monospace',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  alignSelf: 'flex-end'
                }}>
                  &lt;&gt;
                </div>
                
                {/* Staggered bouncing dots */}
                <div style={{
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '0.625rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <div className="loading-dot" style={{ animationDelay: '0s' }} />
                  <div className="loading-dot" style={{ animationDelay: '0.2s' }} />
                  <div className="loading-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            background: 'white',
            borderTop: '1px solid #E5E7EB',
            padding: '0.875rem 1rem',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-end'
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this repo..."
                rows={1}
                className="chat-textarea"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`chat-send-btn ${input.trim() && !isLoading ? 'active' : 'disabled'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" 
                  fill="none" stroke="currentColor" 
                  stroke-width="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div style={{
              fontSize: '0.68rem',
              color: '#9CA3AF',
              textAlign: 'center',
              marginTop: '0.375rem'
            }}>
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      {/* Styled component styles */}
      <style>{`
        .chat-floating-btn {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          width: auto;
          height: 44px;
          padding: 0 1.25rem;
          border-radius: 22px;
          background: #111827;
          color: white;
          font-family: monospace;
          font-size: 0.85rem;
          font-weight: 700;
          border: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 1000;
        }
        .chat-floating-btn:hover {
          background: #1f2937;
          transform: translateY(-1px);
        }
        
        .chat-panel {
          position: fixed;
          bottom: 5rem;
          right: 1.5rem;
          min-width: 320px;
          min-height: 400px;
          max-height: calc(100vh - 6.5rem);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
          border: 1px solid rgba(255,255,255,0.8);
          background: #FFFFFF;
          z-index: 1000;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: width 0.2s ease, height 0.2s ease, left 0.2s ease, top 0.2s ease;
        }
        
        .chat-panel.expanded {
          width: 520px;
          height: 700px;
          max-height: calc(100vh - 6.5rem);
        }
        .chat-panel.resizing {
          transition: none !important;
        }
        
        @media (max-width: 480px) {
          .chat-panel {
            width: calc(100vw - 2rem) !important;
            left: 1rem !important;
            right: 1rem !important;
            bottom: 5rem !important;
            height: 560px !important;
          }
        }
        
        .chat-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(30, 27, 75, 0.7);
          font-size: 1.2rem;
          padding: 0.25rem;
          line-height: 1;
          transition: color 0.15s ease;
        }
        .chat-close-btn:hover {
          color: #7C3AED;
        }
        
        .chat-expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(30, 27, 75, 0.7);
          font-size: 1rem;
          padding: 0.25rem;
          line-height: 1;
          transition: color 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-expand-btn:hover {
          color: #7C3AED;
        }
        
        .header-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          cursor: help;
        }
        .header-status-dot.green {
          background-color: #10B981;
        }
        .header-status-dot.gray {
          background-color: #9CA3AF;
        }
        .header-status-dot.blue {
          background-color: #3B82F6;
          animation: pulse-blue 1.5s infinite ease-in-out;
        }
        
        @keyframes pulse-blue {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            transform: scale(1.15);
            opacity: 0.8;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0);
          }
        }
        
        .chat-messages-area::-webkit-scrollbar {
          width: 4px;
        }
        .chat-messages-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-messages-area::-webkit-scrollbar-thumb {
          background: #D1D5DB;
          border-radius: 2px;
        }
        
        .index-cta-btn {
          background: #3B82F6;
          color: white;
          border-radius: 8px;
          padding: 0.4rem 1rem;
          font-size: 0.78rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .index-cta-btn:hover {
          background: #2563EB;
        }
        
        @keyframes dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }
        .animated-dots::after {
          content: '';
          animation: dots 1.5s infinite;
        }
        
        .suggestion-chip {
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 0.625rem 1rem;
          font-size: 0.8rem;
          color: #1F2937;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.15s ease;
          text-align: left;
          width: 100%;
        }
        .suggestion-chip:hover {
          background: #EFF6FF;
          border-color: #BFDBFE;
          color: #1D4ED8;
          transform: translateX(2px);
        }
        
        .loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #9CA3AF;
          animation: loading-bounce 1.2s infinite ease-in-out;
        }
        @keyframes loading-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        
        .chat-textarea {
          flex: 1;
          min-height: 40px;
          max-height: 100px;
          border: 1.5px solid #E5E7EB;
          border-radius: 12px;
          padding: 0.5rem 0.875rem;
          font-size: 0.83rem;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          color: #111827;
          background: #F9FAFB;
          transition: all 0.15s ease;
        }
        .chat-textarea::placeholder {
          color: #6B7280;
        }
        .chat-textarea:focus {
          border-color: #3B82F6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .chat-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .chat-send-btn.active {
          background: #3B82F6;
          color: white;
          cursor: pointer;
        }
        .chat-send-btn.active:hover {
          background: #2563EB;
          transform: translateY(-1px);
        }
        .chat-send-btn.disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}
