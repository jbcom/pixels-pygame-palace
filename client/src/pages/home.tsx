import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Gamepad2, 
  Sparkles,
  MessageCircle,
  Zap
} from "lucide-react";
import PixelWizard from "@/components/pixel-wizard";
import { getUserProfile } from "@/lib/user-profile";

export default function Home() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    const savedProfile = getUserProfile();
    if (savedProfile) {
      setUserProfile(savedProfile);
    }
    // Always show wizard as the main interface
    setShowWizard(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
      {/* Header with Pixel's PyGame Palace branding */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-xl p-2">
                  <Gamepad2 className="text-purple-600 h-8 w-8" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Pixel's PyGame Palace
                </h1>
                <p className="text-xs text-muted-foreground">Your Conversational Game Building Adventure</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5 text-purple-600" />
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Minimal with focus on Pixel */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="inline-block mb-6"
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl opacity-50"></div>
              <div className="relative bg-white dark:bg-gray-900 rounded-full p-8 shadow-2xl">
                <Gamepad2 className="h-24 w-24 text-purple-600" />
              </div>
            </div>
          </motion.div>
          
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Welcome to Pixel's PyGame Palace!
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            I'm Pixel, your friendly game building companion! I'll guide you through creating amazing games 
            with Python and PyGame. Just chat with me about what you want to build!
          </p>
          
          {/* Call to Action */}
          <motion.div
            className="flex flex-col items-center space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center space-x-2 text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
              <span>Chat with Pixel to get started</span>
            </div>
            
            <motion.div
              className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl"
              whileHover={{ scale: 1.02 }}
            >
              <Zap className="h-6 w-6 text-purple-600" />
              <div className="text-left">
                <p className="font-semibold">Try saying:</p>
                <p className="text-sm text-muted-foreground">
                  "I want to make a platform game" or "Teach me Python basics"
                </p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Fun animated background elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{
                x: Math.random() * 1000,
                y: 1000
              }}
              animate={{
                y: -100,
                x: Math.random() * 1000
              }}
              transition={{
                duration: 10 + i * 2,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-xl"></div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pixel Wizard - Always visible as the main interface */}
      {showWizard && (
        <PixelWizard
          isOverlay={false}
          onAction={(action, data) => {
            console.log('Pixel Action:', action, data);
            // Handle actions from Pixel's dialogue
            if (action === 'createProject') {
              window.location.href = '/project-builder';
            } else if (action === 'startLesson') {
              if (data?.lessonId) {
                window.location.href = `/lesson/${data.lessonId}`;
              }
            } else if (action === 'viewGallery') {
              window.location.href = '/gallery';
            }
          }}
        />
      )}
    </div>
  );
}