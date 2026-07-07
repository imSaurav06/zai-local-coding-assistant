import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { projectService } from '../services/projectService';
import { historyService } from '../services/historyService';
import Sidebar from '../components/Sidebar';
import MobileHeader from '../components/MobileHeader';
import MessageBubble from '../components/MessageBubble';
import PromptComposer from '../components/PromptComposer';
import HistoryDrawer from '../components/HistoryDrawer';
import ProfileModal from '../components/ProfileModal';
import ErrorMessage from '../components/ErrorMessage';
import { FiCpu, FiPlus, FiAlertCircle } from 'react-icons/fi';

export default function Workspace() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Navigation & Dialog toggles
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Mode state: 'ask' | 'build' | 'tools'
  const [activeMode, setActiveMode] = useState('build');
  
  // Conversation thread
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Monitor location state from redirects (e.g. HistoryDetails or Profile redirects)
  useEffect(() => {
    if (location.state) {
      if (location.state.openHistory) {
        setHistoryDrawerOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
      } else if (location.state.openProfile) {
        setProfileModalOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
      } else if (location.state.historyId) {
        const loadHistoryItem = async () => {
          try {
            setError('');
            setLoading(true);
            const historyItem = await historyService.getHistoryById(location.state.historyId);
            handleSelectHistoryItem(historyItem);
          } catch (err) {
            setError('Could not retrieve history record.');
          } finally {
            setLoading(false);
          }
        };
        loadHistoryItem();
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location, navigate]);


  // Mode settings configurations
  const [buildOptions, setBuildOptions] = useState({
    projectName: '',
    projectType: 'Web Application',
    frontendFramework: 'React.js (Vite)',
    backendFramework: 'Express.js (Node)',
    database: 'MongoDB (Mongoose)',
    authRequired: 'Yes',
    adminRequired: 'No',
    designPreference: 'Dark Navy Professional'
  });

  const [selectedTool, setSelectedTool] = useState({
    id: 'gen-react-component',
    label: 'Generate React Component',
    promptPrefix: 'Generate a React component based on this request:\n\n'
  });

  const chatEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = () => {
    setMessages([]);
    setPrompt('');
    setError('');
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;

    setError('');
    setLoading(true);

    const userText = prompt;
    const userMsg = { sender: 'user', content: userText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');

    try {
      if (activeMode === 'build') {
        // Build Project Mode logic
        const payload = {
          prompt: userText,
          projectName: buildOptions.projectName,
          projectType: buildOptions.projectType,
          frontendFramework: buildOptions.frontendFramework,
          backendFramework: buildOptions.backendFramework,
          database: buildOptions.database,
          authRequired: buildOptions.authRequired,
          adminRequired: buildOptions.adminRequired,
          designPreference: buildOptions.designPreference
        };

        const response = await projectService.generateProject(payload);

        // Save history in background
        const savedItem = await historyService.saveHistory({
          prompt: `Build Project: ${payload.projectName || 'Dynamic Project'} - ${userText.substring(0, 40)}...`,
          response: response.result,
          type: 'project',
          model: response.model
        });

        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            content: 'I have successfully scaffolded your project blueprints and starter directory files.',
            timestamp: new Date(),
            model: response.model,
            generatedProject: {
              projectName: payload.projectName || 'Dynamic Project',
              projectType: payload.projectType,
              frontendFramework: payload.frontendFramework,
              backendFramework: payload.backendFramework,
              database: payload.database,
              result: response.result,
              model: response.model,
              projectId: response.projectId,
              files: response.files,
              authRequired: payload.authRequired,
              adminRequired: payload.adminRequired,
              designPreference: payload.designPreference
            }
          }
        ]);

      } else if (activeMode === 'tools') {
        // Code Tools Mode logic
        const combinedPrompt = selectedTool.promptPrefix + userText;
        const response = await chatService.sendMessage({ prompt: combinedPrompt });

        await historyService.saveHistory({
          prompt: `${selectedTool.label}: ${userText.substring(0, 40)}...`,
          response: response.message,
          type: 'code',
          model: response.model
        });

        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            content: response.message,
            timestamp: new Date(response.createdAt),
            model: response.model
          }
        ]);

      } else {
        // Ask AI Mode logic
        const response = await chatService.sendMessage({ prompt: userText });

        await historyService.saveHistory({
          prompt: userText,
          response: response.message,
          type: 'chat',
          model: response.model
        });

        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            content: response.message,
            timestamp: new Date(response.createdAt),
            model: response.model
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Connection with Z.ai API failed. Check backend service status.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = (historyItem) => {
    const userMsg = { sender: 'user', content: historyItem.prompt, timestamp: new Date(historyItem.createdAt) };
    
    const isProject = historyItem.type === 'project';
    const assistantMsg = {
      sender: 'assistant',
      content: isProject ? 'I have scaffolded the project structure for you.' : historyItem.response,
      timestamp: new Date(historyItem.createdAt),
      model: historyItem.model,
      generatedProject: isProject ? {
        projectName: historyItem.prompt.replace('Build Project: ', '').split(' - ')[0] || 'ScaffoldedProject',
        result: historyItem.response,
        model: historyItem.model,
        projectId: historyItem.projectId || null
      } : null
    };

    setMessages([userMsg, assistantMsg]);
    setActiveMode(historyItem.type === 'code' ? 'tools' : historyItem.type);
  };

  // Chips/prompts for empty states
  const emptyStateOptions = {
    ask: {
      title: 'What are you building today?',
      subtitle: 'Ask a coding question or describe what layout components you need.',
      chips: [
        'Create a React login page using Tailwind CSS.',
        'Generate an Express.js API for user registration using bcrypt and JWT.',
        'Create a MongoDB schema for a fitness tracker app.',
        'Explain time complexity of quicksort vs mergesort.'
      ]
    },
    build: {
      title: 'Scaffold a new project structure',
      subtitle: 'Z.ai will generate a setup framework configuration and starter codes.',
      chips: [
        'Generate a complete folder structure for a MERN SaaS dashboard.',
        'Scaffold a simple React landing page for a gym website.',
        'Create an E-commerce backend boilerplate with MongoDB.',
        'Generate a real-time chat application layout using Node.js.'
      ]
    },
    tools: {
      title: 'Select a custom developer tool',
      subtitle: 'Audits script bugs, explains logic flows, or designs schemas.',
      chips: [
        'Fix this React code and explain the bug: function App(){ return <h1>Hello</h2> }',
        'Write a debounce utility script in Javascript.',
        'Generate MongoDB User schema with location fields.',
        'Write an Express router router.post for /profile uploads.'
      ]
    }
  };

  const currentEmptyState = emptyStateOptions[activeMode] || emptyStateOptions.ask;

  const getHeaderInfo = () => {
    switch (activeMode) {
      case 'build':
        return { title: 'Build Project', desc: 'Generate project architecture frameworks and starter codebase blueprints.' };
      case 'tools':
        return { title: 'Code Tools', desc: 'Audit bugs, explain scripts, or generate snippets using pre-defined tools.' };
      case 'ask':
      default:
        return { title: 'Ask AI Assistant', desc: 'Ask coding questions, refactor script designs, or verify algorithms.' };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col lg:flex-row font-sans">
      {/* Mobile Top Bar */}
      <MobileHeader 
        onMenuToggle={() => setSidebarOpen(prev => !prev)} 
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        onNewChat={handleNewChat}
        onOpenHistory={() => setHistoryDrawerOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Workspace Area */}
      <div className="flex-grow flex flex-col min-w-0 min-h-screen relative">
        {/* Header */}
        <header className="hidden lg:flex flex-col justify-center px-8 py-4 border-b border-dark-border/40 bg-dark-sidebar/10 select-none">
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">{headerInfo.title}</h1>
          <p className="text-[10px] text-dark-muted mt-0.5">{headerInfo.desc}</p>
        </header>

        {/* Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-4xl mx-auto w-full scrollbar-thin">
          {messages.length === 0 ? (
            <div className="py-12 max-w-2xl mx-auto space-y-8 animate-fadeIn">
              {/* Center description */}
              <div className="text-center space-y-3">
                <div className="p-3.5 bg-brand-500/10 text-brand-500 rounded-2xl w-fit mx-auto border border-brand-500/20">
                  <FiCpu className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">{currentEmptyState.title}</h2>
                <p className="text-xs text-dark-muted max-w-md mx-auto leading-relaxed">{currentEmptyState.subtitle}</p>
              </div>

              {/* Grid Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 select-none">
                {currentEmptyState.chips.map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(chip)}
                    className="p-3.5 text-left bg-dark-card border border-dark-border hover:border-brand-500/35 rounded-xl text-xs font-semibold text-dark-muted hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 w-full animate-fadeIn pb-12">
              {messages.map((msg, index) => (
                <MessageBubble key={index} msg={msg} />
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Sticky Composer */}
        <div className="border-t border-dark-border/30 bg-dark-bg/80 backdrop-blur-md px-4 py-4 md:px-8">
          <PromptComposer 
            prompt={prompt} 
            setPrompt={setPrompt} 
            onSend={handleSend} 
            loading={loading}
            activeMode={activeMode}
            buildOptions={buildOptions}
            setBuildOptions={setBuildOptions}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
          />
          
          {error && (
            <div className="max-w-4xl mx-auto mt-3 animate-fadeIn flex items-center gap-2 bg-red-950/20 border border-red-500/25 p-3 rounded-xl text-xs text-red-400 font-semibold select-none">
              <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* History Drawer */}
      <HistoryDrawer 
        isOpen={historyDrawerOpen} 
        onClose={() => setHistoryDrawerOpen(false)} 
        onSelectHistoryItem={handleSelectHistoryItem}
      />

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
      />
    </div>
  );
}
