import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Eye, Code2, Gamepad2, Star, Users, Play, 
  Filter, Grid3X3, Trophy, Sparkles, ArrowRight, Heart,
  Calendar, User, Zap, Palette, Clock, Plus
} from "lucide-react";
import type { Project } from "@shared/schema";
import { motion } from "framer-motion";

export default function Gallery() {
  const [searchTerm, setSearchTerm] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/gallery"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <motion.div 
                className="relative w-16 h-16 mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-lg opacity-75"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-full w-16 h-16 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </motion.div>
              <p className="text-muted-foreground font-medium">Loading amazing student projects...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredAndSortedProjects = projects
    ?.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesTemplate = templateFilter === "all" || project.template === templateFilter;
      return matchesSearch && matchesTemplate;
    })
    ?.sort((a, b) => {
      if (sortBy === "newest") {
        // Backend already returns projects sorted by publishedAt (newest first)
        // For additional client-side sorting, use publishedAt if available
        if (a.publishedAt && b.publishedAt) {
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        }
        return 0; // Keep backend order if timestamps are missing
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    }) ?? [];

  const getTemplateDisplayName = (template: string) => {
    const templates: Record<string, string> = {
      "pong": "Pong Game",
      "snake": "Snake Game", 
      "platformer": "Platformer",
      "shooter": "Space Shooter",
      "puzzle": "Puzzle Game",
      "rpg": "RPG Adventure",
      "blank": "Custom Project"
    };
    return templates[template] || template;
  };

  const getTemplateIcon = (template: string) => {
    switch (template) {
      case "pong": return "🏓";
      case "snake": return "🐍";
      case "platformer": return "🏃‍♂️";
      case "shooter": return "🚀";
      case "puzzle": return "🧩";
      case "rpg": return "⚔️";
      default: return "🎮";
    }
  };

  const uniqueTemplates = Array.from(new Set(projects?.map(p => p.template) || []));

  // Utility functions for timestamp handling
  const formatTimeAgo = (publishedAt: string | Date | null): string => {
    if (!publishedAt) return 'Published';
    
    const now = new Date();
    const publishTime = new Date(publishedAt);
    const diffMs = now.getTime() - publishTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just published';
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`;
  };

  const isRecentlyPublished = (publishedAt: string | Date | null): boolean => {
    if (!publishedAt) return false;
    const now = new Date();
    const publishTime = new Date(publishedAt);
    const diffHours = (now.getTime() - publishTime.getTime()) / (1000 * 60 * 60);
    return diffHours <= 48; // Consider "recent" if published within 48 hours
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
      {/* Header */}
      <header className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link href="/">
                <div className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-lg blur opacity-75"></div>
                    <div className="relative bg-white dark:bg-gray-900 rounded-lg p-1.5">
                      <Gamepad2 className="text-primary h-6 w-6" />
                    </div>
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">PyGame Academy</h1>
                </div>
              </Link>
            </motion.div>
            
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/">
                  <Button variant="ghost" size="sm" data-testid="nav-home">
                    Home
                  </Button>
                </Link>
                <Link href="/project-builder">
                  <Button variant="ghost" size="sm" data-testid="nav-builder">
                    <Code2 className="h-4 w-4 mr-1" />
                    Builder
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="bg-primary/10 text-primary" data-testid="nav-gallery">
                  <Trophy className="h-4 w-4 mr-1" />
                  Gallery
                </Button>
              </nav>
              
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg transition-all duration-300 hover:scale-105">
                <Sparkles className="h-4 w-4 mr-1" />
                Profile
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background opacity-90"></div>
        
        <div className="container mx-auto px-4 py-8 md:py-12">
          <motion.div 
            className="text-center space-y-6 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Trophy className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Community Showcase
              </span>
            </div>
            
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
                  Student Gallery
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Discover incredible games created by students like you! Get inspired, learn from others' code, 
                and showcase your own amazing creations to the world.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <motion.div 
                className="flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href="/project-builder">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-primary to-secondary text-white hover:shadow-xl transition-all duration-300 group"
                    data-testid="button-create-project"
                  >
                    <Code2 className="h-5 w-5 mr-2" />
                    Create Your Game
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </motion.div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-md mx-auto pt-6">
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Gamepad2 className="h-6 w-6 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{filteredAndSortedProjects.length}</div>
                <div className="text-sm text-muted-foreground">Published Games</div>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{uniqueTemplates.length}</div>
                <div className="text-sm text-muted-foreground">Game Types</div>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">★★★★★</div>
                <div className="text-sm text-muted-foreground">Community Rating</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filters and Controls */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-8 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search games by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-900 border-border/50"
                    data-testid="search-projects"
                  />
                </div>
              </div>
              
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="bg-white dark:bg-gray-900 border-border/50" data-testid="filter-template">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter by type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTemplates.map((template) => (
                    <SelectItem key={template} value={template}>
                      {getTemplateIcon(template)} {getTemplateDisplayName(template)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white dark:bg-gray-900 border-border/50" data-testid="sort-projects">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndSortedProjects.length} of {projects?.length || 0} projects
              </p>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Grid3X3 className="h-4 w-4" />
                <span>Grid View</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          {filteredAndSortedProjects.length === 0 ? (
            <motion.div 
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full flex items-center justify-center">
                  <Gamepad2 className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No projects found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || templateFilter !== "all" 
                    ? "Try adjusting your search or filters to find more projects."
                    : "Be the first to publish a project to the gallery!"}
                </p>
                <Link href="/project-builder">
                  <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Project
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="group"
                >
                  <Card className="relative overflow-hidden hover:shadow-2xl transition-all duration-500 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50 hover:border-primary/30 h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                    
                    {/* Project Thumbnail */}
                    <div className="relative overflow-hidden h-48 bg-gradient-to-br from-primary/5 to-secondary/5">
                      {project.thumbnailDataUrl ? (
                        <img 
                          src={project.thumbnailDataUrl} 
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          data-testid={`thumbnail-${project.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                          <div className="text-center space-y-3">
                            <div className="text-4xl">{getTemplateIcon(project.template)}</div>
                            <div className="text-sm font-medium text-muted-foreground">
                              {getTemplateDisplayName(project.template)}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-3 right-3 flex flex-col space-y-2">
                        <Badge variant="secondary" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                          {getTemplateIcon(project.template)} {getTemplateDisplayName(project.template)}
                        </Badge>
                        {isRecentlyPublished(project.publishedAt) && (
                          <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg animate-pulse">
                            <Sparkles className="h-3 w-3 mr-1" />
                            NEW
                          </Badge>
                        )}
                      </div>
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-3 left-3 right-3">
                          <Link href={`/gallery/${project.id}`}>
                            <Button size="sm" className="w-full bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                              <Play className="h-4 w-4 mr-2" />
                              View Project
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                    
                    <CardHeader className="pb-3 relative z-10">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors truncate">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="text-sm mt-1 line-clamp-2">
                            {project.description || "An amazing Python game creation!"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0 space-y-4 relative z-10">
                      {/* Project Stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>Student</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Code2 className="h-3 w-3" />
                            <span>{project.files.length} files</span>
                          </div>
                          {project.assets.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <Palette className="h-3 w-3" />
                              <span>{project.assets.length} assets</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Publication Info */}
                      <div className="flex items-center text-xs text-muted-foreground mb-4">
                        <Clock className="h-3 w-3 mr-1" />
                        <span className={`${isRecentlyPublished(project.publishedAt) ? 'text-emerald-600 font-medium' : ''}`}>
                          {formatTimeAgo(project.publishedAt)}
                        </span>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <Link href={`/gallery/${project.id}`} className="flex-1">
                          <Button 
                            size="sm" 
                            className="w-full bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg transition-all duration-300 group"
                            data-testid={`view-project-${project.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View & Play
                            <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                        
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-primary hover:text-white hover:border-primary transition-all duration-300"
                          data-testid={`like-project-${project.id}`}
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}