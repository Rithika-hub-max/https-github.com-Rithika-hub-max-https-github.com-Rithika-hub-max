
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  Database, 
  BrainCircuit, 
  FileText, 
  Trash2, 
  ExternalLink,
  MessageSquare,
  Search,
  LayoutDashboard,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Document, Chunk, ChatMessage, AgentActionType } from './types';
import { processDocument, retrieveChunks } from './services/ragService';
import { determineAction, generateResponse } from './services/geminiService';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>('chat');
  const [lastAction, setLastAction] = useState<{type: string, reasoning: string} | null>(null);
  const [lastRetrieval, setLastRetrieval] = useState<Chunk[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAddDocument = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    
    if (!title || !content) return;

    const newDoc = processDocument(title, content);
    setDocuments(prev => [...prev, newDoc]);
    e.currentTarget.reset();
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userQuery = inputValue;
    setInputValue('');
    setIsProcessing(true);

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuery,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // 1. Determine Action (Agentic Decision Layer)
      const action = await determineAction(userQuery);
      setLastAction(action);

      // 2. Retrieval (RAG Pipeline)
      const retrieved = retrieveChunks(userQuery, documents);
      setLastRetrieval(retrieved);
      const context = retrieved.length > 0 
        ? retrieved.map(c => `[From ${documents.find(d => d.id === c.docId)?.title}]: ${c.text}`).join('\n\n')
        : "No documents found in knowledge base.";

      // 3. Generate Response (LLM Layer)
      const systemPrompt = `You are a world-class AI Research Assistant. Your current action mode is ${action.type}. 
      Always cite your sources if provided. 
      Mode details:
      - ANSWER: Be concise and factual.
      - SUMMARIZE: Condense the information into key points.
      - CATEGORIZE: Organize information into logical themes or bullet points.
      - REPORT: Create a comprehensive research report with sections (Introduction, Key Findings, Analysis, Conclusion).`;

      const aiResponse = await generateResponse(userQuery, action, context, systemPrompt);

      const newAiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        action: action,
        sources: retrieved,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, newAiMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Error: Failed to process your request. Check your API key and connection.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar - Control Panel */}
      <aside className="w-80 border-r bg-white flex flex-col hidden md:flex">
        <div className="p-6 border-b flex items-center gap-3 bg-indigo-600 text-white">
          <BrainCircuit className="w-8 h-8" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Agentic RAG</h1>
            <p className="text-xs text-indigo-100 opacity-80">Hybrid Research System</p>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <MessageSquare className="w-5 h-5" />
            Research Chat
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'docs' ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Database className="w-5 h-5" />
            Knowledge Base ({documents.length})
          </button>

          <div className="pt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">Latest Action</h3>
            {lastAction ? (
              <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm font-bold text-indigo-600">{lastAction.type}</span>
                </div>
                <p className="text-xs text-slate-600 italic">"{lastAction.reasoning}"</p>
              </div>
            ) : (
              <div className="px-4 py-3 border border-dashed border-slate-300 rounded-xl text-center">
                <p className="text-xs text-slate-400">No recent actions</p>
              </div>
            )}
          </div>

          <div className="pt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">RAG Status</h3>
            <div className="px-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Total Chunks</span>
                <span className="font-mono text-slate-700 font-semibold">{documents.reduce((acc, d) => acc + d.chunks.length, 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Vector Store</span>
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">READY</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            End-to-end Encrypted
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-white md:bg-transparent">
        {/* Header */}
        <header className="h-16 border-b px-6 flex items-center justify-between glass-panel sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              {activeTab === 'chat' ? <MessageSquare className="w-5 h-5 text-indigo-600" /> : <Database className="w-5 h-5 text-indigo-600" />}
              {activeTab === 'chat' ? 'Interactive Assistant' : 'Knowledge Base'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
             {isProcessing && (
               <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 Processing...
               </div>
             )}
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'chat' ? (
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Chat Thread */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden shadow-sm md:m-4 md:rounded-2xl border border-slate-100">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Zap className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Start Researching</h3>
                      <p className="text-slate-500">Upload documents and ask me to summarize, categorize or write reports based on your data.</p>
                      <button 
                        onClick={() => setActiveTab('docs')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add Knowledge
                      </button>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white border-indigo-500' 
                          : 'bg-white text-slate-800 border-slate-100'
                      }`}>
                        <div className="flex items-center gap-2 mb-2 opacity-70 text-[10px] font-bold uppercase tracking-widest">
                          {msg.role === 'user' ? 'Scientist' : 'Assistant Agent'}
                          {msg.action && (
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[8px]">
                              MODE: {msg.action.type}
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed prose prose-sm max-w-none">
                          {msg.content}
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 mb-2">RETRIEVED SOURCES ({msg.sources.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.sources.map((src, idx) => (
                                <div key={idx} className="px-2 py-1 bg-slate-50 rounded text-[10px] text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-colors cursor-help group relative">
                                  {documents.find(d => d.id === src.docId)?.title}
                                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 text-white p-2 rounded shadow-xl hidden group-hover:block z-50">
                                    <p className="text-[10px] italic">"{src.text.substring(0, 150)}..."</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-slate-50/50">
                  <div className="max-w-4xl mx-auto relative">
                    <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={documents.length > 0 ? "Ask about your data..." : "Add documents first to use RAG"}
                      disabled={isProcessing || documents.length === 0}
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm disabled:opacity-50 transition-all"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isProcessing || !inputValue.trim() || documents.length === 0}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-lg disabled:bg-slate-300 disabled:shadow-none"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Inspector Panel */}
              <aside className="w-96 bg-white overflow-y-auto hidden lg:flex flex-col border-l">
                <div className="p-6 border-b flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-600" />
                    RAG Inspector
                  </h3>
                </div>
                
                <div className="p-6 space-y-6">
                  {lastRetrieval.length > 0 ? (
                    <>
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Semantic Context</h4>
                        <div className="space-y-4">
                          {lastRetrieval.map((chunk, i) => (
                            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-700 leading-relaxed relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-1 bg-indigo-600 text-[8px] text-white font-bold rounded-bl">
                                MATCH {i + 1}
                              </div>
                              <div className="font-bold text-indigo-700 mb-1">{documents.find(d => d.id === chunk.docId)?.title}</div>
                              {chunk.text}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <h4 className="text-xs font-bold text-indigo-700 mb-2">Agent Logic</h4>
                        <p className="text-xs text-indigo-900 leading-relaxed">
                          The decision layer selected <span className="font-bold">"{lastAction?.type}"</span> because: {lastAction?.reasoning}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                      <LayoutDashboard className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-sm text-slate-400">Ask a question to see <br/>retrieval analytics</p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Add New Document */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-indigo-600" />
                      Add to Knowledge Base
                    </h3>
                    <form onSubmit={handleAddDocument} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Document Title</label>
                        <input 
                          name="title"
                          type="text" 
                          required
                          placeholder="Project Proposal 2024..."
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Content</label>
                        <textarea 
                          name="content"
                          required
                          rows={12}
                          placeholder="Paste your document content here. The assistant will chunk and index it for RAG retrieval..."
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        ></textarea>
                      </div>
                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Database className="w-4 h-4" />
                        Index Document
                      </button>
                    </form>
                  </div>
                </div>

                {/* Document List */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-slate-800">Indexed Files ({documents.length})</h3>
                    <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">SYSTEM: READY</div>
                  </div>
                  
                  {documents.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl py-12 flex flex-col items-center justify-center text-center">
                      <FileText className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-slate-400">No documents indexed yet.<br/>Upload text to enable AI reasoning.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {documents.map((doc) => (
                        <div key={doc.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <FileText className="w-5 h-5 text-indigo-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800">{doc.title}</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{doc.chunks.length} Chunks Indexed</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteDocument(doc.id)}
                              className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed italic">
                            "{doc.content.substring(0, 300)}..."
                          </p>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-600 bg-indigo-50/50 w-fit px-3 py-1.5 rounded-full border border-indigo-100">
                             <Zap className="w-3 h-3" />
                             Semantic Vectorization Complete
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-24 right-6 z-50">
        <button 
          onClick={() => setActiveTab(activeTab === 'chat' ? 'docs' : 'chat')}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
        >
          {activeTab === 'chat' ? <Database className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default App;
