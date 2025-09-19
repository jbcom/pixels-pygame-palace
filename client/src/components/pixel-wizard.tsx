import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  X, 
  Send, 
  Sparkles,
  Minimize2,
  Maximize2,
  Bot,
  Heart,
  Zap,
  Star,
  Rocket,
  Code2,
  Gamepad2
} from "lucide-react";
import type { UserProfile, ConversationMessage, WizardState } from "@shared/schema";
import { 
  getUserProfile, 
  saveUserProfile,
  updateUserProfile,
  createNewProfile,
  getWizardState,
  saveWizardState,
  getConversationHistory,
  saveConversationHistory
} from "@/lib/user-profile";
import {
  dialogFlows,
  processDialogStep,
  createMessage,
  getDialogFlow,
  getPixelResponse,
  PixelMood,
  getPixelMood,
  skillLevelResponses
} from "@/lib/pixel-dialog";
import { useLocation } from "wouter";

interface PixelWizardProps {
  onClose?: () => void;
  onAction?: (action: string, data?: any) => void;
  isOverlay?: boolean;
}

// Pixel Avatar Component
const PixelAvatar = ({ mood = PixelMood.Happy, size = "md" }: { mood?: PixelMood; size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };
  
  const moodColors = {
    [PixelMood.Happy]: "from-cyan-400 to-blue-500",
    [PixelMood.Excited]: "from-pink-400 to-purple-500",
    [PixelMood.Thinking]: "from-yellow-400 to-orange-500",
    [PixelMood.Helpful]: "from-green-400 to-teal-500",
    [PixelMood.Celebrating]: "from-purple-400 to-pink-500",
    [PixelMood.Curious]: "from-blue-400 to-indigo-500",
    [PixelMood.Encouraging]: "from-rose-400 to-pink-500",
    [PixelMood.Proud]: "from-amber-400 to-yellow-500"
  };
  
  const moodIcons = {
    [PixelMood.Happy]: <Gamepad2 className="w-6 h-6 text-white" />,
    [PixelMood.Excited]: <Rocket className="w-6 h-6 text-white" />,
    [PixelMood.Thinking]: <Code2 className="w-6 h-6 text-white" />,
    [PixelMood.Helpful]: <Heart className="w-6 h-6 text-white" />,
    [PixelMood.Celebrating]: <Star className="w-6 h-6 text-white" />,
    [PixelMood.Curious]: <Sparkles className="w-6 h-6 text-white" />,
    [PixelMood.Encouraging]: <Zap className="w-6 h-6 text-white" />,
    [PixelMood.Proud]: <Star className="w-6 h-6 text-white" />
  };
  
  return (
    <motion.div 
      className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br ${moodColors[mood]} p-2 shadow-lg`}
      animate={{ 
        scale: [1, 1.1, 1],
        rotate: [0, 5, -5, 0]
      }}
      transition={{ 
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse"
      }}
    >
      <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm" />
      <div className="relative flex items-center justify-center h-full">
        {moodIcons[mood]}
      </div>
      <motion.div 
        className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
};

export default function PixelWizard({ onClose, onAction, isOverlay = false }: PixelWizardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // UI State
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentMood, setCurrentMood] = useState<PixelMood>(PixelMood.Happy);
  
  // User & Conversation State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [wizardState, setWizardState] = useState<WizardState>(getWizardState());
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentFlow, setCurrentFlow] = useState<any[]>([]);
  const [flowIndex, setFlowIndex] = useState(0);
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize on mount
  useEffect(() => {
    const profile = getUserProfile();
    setUserProfile(profile);
    
    const history = getConversationHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      // Start initial conversation
      const flow = getDialogFlow(profile ? 'returning' : 'firstVisit', profile);
      setCurrentFlow(flow);
      if (flow.length > 0) {
        processNextStep(flow, 0, profile);
      }
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Process next step in dialog flow
  const processNextStep = (flow: any[], index: number, profile: UserProfile | null) => {
    if (index >= flow.length) {
      // Flow complete
      if (wizardState.currentStep === 'welcome' && profile) {
        const updatedProfile = updateUserProfile({ onboardingComplete: true });
        setUserProfile(updatedProfile);
        saveWizardState({ ...wizardState, currentStep: 'complete' });
      }
      return;
    }

    const step = flow[index];
    
    // Check condition if exists
    if (step.condition && !step.condition(profile)) {
      processNextStep(flow, index + 1, profile);
      return;
    }

    if (step.pixel) {
      const content = processDialogStep(step, profile);
      const mood = getPixelMood(step.mood || 'greeting');
      setCurrentMood(mood);
      
      setIsTyping(true);
      setTimeout(() => {
        const message = createMessage(content, 'pixel', step.quickReplies);
        setMessages(prev => [...prev, message]);
        setIsTyping(false);
        
        if (step.getUserName) {
          setWaitingForInput('name');
        } else if (step.getInput) {
          setWaitingForInput(step.getInput);
        } else if (!step.quickReplies) {
          // Auto-continue if no user input needed
          setTimeout(() => {
            processNextStep(flow, index + 1, profile);
          }, 1500);
        }
      }, 1000);
    }
    
    setFlowIndex(index);
  };

  // Handle quick reply selection
  const handleQuickReply = (reply: string) => {
    const userMessage = createMessage(reply, 'user');
    setMessages(prev => [...prev, userMessage]);
    
    // Process reply based on context
    if (reply.includes("First time")) {
      const profile = userProfile || createNewProfile("Friend", 'beginner');
      setUserProfile(profile);
      processNextStep(currentFlow, flowIndex + 1, profile);
    } else if (reply.includes("I've tried")) {
      const profile = userProfile || createNewProfile("Friend", 'learning');
      setUserProfile(profile);
      processNextStep(currentFlow, flowIndex + 1, profile);
    } else if (reply.includes("I know Python")) {
      const profile = userProfile || createNewProfile("Friend", 'confident');
      setUserProfile(profile);
      processNextStep(currentFlow, flowIndex + 1, profile);
    } else if (reply.includes("I'm a pro")) {
      const profile = userProfile || createNewProfile("Friend", 'pro');
      setUserProfile(profile);
      processNextStep(currentFlow, flowIndex + 1, profile);
    } else if (reply.includes("Let's do this")) {
      // Navigate to project builder
      onAction?.('createProject');
      setLocation('/project-builder');
    } else if (reply.includes("Show me around")) {
      // Start tour
      onAction?.('startTour');
    } else if (reply.includes("learn Python basics")) {
      // Navigate to lessons
      onAction?.('startLessons');
      setLocation('/lesson/lesson-1');
    } else if (reply.includes("Continue my project")) {
      onAction?.('continueProject');
      setLocation('/project-builder');
    } else if (reply.includes("Browse gallery")) {
      setLocation('/gallery');
    } else {
      // Handle genre selections
      if (reply.includes("Platformer") || reply.includes("Puzzle") || reply.includes("Adventure") || 
          reply.includes("Racing") || reply.includes("Music") || reply.includes("Tower Defense")) {
        const genres = userProfile?.preferredGenres || [];
        const genreType = reply.split(" ")[0].toLowerCase();
        if (!genres.includes(genreType)) {
          genres.push(genreType);
          updateUserProfile({ preferredGenres: genres });
        }
      }
      processNextStep(currentFlow, flowIndex + 1, userProfile);
    }
    
    // Save conversation
    saveConversationHistory(messages);
  };

  // Handle text input submission
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    const userMessage = createMessage(inputValue, 'user');
    setMessages(prev => [...prev, userMessage]);
    
    if (waitingForInput === 'name') {
      const profile = createNewProfile(inputValue, 'beginner');
      setUserProfile(profile);
      setWaitingForInput(null);
      processNextStep(currentFlow, flowIndex + 1, profile);
    } else if (waitingForInput === 'mascotName') {
      const updatedProfile = updateUserProfile({ mascotName: inputValue });
      setUserProfile(updatedProfile);
      setWaitingForInput(null);
      
      const thankYouMessage = createMessage(
        `I love it! From now on, call me ${inputValue}! 🎭`,
        'pixel'
      );
      setMessages(prev => [...prev, thankYouMessage]);
    } else {
      // General conversation
      setIsTyping(true);
      setTimeout(() => {
        const response = getPixelResponse('greetings');
        const pixelMessage = createMessage(response, 'pixel');
        setMessages(prev => [...prev, pixelMessage]);
        setIsTyping(false);
      }, 1000);
    }
    
    setInputValue("");
    saveConversationHistory(messages);
  };

  // Toggle minimize/maximize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Close wizard
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed ${isOverlay ? 'inset-0 flex items-center justify-center z-50' : 'bottom-4 right-4 z-40'} ${isMinimized ? 'w-16 h-16' : isOverlay ? 'w-full max-w-2xl' : 'w-96 h-[600px]'}`}
      >
        {/* Overlay backdrop */}
        {isOverlay && !isMinimized && (
          <motion.div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
        )}
        
        {/* Chat Window */}
        <div className={`relative ${isMinimized ? 'w-16 h-16' : 'w-full h-full'} bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/20 overflow-hidden`}>
          {isMinimized ? (
            // Minimized state - just show avatar
            <motion.button
              className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-colors"
              onClick={toggleMinimize}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <PixelAvatar mood={currentMood} size="md" />
            </motion.button>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200/20 dark:border-gray-700/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center space-x-3">
                  <PixelAvatar mood={currentMood} size="sm" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {userProfile?.mascotName || "Pixel"}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Your Game Building Sidekick</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMinimize}
                    className="w-8 h-8"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                  {onClose && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClose}
                      className="w-8 h-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className={`flex-1 ${isOverlay ? 'h-96' : 'h-[440px]'} p-4`} ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {message.role === 'pixel' && (
                          <PixelAvatar mood={currentMood} size="sm" />
                        )}
                        <div className={`rounded-2xl px-4 py-2 ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Quick Replies */}
                  {messages.length > 0 && messages[messages.length - 1].quickReplies && (
                    <motion.div 
                      className="flex flex-wrap gap-2 mt-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {messages[messages.length - 1].quickReplies!.map((reply, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickReply(reply)}
                          className="text-xs hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10"
                        >
                          {reply}
                        </Button>
                      ))}
                    </motion.div>
                  )}
                  
                  {/* Typing indicator */}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center space-x-2"
                    >
                      <PixelAvatar mood={PixelMood.Thinking} size="sm" />
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                        <motion.div className="flex space-x-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-gray-400 rounded-full"
                              animate={{ y: [-2, 2, -2] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.1
                              }}
                            />
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-gray-200/20 dark:border-gray-700/20 p-4 bg-white/50 dark:bg-gray-900/50">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex space-x-2"
                >
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={waitingForInput ? "Type your answer..." : "Type a message..."}
                    className="flex-1 bg-white/80 dark:bg-gray-800/80"
                    disabled={isTyping}
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={isTyping || !inputValue.trim()}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}