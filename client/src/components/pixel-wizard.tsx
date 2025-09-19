<<<<<<< Updated upstream
version https://git-lfs.github.com/spec/v1
oid sha256:8bba4e2cf9e8374007ff02857c09e0658d1fc856075e0d968354e165d7c9f9c4
size 18028
=======
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
import { DialogueEngine } from "@/lib/dialogue-engine";
import { PixelMood, getPixelMood } from "@/lib/pixel-dialog";
import { useLocation } from "wouter";

// Import generated Pixel images
import pixelHappy from '@assets/pixel/Pixel_happy_excited_expression_22a41625.png';
import pixelThinking from '@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png';
import pixelCelebrating from '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png';
import pixelConfused from '@assets/pixel/Pixel_confused_puzzled_expression_843c04f4.png';
import pixelEncouraging from '@assets/pixel/Pixel_encouraging_supportive_expression_cf958090.png';
import pixelCool from '@assets/pixel/Pixel_cool_confident_expression_ba46337f.png';
import pixelSurprised from '@assets/pixel/Pixel_surprised_wow_expression_e0d4a42f.png';
import pixelTeaching from '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png';
import pixelGaming from '@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png';
import pixelWelcoming from '@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png';
import pixelLaughing from '@assets/pixel/Pixel_laughing_joyful_expression_e1b57465.png';
import pixelSleepy from '@assets/pixel/Pixel_sleepy_tired_expression_20c2d99f.png';
import pixelDetermined from '@assets/pixel/Pixel_determined_focused_expression_036b4449.png';
import pixelShy from '@assets/pixel/Pixel_shy_bashful_expression_3fb150c2.png';
import pixelDancing from '@assets/pixel/Pixel_dancing_musical_expression_c71def5e.png';
import pixelAngry from '@assets/pixel/Pixel_angry_frustrated_expression_daa5924a.png';
import pixelProud from '@assets/pixel/Pixel_proud_achievement_expression_a968da89.png';
import pixelMischievous from '@assets/pixel/Pixel_mischievous_playful_expression_fdd56be5.png';
import pixelSad from '@assets/pixel/Pixel_sad_disappointed_expression_f88b201a.png';
import pixelCurious from '@assets/pixel/Pixel_curious_investigating_expression_7e10e865.png';
import pixelCoding from '@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png';
import pixelIdea from '@assets/pixel/Pixel_idea_eureka_expression_64420aee.png';
import pixelNinja from '@assets/pixel/Pixel_ninja_stealth_expression_50deab14.png';
import pixelSuperhero from '@assets/pixel/Pixel_superhero_flying_expression_d0432407.png';
import pixelZen from '@assets/pixel/Pixel_zen_meditation_expression_1148cb14.png';

// Map moods to generated images
const moodImages: Record<PixelMood, string> = {
  [PixelMood.Happy]: pixelHappy,
  [PixelMood.Excited]: pixelCelebrating,
  [PixelMood.Thinking]: pixelThinking,
  [PixelMood.Helpful]: pixelEncouraging,
  [PixelMood.Celebrating]: pixelCelebrating,
  [PixelMood.Curious]: pixelCurious,
  [PixelMood.Encouraging]: pixelEncouraging,
  [PixelMood.Proud]: pixelProud
};

// Additional expression images for variety
const additionalExpressions = {
  confused: pixelConfused,
  cool: pixelCool,
  surprised: pixelSurprised,
  teaching: pixelTeaching,
  gaming: pixelGaming,
  welcoming: pixelWelcoming,
  laughing: pixelLaughing,
  sleepy: pixelSleepy,
  determined: pixelDetermined,
  shy: pixelShy,
  dancing: pixelDancing,
  angry: pixelAngry,
  mischievous: pixelMischievous,
  sad: pixelSad,
  coding: pixelCoding,
  idea: pixelIdea,
  ninja: pixelNinja,
  superhero: pixelSuperhero,
  zen: pixelZen,
  thinking: pixelThinking
};

// Helper function to map context to expressions
function getExpressionForContext(context: string): keyof typeof additionalExpressions | undefined {
  const contextMap: Record<string, keyof typeof additionalExpressions> = {
    'greeting': 'welcoming',
    'hello': 'welcoming',
    'teaching': 'teaching',
    'coding': 'coding',
    'gaming': 'gaming',
    'confused': 'confused',
    'error': 'confused',
    'success': 'determined',
    'thinking': 'coding',
    'idea': 'idea',
    'loading': 'coding',
    'celebration': 'dancing',
    'proud': 'cool',
    'help': 'teaching',
    'cool': 'cool',
    'sad': 'sad',
    'tired': 'sleepy',
    'angry': 'angry',
    'frustrated': 'angry',
    'dance': 'dancing',
    'music': 'dancing',
    'ninja': 'ninja',
    'stealth': 'ninja',
    'super': 'superhero',
    'hero': 'superhero',
    'zen': 'zen',
    'meditation': 'zen',
    'laugh': 'laughing',
    'funny': 'laughing',
    'mischief': 'mischievous',
    'prank': 'mischievous',
    'shy': 'shy',
    'bashful': 'shy',
    'determined': 'determined',
    'focused': 'determined',
    'surprise': 'surprised',
    'wow': 'surprised'
  };
  
  // Find matching context
  const lowerContext = context.toLowerCase();
  for (const [key, value] of Object.entries(contextMap)) {
    if (lowerContext.includes(key)) {
      return value;
    }
  }
  
  return undefined;
}

interface PixelWizardProps {
  onClose?: () => void;
  onAction?: (action: string, data?: any) => void;
  isOverlay?: boolean;
}

// Pixel Avatar Component using generated images
const PixelAvatar = ({ mood = PixelMood.Happy, size = "md", expression }: { mood?: PixelMood; size?: "sm" | "md" | "lg"; expression?: keyof typeof additionalExpressions }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };
  
  // Choose image based on expression or mood
  const imageSrc = expression && additionalExpressions[expression] 
    ? additionalExpressions[expression] 
    : moodImages[mood];
  
  return (
    <motion.div 
      className={`relative ${sizeClasses[size]} rounded-full overflow-hidden shadow-lg border-2 border-cyan-400/50`}
      animate={{ 
        scale: [1, 1.05, 1],
      }}
      transition={{ 
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse"
      }}
    >
      <img 
        src={imageSrc} 
        alt={`Pixel ${expression || mood} expression`}
        className="w-full h-full object-cover"
        style={{ imageRendering: 'crisp-edges' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none" />
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
  const [currentExpression, setCurrentExpression] = useState<keyof typeof additionalExpressions | undefined>('welcoming');
  
  // User & Conversation State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [wizardState, setWizardState] = useState<WizardState>(getWizardState());
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null);
  
  // Dialogue Engine
  const [dialogueEngine, setDialogueEngine] = useState<DialogueEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize dialogue engine on mount
  useEffect(() => {
    const initializeDialogue = async () => {
      setIsLoading(true);
      
      const profile = getUserProfile();
      setUserProfile(profile);
      
      // Create dialogue engine instance
      const engine = new DialogueEngine();
      
      // Set up action callbacks
      engine.setActionCallback((action: string, data?: any) => {
        handleDialogueAction(action, data);
      });
      
      // Load appropriate dialogue based on user state
      const flowName = await engine.loadAppropriateDialogue(profile);
      
      // Get existing history or start new dialogue
      const history = engine.getHistory();
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Start dialogue
        const firstMessage = await engine.startDialogue();
        if (firstMessage) {
          setMessages([firstMessage]);
          setCurrentMood(getPixelMood('greeting'));
          setCurrentExpression(getExpressionForContext('greeting'));
        }
      }
      
      setDialogueEngine(engine);
      setIsLoading(false);
    };
    
    initializeDialogue();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle dialogue actions from the engine
  const handleDialogueAction = (action: string, data?: any) => {
    switch (action) {
      case 'navigate':
        if (data?.page) {
          setLocation(`/${data.page}`);
        }
        break;
        
      case 'createProject':
        if (onAction) {
          onAction('createProject', data);
        }
        if (data?.template) {
          setLocation('/project-builder');
        }
        break;
        
      case 'suggestTemplates':
        if (onAction) {
          onAction('suggestTemplates', data);
        }
        break;
        
      case 'startLesson':
        if (data?.lessonId) {
          setLocation(`/lesson/${data.lessonId}`);
        }
        break;
        
      case 'showCodeExample':
      case 'highlightCode':
      case 'showFeatureCode':
      case 'showErrorFix':
      case 'generatePractice':
      case 'setControls':
      case 'suggestDifficultyValues':
      case 'checkForErrors':
      case 'autoFix':
      case 'refreshProject':
      case 'navigateNextLesson':
        if (onAction) {
          onAction(action, data);
        }
        break;
        
      default:
        console.log('Unhandled dialogue action:', action, data);
    }
  };
  
  // Process dialogue message with typing effect
  const processDialogueMessage = async (message: ConversationMessage | null) => {
    if (!message) return;
    
    if (message.role === 'pixel' || message.role === 'system') {
      setIsTyping(true);
      setCurrentMood(getPixelMood(message.content));
      setCurrentExpression(getExpressionForContext(message.content));
      
      // Simulate typing delay
      setTimeout(() => {
        setMessages(prev => {
          // Check if message already exists
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        setIsTyping(false);
        
        // Check if waiting for input
        const content = message.content.toLowerCase();
        if (content.includes('what should i call you') || 
            content.includes('enter your name')) {
          setWaitingForInput('playerName');
        }
      }, 1000);
    } else {
      // User messages show immediately
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    }
  };

  // Handle quick reply selection
  const handleQuickReply = async (reply: string, optionIndex: number) => {
    if (!dialogueEngine) return;
    
    // Select the option in the dialogue engine
    const nextMessage = dialogueEngine.selectOption(optionIndex);
    
    // Process the next message
    processDialogueMessage(nextMessage);
    
    // Continue dialogue if there are more messages
    setTimeout(async () => {
      let msg = dialogueEngine.getNextMessage();
      while (msg) {
        processDialogueMessage(msg);
        // Check if this message has options - if so, stop
        if (msg.quickReplies && msg.quickReplies.length > 0) {
          break;
        }
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1500));
        msg = dialogueEngine.getNextMessage();
      }
    }, 100);
  };

  // Handle text input submission
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !dialogueEngine) return;
    
    const input = inputValue;
    setInputValue("");
    
    // Handle user input through dialogue engine
    const response = dialogueEngine.handleUserInput(input);
    
    if (response) {
      processDialogueMessage(response);
      
      // Continue dialogue if there are more messages
      setTimeout(async () => {
        let msg = dialogueEngine.getNextMessage();
        while (msg) {
          processDialogueMessage(msg);
          // Check if this message has options - if so, stop
          if (msg.quickReplies && msg.quickReplies.length > 0) {
            break;
          }
          // Small delay between messages
          await new Promise(resolve => setTimeout(resolve, 1500));
          msg = dialogueEngine.getNextMessage();
        }
      }, 100);
    }
    
    setWaitingForInput(null);
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
              <PixelAvatar mood={currentMood} size="md" expression={currentExpression} />
            </motion.button>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200/20 dark:border-gray-700/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center space-x-3">
                  <PixelAvatar mood={currentMood} size="sm" expression={currentExpression} />
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
                          <PixelAvatar 
                            mood={currentMood} 
                            size="sm" 
                            expression={getExpressionForContext(message.content) || currentExpression}
                          />
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
                          onClick={() => handleQuickReply(reply, idx)}
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
                      <PixelAvatar mood={PixelMood.Thinking} size="sm" expression="thinking" />
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
>>>>>>> Stashed changes
