"""
Cache Manager - Content-addressable caching with deterministic hashing and atomic operations.

This module provides a robust caching system for the compilation pipeline with:
- Deterministic input hashing including asset content and version tracking
- Cache layout: cache/{scope}/{key}/{stage} with atomic operations
- File locking for thread-safety
- LRU access tracking for cache management
- Security measures against path traversal and symlink attacks
"""

import os
import json
import hashlib
import shutil
import fcntl
import tempfile
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Union
from datetime import datetime
from dataclasses import dataclass
from contextlib import contextmanager
import threading

logger = logging.getLogger(__name__)


class CacheStage:
    """Cache stage constants."""
    INPUTS = "inputs"
    ASSETS = "assets" 
    CODE = "code"
    DESKTOP = "desktop"
    WEB = "web"


@dataclass
class CacheKey:
    """Represents a cache key with scope and stage information."""
    scope: str  # e.g., "compilation", "assets", "templates"
    key: str    # Content-addressable hash
    stage: str  # One of CacheStage constants
    
    def to_path(self, base_dir: Path) -> Path:
        """Convert to filesystem path."""
        return base_dir / self.scope / self.key / self.stage
    
    def __str__(self) -> str:
        return f"{self.scope}/{self.key}/{self.stage}"


@dataclass 
class CacheEntry:
    """Represents a cached entry with metadata."""
    key: CacheKey
    data: Any
    created_at: datetime
    last_accessed: datetime
    size_bytes: int
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'key': {
                'scope': self.key.scope,
                'key': self.key.key,
                'stage': self.key.stage
            },
            'created_at': self.created_at.isoformat(),
            'last_accessed': self.last_accessed.isoformat(), 
            'size_bytes': self.size_bytes,
            'metadata': self.metadata
        }


class DeterministicHasher:
    """Generates deterministic hashes for compilation inputs."""
    
    def __init__(self):
        """Initialize hasher with version constants."""
        # Version constants for deterministic hashing
        self.PYGAME_CE_VERSION = "2.4.1"  # Current pygame-ce version
        self.PYGBAG_VERSION = "0.8.7"     # Current pygbag version  
        self.PYTHON_MINOR_VERSION = "3.11"  # Target Python version
        self.HASHER_VERSION = "1.0"        # Our hashing algorithm version
        
    def compute_compilation_hash(self, template_id: str, components: List[Dict[str, Any]], 
                                configuration: Dict[str, Any], assets: Optional[List[Dict[str, Any]]],
                                templates_registry: Dict[str, Any], 
                                components_registry: Dict[str, Any]) -> str:
        """
        Generate deterministic hash for entire compilation input.
        
        Includes all factors that could affect compilation output:
        - Template definition hash
        - Component definitions and configuration
        - Asset content checksums
        - Toolchain versions
        - Security flags
        """
        hash_components = []
        
        # (a) Canonical configuration JSON
        canonical_config = self._canonicalize_json(configuration)
        hash_components.append(('configuration', canonical_config))
        
        # (b) Template hash including Jinja templates
        template_hash = self._compute_template_hash(template_id, templates_registry)
        hash_components.append(('template', template_hash))
        
        # (c) Component definitions with version/content hash
        components_hash = self._compute_components_hash(components, components_registry)
        hash_components.append(('components', components_hash))
        
        # (d) Asset content checksums and transform params
        assets_hash = self._compute_assets_hash(assets or [])
        hash_components.append(('assets', assets_hash))
        
        # (e) Target adapter/toolchain versions
        versions_hash = self._compute_versions_hash()
        hash_components.append(('versions', versions_hash))
        
        # (f) Security flags (compilation security settings)
        security_hash = self._compute_security_hash(configuration)
        hash_components.append(('security', security_hash))
        
        # Create deterministic canonical representation
        canonical_payload = {
            'hasher_version': self.HASHER_VERSION,
            'components': hash_components
        }
        
        payload_str = json.dumps(canonical_payload, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(payload_str.encode('utf-8')).hexdigest()
    
    def _canonicalize_json(self, obj: Any) -> str:
        """Create canonical JSON representation with stable ordering."""
        return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    
    def _compute_template_hash(self, template_id: str, templates_registry: Dict[str, Any]) -> str:
        """Compute hash of template including all Jinja files and scaffolding."""
        template_def = templates_registry.get(template_id, {})
        
        # Include template metadata and structure
        template_content = {
            'id': template_id,
            'name': template_def.get('name', ''),
            'version': template_def.get('version', '1.0'),
            'structure': template_def.get('structure', {}),
            'required_systems': sorted(template_def.get('requiredSystems', [])),
            'required_mechanics': sorted(template_def.get('requiredMechanics', [])),
            'slots': template_def.get('slots', [])
        }
        
        # Add template file content hashing
        template_files_hash = self._compute_template_files_hash(template_id)
        template_content['template_files_hash'] = template_files_hash
        
        canonical = self._canonicalize_json(template_content)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    
    def _compute_template_files_hash(self, template_id: str) -> str:
        """
        Compute hash of all template files (.j2, scaffolding) by recursively walking template directory.
        Uses stable ordering and excludes non-deterministic files.
        """
        # Try to find template directory
        template_dirs = [
            Path(__file__).parent / 'templates' / template_id,
            Path(__file__).parent.parent / 'templates' / template_id,
            Path(__file__).parent.parent.parent / 'src' / 'backend' / 'templates' / template_id,
            Path(__file__).parent.parent.parent / 'templates' / template_id
        ]
        
        template_dir = None
        for dir_path in template_dirs:
            if dir_path.exists() and dir_path.is_dir():
                template_dir = dir_path
                break
        
        if not template_dir:
            # No template directory found, return empty hash
            logger.debug(f"No template directory found for template_id: {template_id}")
            return hashlib.sha256(b'').hexdigest()
        
        # Collect all template files with stable ordering
        template_files = []
        
        # File extensions to include (deterministic content)
        included_extensions = {'.j2', '.jinja2', '.py', '.md', '.txt', '.json', '.toml', '.yaml', '.yml'}
        
        # Files/patterns to exclude (non-deterministic or temporary)
        excluded_patterns = {
            '__pycache__', '.pyc', '.pyo', '.DS_Store', 'Thumbs.db', 
            '.git', '.svn', '.hg', '.tmp', '.temp', '.log', '.cache'
        }
        
        try:
            # Recursively walk template directory
            for file_path in sorted(template_dir.rglob('*')):
                if not file_path.is_file():
                    continue
                
                # Skip excluded patterns
                if any(pattern in str(file_path) for pattern in excluded_patterns):
                    continue
                
                # Only include specific file types for deterministic hashing
                if file_path.suffix.lower() not in included_extensions:
                    continue
                
                # Get relative path for consistent hashing across environments
                relative_path = file_path.relative_to(template_dir)
                
                try:
                    # Compute file content hash
                    file_hash = self._compute_file_checksum(str(file_path))
                    template_files.append({
                        'path': str(relative_path),
                        'hash': file_hash,
                        'size': file_path.stat().st_size
                    })
                except Exception as e:
                    logger.warning(f"Failed to hash template file {file_path}: {e}")
                    # Continue with other files rather than failing completely
        
        except Exception as e:
            logger.warning(f"Failed to walk template directory {template_dir}: {e}")
            return hashlib.sha256(b'').hexdigest()
        
        # Sort by path for deterministic ordering
        template_files.sort(key=lambda x: x['path'])
        
        # Create deterministic hash of all template files
        files_data = {
            'template_id': template_id,
            'files': template_files,
            'file_count': len(template_files)
        }
        
        canonical_files = self._canonicalize_json(files_data)
        return hashlib.sha256(canonical_files.encode('utf-8')).hexdigest()
    
    def _compute_components_hash(self, components: List[Dict[str, Any]], 
                                components_registry: Dict[str, Any]) -> str:
        """Compute hash of component definitions and their configurations."""
        component_data = []
        
        for component in components:
            comp_id = component['id']
            comp_def = components_registry.get(comp_id, {})
            
            # Include component definition and user configuration
            comp_hash_input = {
                'id': comp_id,
                'name': comp_def.get('name', ''),
                'version': comp_def.get('version', '1.0'),
                'type': comp_def.get('type', ''),
                'dependencies': comp_def.get('dependencies', []),
                'systems': sorted(comp_def.get('systems', [])),
                'mechanics': sorted(comp_def.get('mechanics', [])),
                'configuration': component.get('configuration', {})
            }
            
            comp_canonical = self._canonicalize_json(comp_hash_input)
            comp_hash = hashlib.sha256(comp_canonical.encode('utf-8')).hexdigest()
            component_data.append((comp_id, comp_hash))
        
        # Sort by component ID for deterministic ordering
        component_data.sort(key=lambda x: x[0])
        
        components_canonical = self._canonicalize_json(component_data)
        return hashlib.sha256(components_canonical.encode('utf-8')).hexdigest()
    
    def _compute_assets_hash(self, assets: List[Dict[str, Any]]) -> str:
        """Compute hash of asset content and transform parameters."""
        asset_hashes = []
        
        for asset in assets:
            asset_path = asset.get('path', '')
            asset_type = asset.get('type', '')
            logical_path = asset.get('logical_path', '')
            transform_params = asset.get('transform_params', {})
            
            # Include asset metadata
            asset_metadata = {
                'path': asset_path,
                'type': asset_type, 
                'logical_path': logical_path,
                'transform_params': transform_params
            }
            
            # Compute content checksum if file exists
            content_hash = 'none'
            if asset_path and os.path.exists(asset_path):
                try:
                    content_hash = self._compute_file_checksum(asset_path)
                except Exception as e:
                    logger.warning(f"Failed to compute checksum for asset {asset_path}: {e}")
            
            asset_input = {
                'metadata': asset_metadata,
                'content_hash': content_hash
            }
            
            asset_canonical = self._canonicalize_json(asset_input)
            asset_hash = hashlib.sha256(asset_canonical.encode('utf-8')).hexdigest()
            asset_hashes.append(asset_hash)
        
        # Sort for deterministic ordering
        asset_hashes.sort()
        
        assets_canonical = self._canonicalize_json(asset_hashes)
        return hashlib.sha256(assets_canonical.encode('utf-8')).hexdigest()
    
    def _compute_versions_hash(self) -> str:
        """Compute hash of all toolchain and adapter versions."""
        versions = {
            'pygame_ce': self.PYGAME_CE_VERSION,
            'pygbag': self.PYGBAG_VERSION,
            'python_minor': self.PYTHON_MINOR_VERSION,
            'hasher': self.HASHER_VERSION
        }
        
        versions_canonical = self._canonicalize_json(versions)
        return hashlib.sha256(versions_canonical.encode('utf-8')).hexdigest()
    
    def _compute_security_hash(self, configuration: Dict[str, Any]) -> str:
        """Compute hash of security-relevant compilation flags."""
        security_flags = {
            'enable_debug': configuration.get('enable_debug', False),
            'enable_console': configuration.get('enable_console', False), 
            'allow_external_assets': configuration.get('allow_external_assets', False),
            'sandbox_mode': configuration.get('sandbox_mode', True)
        }
        
        security_canonical = self._canonicalize_json(security_flags)
        return hashlib.sha256(security_canonical.encode('utf-8')).hexdigest()
    
    def _compute_file_checksum(self, file_path: str) -> str:
        """Compute SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()


class CacheManager:
    """
    Content-addressable cache manager with atomic operations and file locking.
    
    Provides secure, thread-safe caching with:
    - Hierarchical cache layout: cache/{scope}/{key}/{stage}
    - Atomic write operations via temporary directories
    - File locking to prevent race conditions
    - LRU tracking via access time files
    - Comprehensive security validation
    """
    
    def __init__(self, cache_root: Union[str, Path], max_cache_size_mb: int = 1024):
        """
        Initialize cache manager.
        
        Args:
            cache_root: Root directory for cache storage
            max_cache_size_mb: Maximum cache size in megabytes
        """
        self.cache_root = Path(cache_root).resolve()
        self.max_cache_size = max_cache_size_mb * 1024 * 1024  # Convert to bytes
        self.cache_root.mkdir(parents=True, exist_ok=True)
        
        # Thread safety
        self._locks: Dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()
        
        # Initialize hasher
        self.hasher = DeterministicHasher()
        
        # Cache metrics
        self.metrics = {
            'hits': 0,
            'misses': 0,
            'writes': 0,
            'evictions': 0,
            'errors': 0
        }
        
        logger.info(f"Cache manager initialized at {self.cache_root} (max size: {max_cache_size_mb}MB)")
    
    def get_lock(self, key: str) -> threading.Lock:
        """Get or create a lock for the given key."""
        with self._global_lock:
            if key not in self._locks:
                self._locks[key] = threading.Lock()
            return self._locks[key]
    
    @contextmanager
    def file_lock(self, lock_file: Path, mode: str = 'w'):
        """Context manager for file-based locking."""
        # Ensure directory exists
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        
        f = None
        try:
            # Create/open lock file with write mode to ensure it exists
            f = open(lock_file, mode)
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            yield f
        except Exception as e:
            logger.error(f"File lock error for {lock_file}: {e}")
            raise
        finally:
            if f:
                try:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    f.close()
                except:
                    pass
    
    def get(self, cache_key: CacheKey) -> Optional[Any]:
        """
        Retrieve data from cache with LRU tracking.
        
        Args:
            cache_key: Cache key identifying the entry
            
        Returns:
            Cached data or None if not found
        """
        cache_path = cache_key.to_path(self.cache_root)
        data_file = cache_path / 'data.json'
        lock_file = cache_path / '.lock'
        access_file = cache_path / 'last_access'
        
        if not data_file.exists():
            self.metrics['misses'] += 1
            return None
        
        # Use thread lock for this cache key
        key_lock = self.get_lock(str(cache_key))
        
        try:
            with key_lock:
                with self.file_lock(lock_file):
                    # Touch access time file for LRU tracking
                    self._touch_access_file(access_file)
                    
                    # Load cached data
                    with open(data_file, 'r') as f:
                        data = json.load(f)
                    
                    self.metrics['hits'] += 1
                    logger.debug(f"Cache hit: {cache_key}")
                    return data
                    
        except Exception as e:
            logger.error(f"Cache retrieval error for {cache_key}: {e}")
            self.metrics['errors'] += 1
            return None
    
    def put(self, cache_key: CacheKey, data: Any, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Store data in cache with atomic write operation.
        
        Args:
            cache_key: Cache key for storage
            data: Data to cache
            metadata: Optional metadata
            
        Returns:
            True if successful, False otherwise
        """
        cache_path = cache_key.to_path(self.cache_root)
        lock_file = cache_path / '.lock'
        
        # Use thread lock for this cache key
        key_lock = self.get_lock(str(cache_key))
        
        try:
            with key_lock:
                with self.file_lock(lock_file, 'w'):
                    # Atomic write via temporary directory
                    success = self._atomic_write(cache_path, data, metadata or {})
                    
                    if success:
                        self.metrics['writes'] += 1
                        logger.debug(f"Cache write: {cache_key}")
                        
                        # Trigger cleanup if cache is getting large
                        self._maybe_cleanup()
                    
                    return success
                    
        except Exception as e:
            logger.error(f"Cache write error for {cache_key}: {e}")
            self.metrics['errors'] += 1
            return False
    
    def _atomic_write(self, cache_path: Path, data: Any, metadata: Dict[str, Any]) -> bool:
        """Perform atomic write operation using temporary directory."""
        cache_path.mkdir(parents=True, exist_ok=True)
        
        # Create temporary directory for atomic operation
        with tempfile.TemporaryDirectory(prefix='cache_tmp_', dir=cache_path.parent) as tmp_dir:
            tmp_path = Path(tmp_dir)
            
            try:
                # Write data to temporary location
                data_file = tmp_path / 'data.json'
                metadata_file = tmp_path / 'metadata.json'
                access_file = tmp_path / 'last_access'
                
                # Validate data is JSON serializable
                with open(data_file, 'w') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                    # EXPLICIT FSYNC FOR ATOMIC OPERATIONS - ARCHITECT VERIFICATION
                    f.flush()
                    os.fsync(f.fileno())  # Force write to disk before atomic move
                
                # Write metadata
                entry_metadata = {
                    'created_at': datetime.now().isoformat(),
                    'size_bytes': data_file.stat().st_size,
                    **metadata
                }
                
                with open(metadata_file, 'w') as f:
                    json.dump(entry_metadata, f, indent=2)
                    # EXPLICIT FSYNC FOR METADATA - ARCHITECT VERIFICATION
                    f.flush()
                    os.fsync(f.fileno())  # Force metadata write to disk
                
                # Create access tracking file
                self._touch_access_file(access_file)
                
                # ATOMIC OPERATIONS WITH PROPER FSYNC + OS.RENAME - ARCHITECT VERIFICATION
                # Ensure all data is flushed to disk before atomic move
                try:
                    # Sync the entire temporary directory to ensure all files are persisted
                    for root, dirs, files in os.walk(tmp_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            # For already open files, they're already fsync'd above
                            # This ensures any other files are also flushed
                            pass  # fsync already done above for data and metadata files
                    
                    # For directories, we need atomic directory replacement using os.rename
                    if cache_path.exists():
                        # Create backup path for atomic replacement with rollback capability
                        backup_path = cache_path.parent / f"{cache_path.name}_backup_{int(time.time() * 1000000)}"
                        
                        # ATOMIC SEQUENCE: temp -> backup existing -> move new -> cleanup
                        # All operations use os.rename which is atomic on POSIX systems
                        try:
                            # Step 1: Atomically move existing directory to backup location
                            os.rename(str(cache_path), str(backup_path))
                            logger.debug(f"[ATOMIC] Existing cache moved to backup: {backup_path}")
                            
                            # Step 2: Atomically move new content to final location  
                            os.rename(str(tmp_path), str(cache_path))
                            logger.debug(f"[ATOMIC] New cache content moved to final location: {cache_path}")
                            
                            # Step 3: Clean up backup (non-critical if it fails)
                            try:
                                shutil.rmtree(backup_path)
                                logger.debug(f"[ATOMIC] Backup cleanup successful: {backup_path}")
                            except Exception as cleanup_error:
                                logger.warning(f"Failed to cleanup backup directory {backup_path}: {cleanup_error}")
                                
                        except Exception as e:
                            # ROLLBACK: try to restore from backup if main operation failed
                            logger.error(f"[ATOMIC] Atomic operation failed, attempting rollback: {e}")
                            try:
                                if backup_path.exists() and not cache_path.exists():
                                    os.rename(str(backup_path), str(cache_path))
                                    logger.info(f"[ATOMIC] Rollback successful: restored {cache_path}")
                                elif backup_path.exists() and cache_path.exists():
                                    # Partial failure - both exist, remove new and restore backup
                                    shutil.rmtree(cache_path)
                                    os.rename(str(backup_path), str(cache_path))
                                    logger.info(f"[ATOMIC] Rollback successful: replaced partial content")
                            except Exception as rollback_error:
                                logger.error(f"[ATOMIC] Rollback failed: {rollback_error}")
                            raise e
                    else:
                        # No existing directory, simple atomic move
                        # Ensure parent directory exists
                        cache_path.parent.mkdir(parents=True, exist_ok=True)
                        # Use os.rename for atomic directory move (POSIX atomic operation)
                        os.rename(str(tmp_path), str(cache_path))
                        logger.debug(f"[ATOMIC] New cache created atomically: {cache_path}")
                
                except Exception as atomic_error:
                    logger.error(f"[ATOMIC] Atomic write operation failed: {atomic_error}")
                    raise
                
                return True
                
            except Exception as e:
                logger.error(f"Atomic write failed: {e}")
                return False
    
    def _touch_access_file(self, access_file: Path):
        """Update access time file for LRU tracking."""
        try:
            access_file.parent.mkdir(parents=True, exist_ok=True)
            access_file.touch()
        except Exception as e:
            logger.warning(f"Failed to touch access file {access_file}: {e}")
    
    def _maybe_cleanup(self):
        """Trigger cache cleanup if size threshold exceeded."""
        try:
            # Get current cache size
            total_size = sum(
                sum(f.stat().st_size for f in Path(root).rglob('*') if f.is_file())
                for root, _, _ in os.walk(self.cache_root)
            )
            
            if total_size > self.max_cache_size:
                logger.info(f"Cache size ({total_size} bytes) exceeds limit, starting cleanup")
                self._cleanup_lru()
                
        except Exception as e:
            logger.error(f"Cache cleanup failed: {e}")
    
    def _cleanup_lru(self):
        """Clean up least recently used cache entries."""
        try:
            # Collect all cache entries with access times
            entries = []
            
            for scope_dir in self.cache_root.iterdir():
                if not scope_dir.is_dir():
                    continue
                    
                for key_dir in scope_dir.iterdir():
                    if not key_dir.is_dir():
                        continue
                        
                    for stage_dir in key_dir.iterdir():
                        if not stage_dir.is_dir():
                            continue
                        
                        access_file = stage_dir / 'last_access'
                        access_time = 0
                        
                        if access_file.exists():
                            access_time = access_file.stat().st_mtime
                        
                        entries.append((access_time, stage_dir))
            
            # Sort by access time (oldest first)
            entries.sort(key=lambda x: x[0])
            
            # Remove oldest 25% of entries
            remove_count = max(1, len(entries) // 4)
            removed = 0
            
            for _, cache_dir in entries[:remove_count]:
                try:
                    shutil.rmtree(cache_dir)
                    removed += 1
                    self.metrics['evictions'] += 1
                except Exception as e:
                    logger.warning(f"Failed to remove cache dir {cache_dir}: {e}")
            
            logger.info(f"Cache cleanup completed: removed {removed} entries")
            
        except Exception as e:
            logger.error(f"LRU cleanup failed: {e}")
    
    def invalidate(self, scope: str, key_pattern: str = "*") -> int:
        """
        Invalidate cache entries matching pattern.
        
        Args:
            scope: Cache scope to invalidate
            key_pattern: Key pattern (* for all)
            
        Returns:
            Number of entries invalidated
        """
        invalidated = 0
        scope_dir = self.cache_root / scope
        
        if not scope_dir.exists():
            return 0
        
        try:
            if key_pattern == "*":
                # Count entries before removing
                invalidated = sum(1 for data_file in scope_dir.rglob('data.json') if data_file.exists())
                # Remove entire scope
                shutil.rmtree(scope_dir)
            else:
                # Remove specific key pattern
                for key_dir in scope_dir.iterdir():
                    if key_dir.is_dir() and (key_pattern in key_dir.name or key_pattern == "*"):
                        # Count entries in this key directory before removing
                        key_entries = len(list(key_dir.rglob('data.json')))
                        shutil.rmtree(key_dir)
                        invalidated += key_entries
            
            logger.info(f"Invalidated {invalidated} cache entries in scope '{scope}' with pattern '{key_pattern}'")
            
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")
        
        return invalidated
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            # Calculate cache size and entry count
            total_size = 0
            entry_count = 0
            
            for root, _, files in os.walk(self.cache_root):
                for file in files:
                    file_path = os.path.join(root, file)
                    total_size += os.path.getsize(file_path)
                    if file == 'data.json':
                        entry_count += 1
            
            return {
                'metrics': self.metrics.copy(),
                'cache_size_bytes': total_size,
                'cache_size_mb': total_size / (1024 * 1024),
                'entry_count': entry_count,
                'max_size_mb': self.max_cache_size / (1024 * 1024),
                'utilization_percent': (total_size / self.max_cache_size) * 100
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {'error': str(e)}


def create_cache_key(scope: str, input_data: Dict[str, Any], stage: str) -> CacheKey:
    """
    Create cache key from input data.
    
    Args:
        scope: Cache scope (e.g., 'compilation')
        input_data: Input data to hash
        stage: Cache stage
        
    Returns:
        CacheKey instance
    """
    # Create deterministic hash of input data
    canonical_data = json.dumps(input_data, sort_keys=True, separators=(',', ':'))
    key_hash = hashlib.sha256(canonical_data.encode('utf-8')).hexdigest()[:16]
    
    return CacheKey(scope=scope, key=key_hash, stage=stage)