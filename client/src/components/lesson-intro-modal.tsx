import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Target, Code, Rocket, ChevronRight, Sparkles, Trophy, Zap } from "lucide-react";
import type { Lesson } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

interface LessonIntroModalProps {
  lesson: Lesson;
  isOpen: boolean;
  onClose: () => void;
}

const iconMap: Record<string, any> = {
  "Import": Code,
  "Create": Sparkles,
  "Draw": Target,
  "Work": Zap,
  "Capture": BookOpen,
  "Handle": Rocket,
  "Implement": Trophy,
  "Design": Sparkles,
  "Add": ChevronRight,
  "Control": Target,
  "Set": Code,
  "Understand": BookOpen,
  "Debug": Zap,
};

function getIconForObjective(objective: string) {
  const firstWord = objective.split(" ")[0];
  return iconMap[firstWord] || ChevronRight;
}

export default function LessonIntroModal({ lesson, isOpen, onClose }: LessonIntroModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={handleClose}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 border-2 border-primary/20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: isAnimating ? 1 : 0, scale: isAnimating ? 1 : 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Header with gradient background */}
              <div className="relative bg-gradient-to-br from-[#3776AB] to-[#5B8FC7] text-white p-8 rounded-t-lg">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\" viewBox=\"0 0 60 60\"%3E%3Cg fill=\"%23FFD343\" fill-opacity=\"0.1\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/svg%3E')] opacity-10"></div>
                <div className="relative z-10">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 mb-2"
                  >
                    <div className="p-2 bg-[#FFD343] text-[#3776AB] rounded-lg">
                      <Rocket className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                      Lesson {lesson.order}
                    </span>
                  </motion.div>
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl font-bold mb-3"
                  >
                    {lesson.title}
                  </motion.h2>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl text-white/90 leading-relaxed"
                  >
                    {lesson.intro || lesson.description}
                  </motion.p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {/* What You'll Learn Section */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">What You'll Learn</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lesson.learningObjectives?.map((objective, index) => {
                      const Icon = getIconForObjective(objective);
                      return (
                        <motion.div
                          key={index}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="p-1.5 bg-[#FFD343] text-[#3776AB] rounded">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm text-muted-foreground leading-relaxed">{objective}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Your Goal Section */}
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                      <Target className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">Your Goal</h3>
                  </div>
                  <Card className="border-2 border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10">
                    <CardContent className="p-4">
                      <p className="text-base text-muted-foreground leading-relaxed">
                        {lesson.goalDescription || "Complete all the steps to master this concept and build something amazing!"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Preview Section */}
                {lesson.previewCode && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Code className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground">Preview</h3>
                    </div>
                    <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm rounded-lg border border-gray-800">
                      <pre className="whitespace-pre-wrap">{lesson.previewCode}</pre>
                    </div>
                  </motion.div>
                )}

                {/* Call to Action */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex justify-center pt-4"
                >
                  <Button
                    onClick={handleClose}
                    size="lg"
                    className="bg-gradient-to-r from-[#3776AB] to-[#5B8FC7] hover:from-[#2865A0] hover:to-[#4A7EB6] text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                    data-testid="button-start-lesson"
                  >
                    <Rocket className="mr-3 h-5 w-5" />
                    Let's Start!
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}