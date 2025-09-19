import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Gamepad2, 
  Sparkles
} from "lucide-react";
import PixelPresence from "@/components/pixel-presence";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [hasChosen, setHasChosen] = useState(false);

  // Handle navigation from Pixel
  const handleNavigation = (path: string) => {
    setHasChosen(true);
    setTimeout(() => {
      setLocation(path);
    }, 300);
  };

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

      {/* Main Content - Only shows after Pixel choice */}
      {hasChosen && (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <h2 className="text-2xl font-bold mb-4 text-muted-foreground">
              Loading your experience...
            </h2>
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
            </div>
          </motion.div>
        </div>
      )}

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

      {/* Pixel Presence System */}
      <PixelPresence 
        onNavigate={handleNavigation}
        currentPath="/"
      />
    </div>
  );
}