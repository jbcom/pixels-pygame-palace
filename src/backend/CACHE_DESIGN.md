# Cache Design Documentation for Task 4c1 and 4c2 Asset Conversion Leverage

## Overview

This document describes the comprehensive caching system implemented for the game compilation pipeline, designed to support both task 4c1 (core compilation caching) and task 4c2 (asset conversion caching leverage).

## Cache Architecture

### Hierarchical Cache Layout
```
cache/
├── compilation/          # Scope: compilation pipeline stages
│   ├── {hash_key}/      # Content-addressable key (deterministic)
│   │   ├── inputs/      # Stage: validation and dependency resolution
│   │   ├── assets/      # Stage: asset packaging and manifest
│   │   ├── code/        # Stage: code generation 
│   │   ├── desktop/     # Stage: desktop build artifacts
│   │   └── web/         # Stage: web build artifacts
│   └── {hash_key}/
├── assets/              # Scope: asset conversion and processing
│   ├── {asset_hash}/    # Per-asset content-addressable cache
│   │   ├── original/    # Stage: original asset metadata
│   │   ├── optimized/   # Stage: optimized versions
│   │   ├── web/         # Stage: web-compatible conversions
│   │   └── thumbnails/  # Stage: generated thumbnails
└── templates/           # Scope: template definitions and Jinja files
    ├── {template_id}/   # Template-specific cache
    │   ├── compiled/    # Stage: compiled Jinja templates
    │   └── metadata/    # Stage: template metadata
```

### Cache Scopes and Keys

#### 1. Compilation Scope (`compilation/`)
**Purpose**: Cache compilation pipeline stages to avoid recomputation
**Keys**: Deterministic hash of compilation inputs (template + components + assets + versions)
**Stages**:
- `inputs`: Validation results, dependency resolution, template metadata
- `assets`: Asset manifest, logical-to-physical mappings, checksums
- `code`: Generated game code files (main.py, components, etc.)
- `desktop`: Desktop build artifacts and metadata
- `web`: Web build artifacts and pygbag configuration

**4c2 Leverage**: Asset conversion results are referenced in the asset manifest, enabling asset-level caching reuse across compilations.

#### 2. Assets Scope (`assets/`)  
**Purpose**: Cache asset processing and conversion results for 4c2 leverage
**Keys**: SHA256 hash of asset content + transformation parameters
**Stages**:
- `original`: Original asset metadata (size, format, checksum)
- `optimized`: Size-optimized versions for different quality levels
- `web`: Web-compatible formats (WebP, optimized PNG, etc.)
- `thumbnails`: Generated preview thumbnails

**4c2 Integration**: When compilation requests asset processing, the system first checks the asset cache using content hash. This enables:
- Cross-compilation asset reuse
- Incremental asset processing
- Format-specific optimization caching

#### 3. Templates Scope (`templates/`)
**Purpose**: Cache template processing and Jinja compilation
**Keys**: Template ID + version hash
**Stages**:
- `compiled`: Compiled Jinja2 templates for faster rendering
- `metadata`: Template structure, requirements, and dependency graph

## Deterministic Key Generation

### Compilation Keys
The compilation cache key is generated using deterministic hashing of:
```python
hash_components = [
    ('configuration', canonical_config_json),
    ('template', template_definition_hash),
    ('components', component_definitions_hash), 
    ('assets', asset_content_checksums_hash),
    ('versions', toolchain_versions_hash),
    ('security', security_flags_hash)
]
```

**Key Features**:
- Content-addressable: Same inputs always generate same key
- Version-aware: Toolchain changes invalidate cache
- Security-conscious: Security flags affect caching
- Asset-aware: Asset content changes invalidate dependent caches

### Asset Keys
Asset cache keys combine content and transformation:
```python
asset_key = sha256(asset_content + transform_params + target_format)
```

## Atomic Operations

### Write Atomicity
All cache writes use atomic operations via temporary directories:
```python
def _atomic_write(self, cache_path, data, metadata):
    with tempfile.TemporaryDirectory() as tmp_dir:
        # 1. Write to temporary location
        # 2. fsync() to ensure data is on disk
        # 3. os.rename() for atomic move (POSIX atomic operation)
        # 4. Rollback on failure
```

**Guarantees**:
- No partial writes visible to readers
- Crash safety during write operations  
- Concurrent access safety via file locking
- Automatic rollback on failure

### Concurrency Safety
- **File locking**: Per-cache-key locks prevent race conditions
- **LRU tracking**: Thread-safe access time updates
- **Atomic reads**: Consistent view during concurrent writes

## Cache Performance and Metrics

### Metrics Exposed
The orchestrator logs comprehensive cache performance metrics:
```
[CACHE METRICS] Compilation {id} cache performance:
  - Stage cache hits: {hits}
  - Stage cache misses: {misses}  
  - Cache hit ratio: {ratio}%
  - Total cache size: {size} MB
  - Cache utilization: {util}%
  - Total cache entries: {count}
```

### Performance Characteristics
- **Stage-level caching**: Each pipeline stage is independently cached
- **Content-addressable**: Eliminates duplicate computations
- **LRU eviction**: Automatic cleanup of old entries
- **Size-bounded**: Configurable maximum cache size

## Task 4c2 Asset Conversion Leverage

### Cross-Compilation Asset Reuse
The asset cache enables efficient asset reuse across different compilations:

1. **Asset Fingerprinting**: Each asset gets a content-based hash
2. **Format Caching**: Converted formats are cached per asset
3. **Manifest Integration**: Asset manifests reference cached conversions
4. **Incremental Processing**: Only modified assets are reprocessed

### Example Asset Cache Flow
```python
# Check asset cache first
asset_key = CacheKey('assets', asset_content_hash, 'web')
cached_conversion = cache_manager.get(asset_key)

if cached_conversion:
    # Reuse cached web-optimized version
    manifest['assets'][logical_path] = cached_conversion
else:
    # Convert and cache result
    web_asset = asset_packager.convert_for_web(original_path)
    cache_manager.put(asset_key, web_asset, metadata)
```

### Benefits for 4c2
- **Reduced Build Times**: Skip asset conversion for unchanged assets
- **Storage Efficiency**: Shared asset conversions across projects  
- **Format Optimization**: Cache multiple format variants per asset
- **Incremental Builds**: Only process modified assets

## Cache Invalidation Strategies

### Compilation Cache Invalidation
```python
# Invalidate all compilation caches
orchestrator.invalidate_compilation_cache()

# Invalidate specific template caches  
orchestrator.invalidate_compilation_cache(template_id="platformer")

# Invalidate component-specific caches
orchestrator.invalidate_compilation_cache(component_ids=["physics", "renderer"])
```

### Asset Cache Invalidation
Asset caches are automatically invalidated when:
- Asset content changes (different content hash)
- Conversion parameters change (different transformation key)
- Target format requirements change

### Template Cache Invalidation
Template caches are invalidated when:
- Template files are modified (Jinja2 templates, scaffolding)
- Template metadata changes (version, requirements)
- Dependencies are updated

## Security Considerations

### Path Traversal Prevention
- All cache paths are resolved and validated
- Symlink attacks are prevented
- Cache scope isolation enforced

### Content Validation
- JSON schema validation on cache reads/writes
- Asset type validation during conversion
- Metadata integrity checks

### Access Control
- File permissions restrict cache access
- Lock files prevent unauthorized modifications
- Atomic operations prevent data corruption

## Configuration

### Cache Size Management
```python
cache_manager = CacheManager(
    cache_root="/path/to/cache",
    max_cache_size_mb=1024  # 1GB limit
)
```

### Cache Cleanup
- **LRU eviction**: Remove least recently used entries
- **Size-based cleanup**: Triggered when cache exceeds limits
- **Manual invalidation**: API for targeted cache clearing

## Monitoring and Debugging

### Cache Hit Rates
Monitor cache effectiveness through hit/miss ratios:
- High hit rates indicate effective caching
- Low hit rates may indicate cache thrashing or frequent changes

### Cache Size Trends  
Track cache growth over time:
- Steady growth indicates good cache retention
- Rapid growth may require size limit adjustments

### Stage-Level Performance
Monitor which pipeline stages benefit most from caching:
- Code generation typically has high hit rates
- Asset processing benefits from cross-compilation reuse
- Template compilation has moderate hit rates

This cache design provides a robust foundation for both immediate compilation performance (4c1) and future asset conversion optimization (4c2).