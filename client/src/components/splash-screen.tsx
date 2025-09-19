import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Gamepad2, Rocket, Star } from "lucide-react";
import desktopSplash from "@assets/generated_images/Pixel's_PyGame_Palace_splash_208a0325.png";
import mobileSplash from "@assets/generated_images/Mobile_splash_Pixel's_Palace_10837024.png";

interface SplashScreenProps {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 3.5; // Complete in ~3 seconds
      });
    }, 100);

    // Auto-dismiss after 3 seconds
    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, 3000);

    // Mark splash as seen
    localStorage.setItem("splashScreenSeen", "true");
    localStorage.setItem("splashScreenLastShown", new Date().toISOString());

    return () => {
      clearInterval(progressInterval);
      clearTimeout(dismissTimer);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete?.();
    }, 500); // Wait for fade out animation
  };

  const handleClick = () => {
    // Allow early dismissal on click
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-purple-950 via-purple-900 to-pink-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden"
          onClick={handleClick}
          data-testid="splash-screen"
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: 0,
                }}
                animate={{
                  y: [null, -100],
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "easeInOut",
                }}
              >
                {i % 4 === 0 ? (
                  <Sparkles className="text-cyan-400 h-6 w-6" />
                ) : i % 4 === 1 ? (
                  <Gamepad2 className="text-pink-400 h-5 w-5" />
                ) : i % 4 === 2 ? (
                  <Star className="text-yellow-400 h-4 w-4" />
                ) : (
                  <Rocket className="text-purple-400 h-5 w-5" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Main splash content */}
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              delay: 0.2,
            }}
            className="relative z-10 flex flex-col items-center justify-center max-w-4xl mx-auto px-4"
          >
            {/* Splash Image */}
            <motion.div
              animate={{
                filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative mb-8"
            >
              <img
                src={isMobile ? mobileSplash : desktopSplash}
                alt="Pixel's PyGame Palace"
                className="w-full h-auto max-h-[60vh] object-contain rounded-2xl shadow-2xl border-4 border-cyan-400/30"
                style={{
                  boxShadow: "0 0 60px rgba(0, 255, 255, 0.5), 0 0 100px rgba(255, 0, 255, 0.3)",
                }}
              />
              
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent rounded-2xl animate-pulse" />
            </motion.div>

            {/* Loading section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-md"
            >
              {/* Progress bar */}
              <div className="relative mb-4">
                <Progress 
                  value={progress} 
                  className="h-3 bg-purple-800/50 shadow-lg"
                  data-testid="splash-progress"
                />
                <div 
                  className="absolute inset-0 h-3 rounded-full overflow-hidden"
                  style={{
                    background: `linear-gradient(to right, 
                      transparent ${progress - 10}%, 
                      rgba(0, 255, 255, 0.6) ${progress}%, 
                      transparent ${progress + 10}%)`,
                  }}
                />
              </div>

              {/* Loading text */}
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-center text-cyan-300 font-bold text-lg"
              >
                {progress < 30 ? "Initializing Game Engine..." :
                 progress < 60 ? "Loading Pixel's Adventures..." :
                 progress < 90 ? "Preparing Python Magic..." :
                 "Ready to Play!"}
              </motion.p>

              {/* Click to continue hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ 
                  delay: 1.5,
                  duration: 2,
                  repeat: Infinity,
                }}
                className="text-center text-cyan-200/60 text-sm mt-4"
              >
                Click anywhere to start
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Neon border effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-8 border-cyan-500/20 rounded-lg" />
            <div className="absolute inset-2 border-4 border-pink-500/20 rounded-lg" />
            <div className="absolute inset-4 border-2 border-purple-500/20 rounded-lg" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}