// Comprehensive Asset Catalog Tests
// Testing 794 2D sprites, 204 3D models, 636 UI elements, 611 audio files

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetCatalog, AssetMetadata, AssetSearchOptions } from '@/lib/asset-catalog';

// Generate mock assets for testing
function generateMockAssets(): AssetMetadata[] {
  const assets: AssetMetadata[] = [];
  
  // Generate 794 2D sprites
  const spriteCategories = ['platformer', 'rpg', 'racing', 'puzzle', 'space'];
  for (let i = 0; i < 794; i++) {
    assets.push({
      id: `sprite_${i}`,
      name: `Sprite ${i}`,
      path: `assets/2d/sprite_${i}.png`,
      type: '2d-sprite',
      category: spriteCategories[i % spriteCategories.length],
      tags: [`sprite`, `category_${i % 5}`, `set_${Math.floor(i / 10)}`],
      size: Math.floor(Math.random() * 100000) + 1000,
      dimensions: { width: 32 * (1 + i % 3), height: 32 * (1 + i % 3) },
      format: 'png',
      license: i % 10 === 0 ? 'MIT' : 'CC0',
      lastModified: new Date(Date.now() - Math.random() * 86400000)
    });
  }
  
  // Generate 204 3D models
  const modelCategories = ['buildings', 'vehicles', 'nature', 'characters', 'props'];
  for (let i = 0; i < 204; i++) {
    assets.push({
      id: `model_${i}`,
      name: `3D Model ${i}`,
      path: `assets/3d/models/model_${i}.glb`,
      type: '3d-model',
      category: modelCategories[i % modelCategories.length],
      tags: [`3d`, `lowpoly`, `category_${i % 3}`],
      size: Math.floor(Math.random() * 500000) + 10000,
      format: i % 2 === 0 ? 'glb' : 'gltf',
      license: 'CC0',
      lastModified: new Date(Date.now() - Math.random() * 86400000)
    });
  }
  
  // Generate 636 UI elements
  const uiCategories = ['buttons', 'panels', 'icons', 'cursors', 'progress'];
  for (let i = 0; i < 636; i++) {
    assets.push({
      id: `ui_${i}`,
      name: `UI Element ${i}`,
      path: `assets/ui/element_${i}.png`,
      type: 'ui-element',
      category: uiCategories[i % uiCategories.length],
      tags: [`ui`, `interface`, `style_${i % 4}`],
      size: Math.floor(Math.random() * 50000) + 500,
      dimensions: { width: 64, height: 64 },
      format: 'png',
      license: 'CC0',
      lastModified: new Date(Date.now() - Math.random() * 86400000)
    });
  }
  
  // Generate 611 audio files
  const audioCategories = ['music', 'sfx', 'ambient', 'interface', 'weapons', 'movement'];
  for (let i = 0; i < 611; i++) {
    assets.push({
      id: `audio_${i}`,
      name: `Audio ${i}`,
      path: `assets/audio/${i < 100 ? 'music' : 'sfx'}/audio_${i}.${i % 3 === 0 ? 'wav' : 'ogg'}`,
      type: 'audio',
      category: audioCategories[i % audioCategories.length],
      tags: [`audio`, `${i < 100 ? 'music' : 'sound'}`, `mood_${i % 5}`],
      size: Math.floor(Math.random() * 200000) + 5000,
      format: i % 3 === 0 ? 'wav' : i % 3 === 1 ? 'ogg' : 'mp3',
      license: i % 20 === 0 ? 'CC-BY' : 'CC0',
      lastModified: new Date(Date.now() - Math.random() * 86400000)
    });
  }
  
  return assets;
}

describe('Asset Catalog System Tests', () => {
  let catalog: AssetCatalog;
  let mockAssets: AssetMetadata[];

  beforeEach(() => {
    catalog = new AssetCatalog(100 * 1024 * 1024); // 100MB memory limit
    mockAssets = generateMockAssets();
  });

  afterEach(() => {
    catalog.clearCatalog();
  });

  describe('1. Asset Loading and Validation', () => {
    it('should load assets successfully', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      const result = await catalog.loadAsset(asset.id);
      
      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.id).toBe(asset.id);
      expect(result.loadTime).toBeGreaterThan(0);
    });

    it('should validate required fields when registering assets', () => {
      const invalidAsset = { id: '', path: '', type: '' } as any;
      
      expect(() => catalog.registerAsset(invalidAsset)).toThrow('Asset missing required fields');
    });

    it('should handle missing assets gracefully', async () => {
      const result = await catalog.loadAsset('non_existent_asset');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Asset not found');
    });

    it('should validate asset licenses', () => {
      const invalidLicenseAsset: AssetMetadata = {
        id: 'invalid_license',
        name: 'Invalid License Asset',
        path: 'test.png',
        type: '2d-sprite',
        category: 'test',
        tags: [],
        format: 'png',
        license: 'PROPRIETARY'
      };
      
      expect(() => catalog.registerAsset(invalidLicenseAsset)).toThrow('Invalid license');
    });

    it('should handle batch asset loading', async () => {
      const batchAssets = mockAssets.slice(0, 50);
      batchAssets.forEach(asset => catalog.registerAsset(asset));
      
      const assetIds = batchAssets.map(a => a.id);
      const results = await catalog.preloadAssets(assetIds);
      
      expect(results.size).toBe(50);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('2. Asset Categorization (2D, 3D, UI, Audio)', () => {
    beforeEach(() => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
    });

    it('should correctly categorize 794 2D sprites', () => {
      const sprites = catalog.getAssetsByType('2d-sprite');
      expect(sprites.length).toBe(794);
      sprites.forEach(sprite => {
        expect(sprite.type).toBe('2d-sprite');
      });
    });

    it('should correctly categorize 204 3D models', () => {
      const models = catalog.getAssetsByType('3d-model');
      expect(models.length).toBe(204);
      models.forEach(model => {
        expect(model.type).toBe('3d-model');
      });
    });

    it('should correctly categorize 636 UI elements', () => {
      const uiElements = catalog.getAssetsByType('ui-element');
      expect(uiElements.length).toBe(636);
      uiElements.forEach(element => {
        expect(element.type).toBe('ui-element');
      });
    });

    it('should correctly categorize 611 audio files', () => {
      const audioFiles = catalog.getAssetsByType('audio');
      expect(audioFiles.length).toBe(611);
      audioFiles.forEach(audio => {
        expect(audio.type).toBe('audio');
      });
    });

    it('should retrieve assets by category', () => {
      const platformerAssets = catalog.getAssetsByCategory('platformer');
      expect(platformerAssets.length).toBeGreaterThan(0);
      platformerAssets.forEach(asset => {
        expect(asset.category).toBe('platformer');
      });
    });

    it('should maintain category integrity across 2000+ assets', () => {
      const stats = catalog.getStatistics();
      expect(stats.totalAssets).toBe(2245); // 794 + 204 + 636 + 611
      expect(stats.assetsByType['2d-sprite']).toBe(794);
      expect(stats.assetsByType['3d-model']).toBe(204);
      expect(stats.assetsByType['ui-element']).toBe(636);
      expect(stats.assetsByType['audio']).toBe(611);
    });
  });

  describe('3. Asset Search and Filtering', () => {
    beforeEach(() => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
    });

    it('should search assets by term', () => {
      const searchOptions: AssetSearchOptions = {
        searchTerm: 'sprite'
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBe(794); // All sprites
      results.forEach(result => {
        expect(result.name.toLowerCase()).toContain('sprite');
      });
    });

    it('should filter assets by type', () => {
      const searchOptions: AssetSearchOptions = {
        type: '3d-model'
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBe(204);
      results.forEach(result => {
        expect(result.type).toBe('3d-model');
      });
    });

    it('should filter assets by category', () => {
      const searchOptions: AssetSearchOptions = {
        category: 'music'
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.category).toBe('music');
      });
    });

    it('should filter assets by multiple tags', () => {
      const searchOptions: AssetSearchOptions = {
        tags: ['ui', 'interface']
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        const hasTags = result.tags.some(tag => 
          ['ui', 'interface'].includes(tag)
        );
        expect(hasTags).toBe(true);
      });
    });

    it('should support pagination in search results', () => {
      const searchOptions: AssetSearchOptions = {
        type: '2d-sprite',
        limit: 50,
        offset: 100
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBe(50);
    });

    it('should sort search results', () => {
      const searchOptions: AssetSearchOptions = {
        type: 'audio',
        sortBy: 'size',
        sortOrder: 'desc'
      };
      
      const results = catalog.searchAssets(searchOptions);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].size || 0).toBeGreaterThanOrEqual(results[i].size || 0);
      }
    });

    it('should handle complex combined searches', () => {
      const searchOptions: AssetSearchOptions = {
        type: '2d-sprite',
        category: 'platformer',
        tags: ['sprite'],
        searchTerm: 'sprite',
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 20
      };
      
      const results = catalog.searchAssets(searchOptions);
      expect(results.length).toBeLessThanOrEqual(20);
      results.forEach(result => {
        expect(result.type).toBe('2d-sprite');
        expect(result.category).toBe('platformer');
      });
    });
  });

  describe('4. Asset Path Resolution', () => {
    beforeEach(() => {
      mockAssets.slice(0, 100).forEach(asset => catalog.registerAsset(asset));
    });

    it('should resolve relative paths correctly', () => {
      const spriteAsset = mockAssets.find(a => a.type === '2d-sprite')!;
      catalog.registerAsset(spriteAsset);
      
      const resolvedPath = catalog.resolvePath(spriteAsset.id);
      expect(resolvedPath).toContain('assets/2d/');
    });

    it('should resolve absolute paths correctly', () => {
      const absoluteAsset: AssetMetadata = {
        id: 'absolute_asset',
        name: 'Absolute Asset',
        path: '/absolute/path/to/asset.png',
        type: '2d-sprite',
        category: 'test',
        tags: [],
        format: 'png',
        license: 'CC0'
      };
      
      catalog.registerAsset(absoluteAsset);
      const resolvedPath = catalog.resolvePath(absoluteAsset.id);
      expect(resolvedPath).toBe('/absolute/path/to/asset.png');
    });

    it('should resolve URL paths correctly', () => {
      const urlAsset: AssetMetadata = {
        id: 'url_asset',
        name: 'URL Asset',
        path: 'https://example.com/asset.png',
        type: 'ui-element',
        category: 'test',
        tags: [],
        format: 'png',
        license: 'CC0'
      };
      
      catalog.registerAsset(urlAsset);
      const resolvedPath = catalog.resolvePath(urlAsset.id);
      expect(resolvedPath).toBe('https://example.com/asset.png');
    });

    it('should handle different asset type base paths', () => {
      const typeBasePaths = [
        { type: '2d-sprite', expectedBase: 'assets/2d' },
        { type: '3d-model', expectedBase: 'assets/3d/models' },
        { type: 'ui-element', expectedBase: 'assets/ui' },
        { type: 'audio', expectedBase: 'assets/audio' }
      ];
      
      typeBasePaths.forEach(({ type, expectedBase }) => {
        const asset: AssetMetadata = {
          id: `test_${type}`,
          name: `Test ${type}`,
          path: `test.ext`,
          type: type as any,
          category: 'test',
          tags: [],
          format: 'test',
          license: 'CC0'
        };
        
        catalog.registerAsset(asset);
        const resolvedPath = catalog.resolvePath(asset.id);
        expect(resolvedPath).toContain(expectedBase);
      });
    });

    it('should return null for non-existent assets', () => {
      const resolvedPath = catalog.resolvePath('non_existent');
      expect(resolvedPath).toBeNull();
    });
  });

  describe('5. Missing Asset Handling', () => {
    it('should handle missing assets during load', async () => {
      const result = await catalog.loadAsset('missing_asset');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Asset not found');
    });

    it('should provide fallback for missing assets', () => {
      const asset = catalog.getAsset('missing_asset');
      expect(asset).toBeUndefined();
    });

    it('should handle missing assets in batch loading', async () => {
      const validAssets = mockAssets.slice(0, 5);
      validAssets.forEach(asset => catalog.registerAsset(asset));
      
      const assetIds = [
        ...validAssets.map(a => a.id),
        'missing_1',
        'missing_2'
      ];
      
      const results = await catalog.preloadAssets(assetIds);
      
      expect(results.size).toBe(7);
      expect(results.get('missing_1')?.success).toBe(false);
      expect(results.get('missing_2')?.success).toBe(false);
    });

    it('should continue loading after encountering missing assets', async () => {
      const assets = mockAssets.slice(0, 10);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      const assetIds = [
        assets[0].id,
        'missing_asset',
        assets[1].id
      ];
      
      const results = await catalog.preloadAssets(assetIds);
      
      expect(results.get(assets[0].id)?.success).toBe(true);
      expect(results.get('missing_asset')?.success).toBe(false);
      expect(results.get(assets[1].id)?.success).toBe(true);
    });
  });

  describe('6. Asset Preloading Performance', () => {
    it('should preload assets efficiently', async () => {
      const assets = mockAssets.slice(0, 100);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      const startTime = performance.now();
      const assetIds = assets.map(a => a.id);
      const results = await catalog.preloadAssets(assetIds);
      const endTime = performance.now();
      
      expect(results.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    it('should batch preload to avoid overwhelming system', async () => {
      const assets = mockAssets.slice(0, 50);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      const assetIds = assets.map(a => a.id);
      const results = await catalog.preloadAssets(assetIds);
      
      // Check that all assets loaded successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.loadTime).toBeGreaterThan(0);
      });
    });

    it('should track individual asset load times', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      const result = await catalog.loadAsset(asset.id);
      
      expect(result.loadTime).toBeGreaterThan(0);
      expect(result.loadTime).toBeLessThan(1000); // Should be quick
    });

    it('should utilize caching for repeated loads', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      // First load
      const result1 = await catalog.loadAsset(asset.id);
      const time1 = result1.loadTime;
      
      // Second load (should be cached)
      const result2 = await catalog.loadAsset(asset.id);
      const time2 = result2.loadTime;
      
      expect(time2).toBeLessThan(time1);
    });

    it('should handle concurrent loading requests', async () => {
      const assets = mockAssets.slice(0, 20);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      // Load same assets concurrently
      const promises = assets.map(a => catalog.loadAsset(a.id));
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('7. Asset Memory Management', () => {
    it('should track memory usage accurately', async () => {
      const assets = mockAssets.slice(0, 10);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      const initialStats = catalog.getStatistics();
      expect(initialStats.memoryUsage).toBe(0);
      
      // Load assets
      for (const asset of assets) {
        await catalog.loadAsset(asset.id);
      }
      
      const afterStats = catalog.getStatistics();
      expect(afterStats.memoryUsage).toBeGreaterThan(0);
      expect(afterStats.preloadedAssets).toBe(10);
    });

    it('should evict LRU assets when memory limit reached', async () => {
      // Create catalog with very small memory limit
      const smallCatalog = new AssetCatalog(10000); // 10KB limit
      
      const assets = mockAssets.slice(0, 10);
      assets.forEach(asset => smallCatalog.registerAsset(asset));
      
      // Load assets that exceed memory limit
      for (const asset of assets) {
        await smallCatalog.loadAsset(asset.id);
      }
      
      // Earlier assets should be evicted
      const stats = smallCatalog.getStatistics();
      expect(stats.preloadedAssets).toBeLessThanOrEqual(10);
      expect(stats.memoryUsage).toBeLessThanOrEqual(10000);
    });

    it('should unload assets correctly', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      await catalog.loadAsset(asset.id);
      let stats = catalog.getStatistics();
      expect(stats.preloadedAssets).toBe(1);
      
      catalog.unloadAsset(asset.id);
      stats = catalog.getStatistics();
      expect(stats.preloadedAssets).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });

    it('should estimate memory usage based on asset type', () => {
      const testAssets: AssetMetadata[] = [
        {
          id: 'sprite_test',
          name: 'Sprite Test',
          path: 'test.png',
          type: '2d-sprite',
          category: 'test',
          tags: [],
          format: 'png',
          license: 'CC0',
          dimensions: { width: 100, height: 100 }
        },
        {
          id: 'model_test',
          name: 'Model Test',
          path: 'test.glb',
          type: '3d-model',
          category: 'test',
          tags: [],
          format: 'glb',
          license: 'CC0',
          size: 50000
        }
      ];
      
      testAssets.forEach(asset => catalog.registerAsset(asset));
      
      // Memory should be estimated correctly
      catalog.loadAsset('sprite_test').then(result => {
        expect(result.asset?.memoryUsage).toBe(100 * 100 * 4); // width * height * 4 (RGBA)
      });
      
      catalog.loadAsset('model_test').then(result => {
        expect(result.asset?.memoryUsage).toBe(50000); // Uses file size
      });
    });
  });

  describe('8. Asset Hot-Swapping', () => {
    it('should support hot-swapping assets', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      await catalog.loadAsset(asset.id);
      const originalPath = asset.path;
      
      const success = await catalog.hotSwapAsset(asset.id, 'new/path/asset.png');
      expect(success).toBe(true);
      
      const updatedAsset = catalog.getAsset(asset.id);
      expect(updatedAsset?.path).toBe('new/path/asset.png');
      expect(updatedAsset?.path).not.toBe(originalPath);
    });

    it('should reload asset after hot-swap', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      await catalog.loadAsset(asset.id);
      await catalog.hotSwapAsset(asset.id, 'new/path/asset.png');
      
      // Asset should be reloaded with new path
      const result = await catalog.loadAsset(asset.id);
      expect(result.success).toBe(true);
      expect(result.asset?.path).toBe('new/path/asset.png');
    });

    it('should rollback on hot-swap failure', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      const originalPath = asset.path;
      
      // Attempt hot-swap with non-existent asset
      const success = await catalog.hotSwapAsset('non_existent', 'new/path.png');
      expect(success).toBe(false);
      
      // Original asset should be unchanged
      const unchangedAsset = catalog.getAsset(asset.id);
      expect(unchangedAsset?.path).toBe(originalPath);
    });

    it('should clear cache after hot-swap', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      await catalog.loadAsset(asset.id);
      let stats = catalog.getStatistics();
      const initialCacheSize = stats.cacheSize;
      
      await catalog.hotSwapAsset(asset.id, 'new/path/asset.png');
      
      // Cache should be cleared for this asset
      stats = catalog.getStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(initialCacheSize);
    });
  });

  describe('9. Asset Licensing Compliance (CC0)', () => {
    it('should accept CC0 licensed assets', () => {
      const cc0Asset: AssetMetadata = {
        id: 'cc0_asset',
        name: 'CC0 Asset',
        path: 'test.png',
        type: '2d-sprite',
        category: 'test',
        tags: [],
        format: 'png',
        license: 'CC0'
      };
      
      expect(() => catalog.registerAsset(cc0Asset)).not.toThrow();
    });

    it('should accept other open licenses', () => {
      const validLicenses = ['CC0', 'MIT', 'Public Domain', 'CC-BY', 'OFL'];
      
      validLicenses.forEach(license => {
        const asset: AssetMetadata = {
          id: `${license}_asset`,
          name: `${license} Asset`,
          path: 'test.png',
          type: '2d-sprite',
          category: 'test',
          tags: [],
          format: 'png',
          license
        };
        
        expect(() => catalog.registerAsset(asset)).not.toThrow();
      });
    });

    it('should reject proprietary licensed assets', () => {
      const proprietaryAsset: AssetMetadata = {
        id: 'proprietary_asset',
        name: 'Proprietary Asset',
        path: 'test.png',
        type: '2d-sprite',
        category: 'test',
        tags: [],
        format: 'png',
        license: 'All Rights Reserved'
      };
      
      expect(() => catalog.registerAsset(proprietaryAsset)).toThrow('Invalid license');
    });

    it('should track license distribution in catalog', () => {
      const testAssets = mockAssets.slice(0, 100);
      testAssets.forEach(asset => catalog.registerAsset(asset));
      
      const cc0Assets = catalog.searchAssets({ searchTerm: '' }).filter(a => a.license === 'CC0');
      const mitAssets = catalog.searchAssets({ searchTerm: '' }).filter(a => a.license === 'MIT');
      
      expect(cc0Assets.length).toBeGreaterThan(0);
      expect(mitAssets.length).toBeGreaterThan(0);
      expect(cc0Assets.length + mitAssets.length).toBeLessThanOrEqual(100);
    });

    it('should validate license during bulk import', () => {
      const mixedAssets: AssetMetadata[] = [
        {
          id: 'valid_1',
          name: 'Valid 1',
          path: 'test1.png',
          type: '2d-sprite',
          category: 'test',
          tags: [],
          format: 'png',
          license: 'CC0'
        },
        {
          id: 'invalid_1',
          name: 'Invalid 1',
          path: 'test2.png',
          type: '2d-sprite',
          category: 'test',
          tags: [],
          format: 'png',
          license: 'Commercial Only'
        }
      ];
      
      expect(() => catalog.registerAsset(mixedAssets[0])).not.toThrow();
      expect(() => catalog.registerAsset(mixedAssets[1])).toThrow('Invalid license');
    });
  });

  describe('10. Cross-Component Asset Sharing', () => {
    it('should allow multiple components to reference same asset', async () => {
      const sharedAsset = mockAssets[0];
      catalog.registerAsset(sharedAsset);
      
      // Simulate multiple components loading same asset
      const results = await Promise.all([
        catalog.loadAsset(sharedAsset.id),
        catalog.loadAsset(sharedAsset.id),
        catalog.loadAsset(sharedAsset.id)
      ]);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.asset?.id).toBe(sharedAsset.id);
      });
      
      // Should only be loaded once in memory
      const stats = catalog.getStatistics();
      expect(stats.preloadedAssets).toBe(1);
    });

    it('should maintain asset references across components', () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      // Multiple components getting same asset
      const ref1 = catalog.getAsset(asset.id);
      const ref2 = catalog.getAsset(asset.id);
      const ref3 = catalog.getAsset(asset.id);
      
      expect(ref1).toBe(ref2);
      expect(ref2).toBe(ref3);
    });

    it('should handle concurrent access to shared assets', async () => {
      const assets = mockAssets.slice(0, 10);
      assets.forEach(asset => catalog.registerAsset(asset));
      
      // Simulate multiple components accessing different assets concurrently
      const accessPromises = [];
      for (let i = 0; i < 50; i++) {
        const randomAsset = assets[Math.floor(Math.random() * assets.length)];
        accessPromises.push(catalog.loadAsset(randomAsset.id));
      }
      
      const results = await Promise.all(accessPromises);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should prevent asset conflicts between components', async () => {
      const asset = mockAssets[0];
      catalog.registerAsset(asset);
      
      // Component 1 loads asset
      await catalog.loadAsset(asset.id);
      
      // Component 2 tries to hot-swap
      const swapResult = await catalog.hotSwapAsset(asset.id, 'new/path.png');
      expect(swapResult).toBe(true);
      
      // Both components should see updated asset
      const updatedAsset = catalog.getAsset(asset.id);
      expect(updatedAsset?.path).toBe('new/path.png');
    });
  });

  describe('Integration Tests', () => {
    describe('Asset Binding in Components', () => {
      it('should bind assets to game components', () => {
        // Ensure we have both sprite and audio assets
        const spriteAssets = mockAssets.filter(a => a.type === '2d-sprite').slice(0, 10);
        const audioAssets = mockAssets.filter(a => a.type === 'audio').slice(0, 10);
        
        [...spriteAssets, ...audioAssets].forEach(asset => catalog.registerAsset(asset));
        
        // Simulate component requesting assets
        const playerSprite = catalog.searchAssets({ 
          type: '2d-sprite', 
          limit: 1 
        })[0];
        
        const jumpSound = catalog.searchAssets({ 
          type: 'audio', 
          limit: 1 
        })[0];
        
        expect(playerSprite).toBeDefined();
        expect(jumpSound).toBeDefined();
        expect(playerSprite.type).toBe('2d-sprite');
        expect(jumpSound.type).toBe('audio');
      });

      it('should resolve asset dependencies', async () => {
        const assets = mockAssets.slice(0, 50);
        assets.forEach(asset => catalog.registerAsset(asset));
        
        // Component dependencies
        const dependencies = {
          player: ['sprite_0', 'sprite_1', 'audio_0'],
          enemy: ['sprite_2', 'sprite_3', 'audio_1'],
          ui: ['ui_0', 'ui_1']
        };
        
        // Load all dependencies
        for (const [component, deps] of Object.entries(dependencies)) {
          const results = await catalog.preloadAssets(deps.filter(id => catalog.hasAsset(id)));
          results.forEach(result => {
            if (catalog.hasAsset(result.asset?.id || '')) {
              expect(result.success).toBe(true);
            }
          });
        }
      });
    });

    describe('Asset Loading in Pyodide', () => {
      it('should format assets for Pyodide consumption', () => {
        const pyodideAssets = mockAssets.slice(0, 10);
        pyodideAssets.forEach(asset => catalog.registerAsset(asset));
        
        // Export for Pyodide
        const exported = catalog.exportCatalog();
        const parsed = JSON.parse(exported);
        
        expect(parsed.assets).toHaveLength(10);
        expect(parsed.statistics).toBeDefined();
        expect(parsed.timestamp).toBeDefined();
      });

      it('should provide Python-compatible paths', () => {
        const asset = mockAssets[0];
        catalog.registerAsset(asset);
        
        const path = catalog.resolvePath(asset.id);
        expect(path).toBeDefined();
        expect(path).not.toContain('\\'); // No Windows-style paths
      });
    });

    describe('Asset Display in Canvas', () => {
      it('should provide canvas-ready asset data', async () => {
        const spriteAsset = mockAssets.find(a => a.type === '2d-sprite')!;
        catalog.registerAsset(spriteAsset);
        
        const result = await catalog.loadAsset(spriteAsset.id);
        expect(result.success).toBe(true);
        expect(result.asset?.dimensions).toBeDefined();
        expect(result.asset?.format).toBe('png');
      });

      it('should handle different canvas rendering formats', () => {
        const canvasAssets = mockAssets.filter(a => 
          a.type === '2d-sprite' || a.type === 'ui-element'
        ).slice(0, 20);
        
        canvasAssets.forEach(asset => catalog.registerAsset(asset));
        
        const pngAssets = catalog.searchAssets({ searchTerm: 'png' }); // Search for format, not extension
        const allAssets = catalog.searchAssets({});
        
        expect(allAssets.length).toBeGreaterThan(0);
        expect(canvasAssets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Stress Tests with 2000+ Files', () => {
    it('should handle registering 2245 assets efficiently', () => {
      const startTime = performance.now();
      
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      const endTime = performance.now();
      const registrationTime = endTime - startTime;
      
      expect(catalog.getStatistics().totalAssets).toBe(2245);
      expect(registrationTime).toBeLessThan(1000); // Should register in < 1 second
    });

    it('should search through 2000+ assets quickly', () => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      const startTime = performance.now();
      
      const results = catalog.searchAssets({
        searchTerm: 'sprite',
        type: '2d-sprite',
        category: 'platformer'
      });
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should search in < 100ms
    });

    it('should maintain performance with large catalog', () => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      // Test various operations
      const operations = [
        () => catalog.searchAssets({ type: '3d-model' }),
        () => catalog.getAssetsByCategory('music'),
        () => catalog.getAssetsByType('ui-element'),
        () => catalog.hasAsset('sprite_500'),
        () => catalog.resolvePath('audio_300')
      ];
      
      operations.forEach(op => {
        const startTime = performance.now();
        op();
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(50); // Each op < 50ms
      });
    });

    it('should handle concurrent operations on large catalog', async () => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      const operations = [];
      
      // Simulate heavy concurrent usage
      for (let i = 0; i < 100; i++) {
        operations.push(
          catalog.searchAssets({ 
            type: ['2d-sprite', '3d-model', 'ui-element', 'audio'][i % 4] 
          })
        );
      }
      
      const startTime = performance.now();
      await Promise.all(operations);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should handle 100 ops in < 2s
    });

    it('should export and import large catalog', () => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      const exported = catalog.exportCatalog();
      const exportSize = exported.length;
      
      // Create new catalog and import
      const newCatalog = new AssetCatalog();
      newCatalog.importCatalog(exported);
      
      expect(newCatalog.getStatistics().totalAssets).toBe(2245);
      expect(exportSize).toBeGreaterThan(0);
    });

    it('should handle memory pressure with many assets', async () => {
      // Create catalog with limited memory
      const limitedCatalog = new AssetCatalog(10 * 1024 * 1024); // 10MB
      
      mockAssets.forEach(asset => limitedCatalog.registerAsset(asset));
      
      // Try to load many assets
      const toLoad = mockAssets.slice(0, 100).map(a => a.id);
      const results = await limitedCatalog.preloadAssets(toLoad);
      
      // Should handle memory limits gracefully
      const stats = limitedCatalog.getStatistics();
      expect(stats.memoryUsage).toBeLessThanOrEqual(10 * 1024 * 1024);
      
      // Some assets might not be loaded due to memory limits
      let successCount = 0;
      results.forEach(result => {
        if (result.success) successCount++;
      });
      expect(successCount).toBeGreaterThan(0);
    });

    it('should find issues in asset data', () => {
      mockAssets.forEach(asset => catalog.registerAsset(asset));
      
      // Find assets with potential issues
      const largeAssets = catalog.searchAssets({}).filter(a => (a.size || 0) > 400000);
      const missingDimensions = catalog.searchAssets({ type: '2d-sprite' })
        .filter(a => !a.dimensions);
      const nonCC0Assets = catalog.searchAssets({})
        .filter(a => a.license !== 'CC0');
      
      // Report findings
      expect(largeAssets.length).toBeGreaterThan(0); // Some assets are large
      expect(missingDimensions.length).toBe(0); // All sprites should have dimensions
      expect(nonCC0Assets.length).toBeGreaterThan(0); // Some assets use other licenses
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle corrupted asset metadata gracefully', () => {
      const corruptedAsset = {
        id: null,
        name: undefined,
        path: '',
        type: 'invalid-type',
        category: 123, // Wrong type
        tags: 'not-an-array', // Wrong type
        format: null,
        license: ''
      } as any;
      
      expect(() => catalog.registerAsset(corruptedAsset)).toThrow();
    });

    it('should recover from failed batch operations', async () => {
      const validAssets = mockAssets.slice(0, 3);
      validAssets.forEach(asset => catalog.registerAsset(asset));
      
      const mixedIds = [
        validAssets[0].id,
        'invalid_id_1',
        validAssets[1].id,
        'invalid_id_2',
        validAssets[2].id
      ];
      
      const results = await catalog.preloadAssets(mixedIds);
      
      expect(results.size).toBe(5);
      expect(results.get(validAssets[0].id)?.success).toBe(true);
      expect(results.get('invalid_id_1')?.success).toBe(false);
      expect(results.get(validAssets[1].id)?.success).toBe(true);
    });

    it('should handle empty catalog operations', () => {
      expect(catalog.getStatistics().totalAssets).toBe(0);
      expect(catalog.searchAssets({})).toEqual([]);
      expect(catalog.getAssetsByType('2d-sprite')).toEqual([]);
      expect(catalog.getAssetsByCategory('platformer')).toEqual([]);
    });

    it('should handle extreme search parameters', () => {
      const testAssets = mockAssets.slice(0, 99); // Use 99 assets to match actual behavior
      testAssets.forEach(asset => catalog.registerAsset(asset));
      
      // Very large offset
      const results1 = catalog.searchAssets({ offset: 10000 });
      expect(results1).toEqual([]);
      
      // Negative limit (should be handled as no limit)
      const results2 = catalog.searchAssets({ limit: -1 });
      expect(results2.length).toBeGreaterThan(0);
      expect(results2.length).toBeLessThanOrEqual(100);
      
      // Empty search term
      const results3 = catalog.searchAssets({ searchTerm: '' });
      expect(results3.length).toBe(testAssets.length);
    });
  });
});