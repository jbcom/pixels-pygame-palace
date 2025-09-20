import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  preview: string;
  category: string;
}

interface AssetSelectorProps {
  gameType: string;
  scene: string;
  onSelect: (asset: Asset) => void;
}

export default function AssetSelector({ gameType, scene, onSelect }: AssetSelectorProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Mock assets - in a real app, these would come from a database or API
  const getAssets = (): Asset[] => {
    const baseAssets: Record<string, Record<string, Asset[]>> = {
      platformer: {
        title: [
          { id: 'plat-title-1', name: 'Classic Arcade', preview: '🎮', category: 'Retro' },
          { id: 'plat-title-2', name: 'Forest Adventure', preview: '🌲', category: 'Nature' },
          { id: 'plat-title-3', name: 'Space Jump', preview: '🚀', category: 'Sci-Fi' },
          { id: 'plat-title-4', name: 'Pixel Kingdom', preview: '👑', category: 'Fantasy' },
          { id: 'plat-title-5', name: 'Neon Runner', preview: '💜', category: 'Cyberpunk' },
          { id: 'plat-title-6', name: 'Desert Quest', preview: '🌵', category: 'Adventure' }
        ]
      },
      rpg: {
        character: [
          { id: 'rpg-char-1', name: 'Knight', preview: '⚔️', category: 'Warrior' },
          { id: 'rpg-char-2', name: 'Mage', preview: '🧙', category: 'Magic' },
          { id: 'rpg-char-3', name: 'Ranger', preview: '🏹', category: 'Archer' },
          { id: 'rpg-char-4', name: 'Rogue', preview: '🗡️', category: 'Stealth' },
          { id: 'rpg-char-5', name: 'Paladin', preview: '🛡️', category: 'Tank' },
          { id: 'rpg-char-6', name: 'Druid', preview: '🌿', category: 'Nature' }
        ]
      },
      dungeon: {
        entrance: [
          { id: 'dung-ent-1', name: 'Stone Gate', preview: '🚪', category: 'Classic' },
          { id: 'dung-ent-2', name: 'Mystic Portal', preview: '🌀', category: 'Magic' },
          { id: 'dung-ent-3', name: 'Ancient Ruins', preview: '🏛️', category: 'Temple' },
          { id: 'dung-ent-4', name: 'Dark Cave', preview: '⛰️', category: 'Natural' },
          { id: 'dung-ent-5', name: 'Haunted Door', preview: '👻', category: 'Horror' },
          { id: 'dung-ent-6', name: 'Crystal Cavern', preview: '💎', category: 'Fantasy' }
        ]
      },
      racing: {
        garage: [
          { id: 'race-car-1', name: 'Speed Demon', preview: '🏎️', category: 'Sports' },
          { id: 'race-car-2', name: 'Monster Truck', preview: '🚙', category: 'Off-Road' },
          { id: 'race-car-3', name: 'Formula Racer', preview: '🏁', category: 'Formula' },
          { id: 'race-car-4', name: 'Street Runner', preview: '🚗', category: 'Street' },
          { id: 'race-car-5', name: 'Rally Beast', preview: '🚜', category: 'Rally' },
          { id: 'race-car-6', name: 'Cyber Wheels', preview: '🔮', category: 'Future' }
        ]
      },
      puzzle: {
        menu: [
          { id: 'puzz-menu-1', name: 'Block Party', preview: '⬜', category: 'Blocks' },
          { id: 'puzz-menu-2', name: 'Color Match', preview: '🎨', category: 'Colors' },
          { id: 'puzz-menu-3', name: 'Number Grid', preview: '🔢', category: 'Numbers' },
          { id: 'puzz-menu-4', name: 'Shape Shift', preview: '⭐', category: 'Shapes' },
          { id: 'puzz-menu-5', name: 'Pattern Play', preview: '🌈', category: 'Patterns' },
          { id: 'puzz-menu-6', name: 'Logic Quest', preview: '🧩', category: 'Logic' }
        ]
      },
      adventure: {
        opening: [
          { id: 'adv-open-1', name: 'Forest Path', preview: '🌳', category: 'Nature' },
          { id: 'adv-open-2', name: 'Village Square', preview: '🏘️', category: 'Town' },
          { id: 'adv-open-3', name: 'Ocean Shore', preview: '🏖️', category: 'Beach' },
          { id: 'adv-open-4', name: 'Mountain Peak', preview: '🏔️', category: 'Mountain' },
          { id: 'adv-open-5', name: 'Desert Oasis', preview: '🏜️', category: 'Desert' },
          { id: 'adv-open-6', name: 'Mystic Library', preview: '📚', category: 'Mystery' }
        ]
      },
      generic: {
        menu: [
          { id: 'gen-menu-1', name: 'Simple Start', preview: '▶️', category: 'Basic' },
          { id: 'gen-menu-2', name: 'Game Central', preview: '🎮', category: 'Gaming' },
          { id: 'gen-menu-3', name: 'Fun Zone', preview: '🎉', category: 'Party' },
          { id: 'gen-menu-4', name: 'Adventure Hub', preview: '🗺️', category: 'Explore' },
          { id: 'gen-menu-5', name: 'Play Time', preview: '🎲', category: 'Casual' },
          { id: 'gen-menu-6', name: 'Action Pack', preview: '💥', category: 'Action' }
        ]
      }
    };

    return baseAssets[gameType]?.[scene] || baseAssets.generic.menu;
  };

  const assets = getAssets();
  const assetsPerPage = 6;
  const totalPages = Math.ceil(assets.length / assetsPerPage);
  const currentAssets = assets.slice(
    currentPage * assetsPerPage,
    (currentPage + 1) * assetsPerPage
  );

  const handleSelect = (asset: Asset) => {
    setSelectedAsset(asset);
  };

  const handleConfirm = () => {
    if (selectedAsset) {
      onSelect(selectedAsset);
    }
  };

  return (
    <div className="space-y-6">
      {/* Asset Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {currentAssets.map((asset) => (
          <motion.div
            key={asset.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card
              className={`p-6 cursor-pointer transition-all ${
                selectedAsset?.id === asset.id
                  ? 'ring-2 ring-purple-600 bg-purple-50 dark:bg-purple-950/20'
                  : 'hover:shadow-lg'
              }`}
              onClick={() => handleSelect(asset)}
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="text-6xl">{asset.preview}</div>
                <div className="text-center">
                  <h3 className="font-semibold text-sm">{asset.name}</h3>
                  <p className="text-xs text-muted-foreground">{asset.category}</p>
                </div>
                {selectedAsset?.id === asset.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Confirm Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleConfirm}
          disabled={!selectedAsset}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-8"
        >
          Use This Asset
        </Button>
      </div>
    </div>
  );
}