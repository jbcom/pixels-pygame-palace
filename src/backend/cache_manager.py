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
import statistics
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from contextlib import contextmanager
import threading
from collections import defaultdict, deque

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


@dataclass
class CacheMetrics:
    """Comprehensive cache performance metrics."""
    # Basic operation counters
    hits: int = 0
    misses: int = 0
    writes: int = 0
    evictions: int = 0
    errors: int = 0
    
    # Timing metrics (in seconds)
    read_times: deque = field(default_factory=lambda: deque(maxlen=1000))
    write_times: deque = field(default_factory=lambda: deque(maxlen=1000))
    cleanup_times: deque = field(default_factory=lambda: deque(maxlen=100))
    
    # Size metrics
    total_bytes_written: int = 0
    total_bytes_read: int = 0
    
    # Per-stage statistics
    stage_stats: Dict[str, Dict[str, Any]] = field(default_factory=lambda: defaultdict(lambda: {
        'hits': 0, 'misses': 0, 'writes': 0, 'bytes_written': 0, 'bytes_read': 0,
        'avg_read_time': 0.0, 'avg_write_time': 0.0, 'last_access': None
    }))
    
    # Build time tracking
    build_times: Dict[str, deque] = field(default_factory=lambda: defaultdict(lambda: deque(maxlen=100)))
    
    # Session statistics
    session_start: datetime = field(default_factory=datetime.now)
    last_cleanup: Optional[datetime] = None
    cleanup_frequency: deque = field(default_factory=lambda: deque(maxlen=50))
    
    def add_read_time(self, duration: float, stage: str, size_bytes: int):
        """Record a cache read operation."""
        self.read_times.append(duration)
        self.total_bytes_read += size_bytes
        stage_data = self.stage_stats[stage]
        stage_data['bytes_read'] += size_bytes
        stage_data['last_access'] = datetime.now()
        # Update average read time with exponential moving average
        if stage_data['avg_read_time'] == 0.0:
            stage_data['avg_read_time'] = duration
        else:
            stage_data['avg_read_time'] = 0.9 * stage_data['avg_read_time'] + 0.1 * duration
    
    def add_write_time(self, duration: float, stage: str, size_bytes: int):
        """Record a cache write operation."""
        self.write_times.append(duration)
        self.total_bytes_written += size_bytes
        stage_data = self.stage_stats[stage]
        stage_data['bytes_written'] += size_bytes
        # Update average write time with exponential moving average
        if stage_data['avg_write_time'] == 0.0:
            stage_data['avg_write_time'] = duration
        else:
            stage_data['avg_write_time'] = 0.9 * stage_data['avg_write_time'] + 0.1 * duration
    
    def add_build_time(self, stage: str, duration: float):
        """Record build time for a specific stage."""
        self.build_times[stage].append(duration)
    
    def get_hit_rate(self) -> float:
        """Calculate overall cache hit rate."""
        total_requests = self.hits + self.misses
        return (self.hits / total_requests * 100) if total_requests > 0 else 0.0
    
    def get_stage_hit_rate(self, stage: str) -> float:
        """Calculate hit rate for a specific stage."""
        stage_data = self.stage_stats[stage]
        total = stage_data['hits'] + stage_data['misses']
        return (stage_data['hits'] / total * 100) if total > 0 else 0.0
    
    def get_avg_read_time(self) -> float:
        """Get average read time across all operations."""
        return statistics.mean(self.read_times) if self.read_times else 0.0
    
    def get_avg_write_time(self) -> float:
        """Get average write time across all operations."""
        return statistics.mean(self.write_times) if self.write_times else 0.0
    
    def get_avg_build_time(self, stage: str) -> float:
        """Get average build time for a specific stage."""
        times = self.build_times.get(stage, [])
        return statistics.mean(times) if times else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for serialization."""
        return {
            'basic_metrics': {
                'hits': self.hits,
                'misses': self.misses,
                'writes': self.writes,
                'evictions': self.evictions,
                'errors': self.errors,
                'hit_rate_percent': self.get_hit_rate()
            },
            'performance_metrics': {
                'avg_read_time_ms': self.get_avg_read_time() * 1000,
                'avg_write_time_ms': self.get_avg_write_time() * 1000,
                'total_bytes_read': self.total_bytes_read,
                'total_bytes_written': self.total_bytes_written,
                'read_throughput_mbps': (self.total_bytes_read / (1024*1024)) / max(1, len(self.read_times)) if self.read_times else 0
            },
            'stage_statistics': {
                stage: {
                    **stats,
                    'hit_rate_percent': self.get_stage_hit_rate(stage),
                    'avg_build_time_s': self.get_avg_build_time(stage),
                    'last_access': stats['last_access'].isoformat() if stats['last_access'] else None
                } for stage, stats in self.stage_stats.items()
            },
            'session_info': {
                'session_duration_minutes': (datetime.now() - self.session_start).total_seconds() / 60,
                'last_cleanup': self.last_cleanup.isoformat() if self.last_cleanup else None,
                'cleanup_frequency_per_hour': len(self.cleanup_frequency) * (3600 / max(1, (datetime.now() - self.session_start).total_seconds()))
            }
        }


@dataclass
class EvictionConfig:
    """Configuration for LRU eviction policies."""
    # Size thresholds
    max_cache_size_bytes: int = 1024 * 1024 * 1024  # 1GB default
    cleanup_threshold_percent: float = 90.0  # Start cleanup at 90% full
    target_utilization_percent: float = 75.0  # Clean down to 75% 
    
    # Eviction behavior
    min_eviction_batch_size: int = 5  # Always evict at least this many
    max_eviction_batch_size: int = 100  # Never evict more than this in one pass
    
    # Age-based policies
    max_entry_age_hours: int = 24 * 7  # 1 week default
    min_access_interval_hours: int = 1  # Don't evict recently accessed items
    
    # Cleanup frequency
    cleanup_interval_minutes: int = 15  # How often to check for cleanup
    forced_cleanup_interval_hours: int = 6  # Force cleanup even if under threshold
    
    # Thread safety
    max_concurrent_evictions: int = 1  # Limit concurrent eviction operations


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
        self.cache_root.mkdir(parents=True, exist_ok=True)
        
        # Thread safety
        self._locks: Dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()
        
        # Initialize hasher
        self.hasher = DeterministicHasher()
        
        # Enhanced metrics and eviction configuration
        self.metrics = CacheMetrics()
        self.eviction_config = EvictionConfig(max_cache_size_bytes=max_cache_size_mb * 1024 * 1024)
        
        # Eviction control
        self._eviction_lock = threading.Lock()
        self._last_cleanup_check = datetime.now()
        self._eviction_in_progress = False
        
        # Metrics export
        self.metrics_file = self.cache_root / 'cache_metrics.json'
        self.health_report_file = self.cache_root / 'cache_health.json'
        
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
        Retrieve data from cache with comprehensive metrics tracking.
        
        Args:
            cache_key: Cache key identifying the entry
            
        Returns:
            Cached data or None if not found
        """
        start_time = time.time()
        cache_path = cache_key.to_path(self.cache_root)
        data_file = cache_path / 'data.json'
        lock_file = cache_path / '.lock'
        access_file = cache_path / 'last_access'
        
        if not data_file.exists():
            self.metrics.misses += 1
            self.metrics.stage_stats[cache_key.stage]['misses'] += 1
            return None
        
        # Use thread lock for this cache key
        key_lock = self.get_lock(str(cache_key))
        
        try:
            with key_lock:
                with self.file_lock(lock_file):
                    # Touch access time file for LRU tracking
                    self._touch_access_file(access_file)
                    
                    # Load cached data and measure size
                    with open(data_file, 'r') as f:
                        data = json.load(f)
                    
                    # Calculate metrics
                    file_size = data_file.stat().st_size
                    read_time = time.time() - start_time
                    
                    # Update comprehensive metrics
                    self.metrics.hits += 1
                    self.metrics.stage_stats[cache_key.stage]['hits'] += 1
                    self.metrics.add_read_time(read_time, cache_key.stage, file_size)
                    
                    logger.debug(f"Cache hit: {cache_key} (size: {file_size} bytes, time: {read_time:.3f}s)")
                    return data
                    
        except Exception as e:
            logger.error(f"Cache retrieval error for {cache_key}: {e}")
            self.metrics.errors += 1
            return None
    
    def put(self, cache_key: CacheKey, data: Any, metadata: Optional[Dict[str, Any]] = None, 
           build_time: Optional[float] = None) -> bool:
        """
        Store data in cache with comprehensive metrics tracking.
        
        Args:
            cache_key: Cache key for storage
            data: Data to cache
            metadata: Optional metadata
            build_time: Optional build time for this stage (in seconds)
            
        Returns:
            True if successful, False otherwise
        """
        start_time = time.time()
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
                        # Calculate metrics
                        write_time = time.time() - start_time
                        data_file = cache_path / 'data.json'
                        file_size = data_file.stat().st_size if data_file.exists() else 0
                        
                        # Update comprehensive metrics
                        self.metrics.writes += 1
                        self.metrics.stage_stats[cache_key.stage]['writes'] += 1
                        self.metrics.add_write_time(write_time, cache_key.stage, file_size)
                        
                        # Record build time if provided
                        if build_time is not None:
                            self.metrics.add_build_time(cache_key.stage, build_time)
                        
                        logger.debug(f"Cache write: {cache_key} (size: {file_size} bytes, time: {write_time:.3f}s)")
                        
                        # Trigger intelligent cleanup
                        self._maybe_cleanup_intelligent()
                        
                        # Export metrics periodically
                        self._maybe_export_metrics()
                    
                    return success
                    
        except Exception as e:
            logger.error(f"Cache write error for {cache_key}: {e}")
            self.metrics.errors += 1
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
    
    def _maybe_cleanup_intelligent(self):
        """Intelligent cache cleanup based on multiple criteria."""
        try:
            now = datetime.now()
            time_since_last_check = now - self._last_cleanup_check
            
            # Check if we should perform cleanup
            should_cleanup = False
            cleanup_reason = ""
            
            # Get current cache statistics
            cache_stats = self._get_cache_size_stats()
            total_size = cache_stats['total_size_bytes']
            utilization_percent = (total_size / self.eviction_config.max_cache_size_bytes) * 100
            
            # Size-based cleanup
            if utilization_percent >= self.eviction_config.cleanup_threshold_percent:
                should_cleanup = True
                cleanup_reason = f"Size threshold exceeded: {utilization_percent:.1f}%"
            
            # Time-based cleanup
            elif time_since_last_check.total_seconds() >= (self.eviction_config.forced_cleanup_interval_hours * 3600):
                should_cleanup = True
                cleanup_reason = "Forced cleanup interval reached"
            
            # Regular interval check
            elif time_since_last_check.total_seconds() >= (self.eviction_config.cleanup_interval_minutes * 60):
                self._last_cleanup_check = now
                # Check for aged entries even if under size threshold
                aged_entries = self._find_aged_entries()
                if aged_entries:
                    should_cleanup = True
                    cleanup_reason = f"Found {len(aged_entries)} aged entries"
            
            if should_cleanup:
                logger.info(f"Starting intelligent cache cleanup: {cleanup_reason}")
                self._cleanup_lru_intelligent(utilization_percent)
                self._last_cleanup_check = now
                
        except Exception as e:
            logger.error(f"Intelligent cache cleanup failed: {e}")
    
    def _get_cache_size_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache size statistics."""
        stats = {
            'total_size_bytes': 0,
            'entry_count': 0,
            'stage_sizes': defaultdict(int),
            'scope_sizes': defaultdict(int),
            'oldest_access': None,
            'newest_access': None
        }
        
        oldest_time = None
        newest_time = None
        
        for scope_dir in self.cache_root.iterdir():
            if not scope_dir.is_dir() or scope_dir.name.startswith('.'):
                continue
                
            for key_dir in scope_dir.iterdir():
                if not key_dir.is_dir():
                    continue
                    
                for stage_dir in key_dir.iterdir():
                    if not stage_dir.is_dir():
                        continue
                    
                    # Calculate directory size
                    dir_size = sum(f.stat().st_size for f in stage_dir.rglob('*') if f.is_file())
                    stats['total_size_bytes'] += dir_size
                    stats['stage_sizes'][stage_dir.name] += dir_size
                    stats['scope_sizes'][scope_dir.name] += dir_size
                    
                    # Count entries
                    if (stage_dir / 'data.json').exists():
                        stats['entry_count'] += 1
                    
                    # Track access times
                    access_file = stage_dir / 'last_access'
                    if access_file.exists():
                        access_time = datetime.fromtimestamp(access_file.stat().st_mtime)
                        if oldest_time is None or access_time < oldest_time:
                            oldest_time = access_time
                            stats['oldest_access'] = access_time
                        if newest_time is None or access_time > newest_time:
                            newest_time = access_time
                            stats['newest_access'] = access_time
        
        return stats
    
    def _maybe_cleanup(self):
        """Trigger cache cleanup if size threshold exceeded."""
        try:
            # Get current cache size
            total_size = sum(
                sum(f.stat().st_size for f in Path(root).rglob('*') if f.is_file())
                for root, _, _ in os.walk(self.cache_root)
            )
            
            if total_size > self.eviction_config.max_cache_size_bytes:
                logger.info(f"Cache size ({total_size} bytes) exceeds limit, starting cleanup")
                self._cleanup_lru()
                
        except Exception as e:
            logger.error(f"Cache cleanup failed: {e}")
    
    def _cleanup_lru_intelligent(self, current_utilization: float):
        """Advanced LRU cleanup with intelligent eviction policies."""
        cleanup_start_time = time.time()
        
        # Prevent concurrent evictions
        if not self._eviction_lock.acquire(blocking=False):
            logger.info("Eviction already in progress, skipping")
            return
            
        try:
            self._eviction_in_progress = True
            
            # Collect all cache entries with comprehensive metadata
            entries = self._collect_cache_entries_with_metadata()
            
            if not entries:
                logger.info("No cache entries found for cleanup")
                return
            
            # Determine cleanup strategy based on current state
            target_utilization = self.eviction_config.target_utilization_percent
            current_size = sum(entry['size_bytes'] for entry in entries)
            target_size = int(current_size * (target_utilization / current_utilization))
            bytes_to_remove = current_size - target_size
            
            # Sort entries by eviction priority (oldest and largest first)
            entries_prioritized = self._prioritize_entries_for_eviction(entries)
            
            # Perform eviction
            removed_entries = self._perform_intelligent_eviction(
                entries_prioritized, bytes_to_remove, current_utilization
            )
            
            # Update metrics
            cleanup_time = time.time() - cleanup_start_time
            self.metrics.cleanup_times.append(cleanup_time)
            self.metrics.last_cleanup = datetime.now()
            self.metrics.cleanup_frequency.append(datetime.now())
            
            # Log cleanup results
            removed_size = sum(entry['size_bytes'] for entry in removed_entries)
            logger.info(
                f"Intelligent cache cleanup completed: "
                f"removed {len(removed_entries)} entries "
                f"({removed_size / 1024 / 1024:.1f} MB) "
                f"in {cleanup_time:.2f}s"
            )
            
            # Generate cleanup report
            self._generate_cleanup_report(removed_entries, cleanup_time, current_utilization)
            
        except Exception as e:
            logger.error(f"Intelligent LRU cleanup failed: {e}")
            self.metrics.errors += 1
        finally:
            self._eviction_in_progress = False
            self._eviction_lock.release()
    
    def _collect_cache_entries_with_metadata(self) -> List[Dict[str, Any]]:
        """Collect all cache entries with comprehensive metadata."""
        entries = []
        now = time.time()
        
        for scope_dir in self.cache_root.iterdir():
            if not scope_dir.is_dir() or scope_dir.name.startswith('.'):
                continue
                
            for key_dir in scope_dir.iterdir():
                if not key_dir.is_dir():
                    continue
                    
                for stage_dir in key_dir.iterdir():
                    if not stage_dir.is_dir():
                        continue
                    
                    try:
                        # Calculate entry size
                        size_bytes = sum(f.stat().st_size for f in stage_dir.rglob('*') if f.is_file())
                        
                        # Get access times
                        access_file = stage_dir / 'last_access'
                        access_time = 0
                        age_hours = float('inf')
                        
                        if access_file.exists():
                            access_time = access_file.stat().st_mtime
                            age_hours = (now - access_time) / 3600
                        
                        # Get creation time from metadata
                        metadata_file = stage_dir / 'metadata.json'
                        created_at = None
                        if metadata_file.exists():
                            try:
                                with open(metadata_file, 'r') as f:
                                    metadata = json.load(f)
                                    created_at = datetime.fromisoformat(metadata.get('created_at', ''))
                            except Exception:
                                pass
                        
                        entries.append({
                            'path': stage_dir,
                            'scope': scope_dir.name,
                            'stage': stage_dir.name,
                            'key': key_dir.name,
                            'size_bytes': size_bytes,
                            'access_time': access_time,
                            'age_hours': age_hours,
                            'created_at': created_at,
                            'is_aged': age_hours > self.eviction_config.max_entry_age_hours,
                            'is_recently_accessed': age_hours < self.eviction_config.min_access_interval_hours
                        })
                        
                    except Exception as e:
                        logger.warning(f"Failed to collect metadata for {stage_dir}: {e}")
        
        return entries
    
    def _prioritize_entries_for_eviction(self, entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort entries by eviction priority."""
        def eviction_priority(entry):
            # Priority factors (lower score = higher priority for eviction)
            
            # 1. Age factor (older = higher priority)
            age_factor = entry['age_hours'] / max(1, self.eviction_config.max_entry_age_hours)
            
            # 2. Size factor (larger = higher priority for big cleanups)
            avg_size = 10 * 1024 * 1024  # 10MB baseline
            size_factor = entry['size_bytes'] / avg_size
            
            # 3. Recent access penalty (recently accessed = lower priority)
            recency_penalty = -10 if entry['is_recently_accessed'] else 0
            
            # 4. Stage importance (some stages might be more important)
            stage_importance = {
                'web': 1.0,      # Web builds can be recreated easily
                'desktop': 1.1,   # Desktop builds slightly more valuable
                'assets': 1.3,    # Assets more expensive to regenerate
                'code': 1.5,      # Code analysis more expensive
                'inputs': 2.0     # Input validation most expensive
            }
            importance_factor = 1.0 / stage_importance.get(entry['stage'], 1.0)
            
            # Combined priority score
            return (age_factor * 2.0 + size_factor * 1.0 + importance_factor) + recency_penalty
        
        # Sort by priority (highest priority for eviction first)
        return sorted(entries, key=eviction_priority, reverse=True)
    
    def _perform_intelligent_eviction(self, entries: List[Dict[str, Any]], 
                                    target_bytes: int, current_utilization: float) -> List[Dict[str, Any]]:
        """Perform the actual eviction with intelligent policies."""
        removed_entries = []
        bytes_removed = 0
        
        # Determine batch size based on current pressure
        if current_utilization > 95:
            batch_size = self.eviction_config.max_eviction_batch_size
        elif current_utilization > 90:
            batch_size = min(50, len(entries) // 3)
        else:
            batch_size = self.eviction_config.min_eviction_batch_size
        
        # First pass: Remove aged entries regardless of size
        aged_entries = [e for e in entries if e['is_aged']]
        for entry in aged_entries[:batch_size // 2]:
            if self._remove_cache_entry(entry):
                removed_entries.append(entry)
                bytes_removed += entry['size_bytes']
                self.metrics.evictions += 1
        
        # Second pass: Remove by LRU until target is met
        remaining_entries = [e for e in entries if not e['is_aged'] and not e['is_recently_accessed']]
        for entry in remaining_entries:
            if bytes_removed >= target_bytes or len(removed_entries) >= batch_size:
                break
                
            if self._remove_cache_entry(entry):
                removed_entries.append(entry)
                bytes_removed += entry['size_bytes']
                self.metrics.evictions += 1
        
        return removed_entries
    
    def _remove_cache_entry(self, entry: Dict[str, Any]) -> bool:
        """Safely remove a cache entry."""
        try:
            entry_path = entry['path']
            
            # Use file locking for thread safety
            lock_file = entry_path / '.lock'
            key_lock = self.get_lock(f"{entry['scope']}/{entry['key']}/{entry['stage']}")
            
            with key_lock:
                with self.file_lock(lock_file, 'w'):
                    if entry_path.exists():
                        shutil.rmtree(entry_path)
                        logger.debug(f"Removed cache entry: {entry_path}")
                        return True
            
        except Exception as e:
            logger.warning(f"Failed to remove cache entry {entry.get('path', 'unknown')}: {e}")
        
        return False
    
    def _find_aged_entries(self) -> List[Dict[str, Any]]:
        """Find entries that exceed the maximum age."""
        aged_entries = []
        now = time.time()
        max_age_seconds = self.eviction_config.max_entry_age_hours * 3600
        
        for scope_dir in self.cache_root.iterdir():
            if not scope_dir.is_dir() or scope_dir.name.startswith('.'):
                continue
                
            for key_dir in scope_dir.iterdir():
                if not key_dir.is_dir():
                    continue
                    
                for stage_dir in key_dir.iterdir():
                    if not stage_dir.is_dir():
                        continue
                    
                    access_file = stage_dir / 'last_access'
                    if access_file.exists():
                        age = now - access_file.stat().st_mtime
                        if age > max_age_seconds:
                            aged_entries.append({
                                'path': stage_dir,
                                'age_hours': age / 3600,
                                'scope': scope_dir.name,
                                'stage': stage_dir.name
                            })
        
        return aged_entries
    
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
                    self.metrics.evictions += 1
                except Exception as e:
                    logger.warning(f"Failed to remove cache dir {cache_dir}: {e}")
            
            logger.info(f"Cache cleanup completed: removed {removed} entries")
            
        except Exception as e:
            logger.error(f"LRU cleanup failed: {e}")
    
    def _maybe_export_metrics(self):
        """Export metrics to JSON file periodically."""
        try:
            # Export every 50 operations or every 5 minutes
            total_ops = self.metrics.hits + self.metrics.misses + self.metrics.writes
            
            should_export = (
                total_ops > 0 and total_ops % 50 == 0
            ) or not self.metrics_file.exists()
            
            if should_export:
                comprehensive_stats = self.get_comprehensive_stats()
                comprehensive_stats['export_timestamp'] = datetime.now().isoformat()
                
                with open(self.metrics_file, 'w') as f:
                    json.dump(comprehensive_stats, f, indent=2)
                
                logger.debug(f"Cache metrics exported to {self.metrics_file}")
                
        except Exception as e:
            logger.warning(f"Failed to export metrics: {e}")
    
    def _generate_cleanup_report(self, removed_entries: List[Dict[str, Any]], 
                               cleanup_time: float, utilization_before: float):
        """Generate detailed cleanup report."""
        try:
            # Calculate cleanup statistics
            removed_by_stage = defaultdict(int)
            removed_by_scope = defaultdict(int)
            removed_size_by_stage = defaultdict(int)
            total_removed_size = 0
            
            for entry in removed_entries:
                removed_by_stage[entry['stage']] += 1
                removed_by_scope[entry['scope']] += 1
                removed_size_by_stage[entry['stage']] += entry['size_bytes']
                total_removed_size += entry['size_bytes']
            
            # Get current utilization
            current_stats = self._get_cache_size_stats()
            utilization_after = (current_stats['total_size_bytes'] / self.eviction_config.max_cache_size_bytes) * 100
            
            report = {
                'cleanup_timestamp': datetime.now().isoformat(),
                'cleanup_duration_seconds': cleanup_time,
                'utilization_before_percent': utilization_before,
                'utilization_after_percent': utilization_after,
                'utilization_reduction_percent': utilization_before - utilization_after,
                'entries_removed': len(removed_entries),
                'bytes_removed': total_removed_size,
                'mb_removed': total_removed_size / (1024 * 1024),
                'removal_by_stage': dict(removed_by_stage),
                'removal_by_scope': dict(removed_by_scope),
                'size_removed_by_stage_mb': {stage: size / (1024 * 1024) 
                                           for stage, size in removed_size_by_stage.items()},
                'efficiency_score': (utilization_before - utilization_after) / cleanup_time  # Percent reduction per second
            }
            
            # Save report
            with open(self.health_report_file, 'w') as f:
                json.dump(report, f, indent=2)
            
            logger.info(
                f"Cleanup report generated: {utilization_before:.1f}% → {utilization_after:.1f}% "
                f"({len(removed_entries)} entries, {total_removed_size / 1024 / 1024:.1f} MB)"
            )
            
        except Exception as e:
            logger.warning(f"Failed to generate cleanup report: {e}")
    
    def force_cleanup(self, target_utilization_percent: Optional[float] = None) -> Dict[str, Any]:
        """Force immediate cache cleanup with optional target utilization."""
        original_target = None
        if target_utilization_percent:
            original_target = self.eviction_config.target_utilization_percent
            self.eviction_config.target_utilization_percent = target_utilization_percent
        
        try:
            # Get current state
            cache_stats = self._get_cache_size_stats()
            current_utilization = (cache_stats['total_size_bytes'] / self.eviction_config.max_cache_size_bytes) * 100
            
            logger.info(f"Force cleanup requested (current utilization: {current_utilization:.1f}%)")
            
            # Perform cleanup
            self._cleanup_lru_intelligent(current_utilization)
            
            # Get final state
            final_stats = self._get_cache_size_stats()
            final_utilization = (final_stats['total_size_bytes'] / self.eviction_config.max_cache_size_bytes) * 100
            
            return {
                'success': True,
                'utilization_before': current_utilization,
                'utilization_after': final_utilization,
                'reduction_percent': current_utilization - final_utilization,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Force cleanup failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
        finally:
            if target_utilization_percent and original_target is not None:
                self.eviction_config.target_utilization_percent = original_target
    
    def get_cache_health_report(self) -> Dict[str, Any]:
        """Generate comprehensive cache health report."""
        try:
            stats = self.get_comprehensive_stats()
            
            # Read latest cleanup report if available
            last_cleanup_report = None
            if self.health_report_file.exists():
                try:
                    with open(self.health_report_file, 'r') as f:
                        last_cleanup_report = json.load(f)
                except Exception:
                    pass
            
            health_report = {
                'report_timestamp': datetime.now().isoformat(),
                'cache_statistics': stats,
                'last_cleanup_report': last_cleanup_report,
                'recommendations': self._generate_recommendations(stats),
                'next_cleanup_estimate': self._estimate_next_cleanup(stats)
            }
            
            return health_report
            
        except Exception as e:
            logger.error(f"Failed to generate health report: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _generate_recommendations(self, stats: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on cache statistics."""
        recommendations = []
        
        try:
            utilization = stats['current_usage']['utilization_percent']
            hit_rate = stats['performance_metrics']['basic_metrics']['hit_rate_percent']
            
            # Utilization recommendations
            if utilization > 90:
                recommendations.append("Consider increasing cache size or reducing cleanup threshold")
            elif utilization < 30:
                recommendations.append("Cache is underutilized - consider reducing cache size")
            
            # Hit rate recommendations
            if hit_rate < 60:
                recommendations.append("Low hit rate suggests cache eviction may be too aggressive")
            elif hit_rate > 90:
                recommendations.append("Excellent hit rate - cache size is well optimized")
            
            # Performance recommendations
            avg_write_time = stats['performance_metrics']['performance_metrics']['avg_write_time_ms']
            if avg_write_time > 500:  # 500ms
                recommendations.append("Write times are high - consider disk optimization or reducing atomic operation overhead")
            
            # Stage-specific recommendations
            stage_stats = stats['performance_metrics']['stage_statistics']
            for stage, stage_data in stage_stats.items():
                stage_hit_rate = stage_data['hit_rate_percent']
                if stage_hit_rate < 40:
                    recommendations.append(f"Stage '{stage}' has low hit rate ({stage_hit_rate:.1f}%) - review caching strategy")
            
        except Exception as e:
            recommendations.append(f"Error generating recommendations: {e}")
        
        return recommendations
    
    def _estimate_next_cleanup(self, stats: Dict[str, Any]) -> Optional[str]:
        """Estimate when the next cleanup will occur."""
        try:
            utilization = stats['current_usage']['utilization_percent']
            threshold = self.eviction_config.cleanup_threshold_percent
            
            if utilization >= threshold:
                return "Cleanup needed now"
            
            # Simple linear projection based on recent write activity
            write_rate_mb_per_hour = 0
            if self.metrics.write_times:
                recent_writes = len([t for t in self.metrics.write_times if t > time.time() - 3600])  # Last hour
                if recent_writes > 0:
                    avg_write_size = stats['performance_metrics']['performance_metrics']['total_bytes_written'] / max(1, self.metrics.writes)
                    write_rate_mb_per_hour = (recent_writes * avg_write_size) / (1024 * 1024)
            
            if write_rate_mb_per_hour > 0:
                current_size_mb = stats['current_usage']['total_size_mb']
                max_size_mb = stats['cache_info']['max_size_mb']
                threshold_size_mb = max_size_mb * (threshold / 100)
                remaining_mb = threshold_size_mb - current_size_mb
                hours_until_cleanup = remaining_mb / write_rate_mb_per_hour
                
                if hours_until_cleanup > 0:
                    return f"Approximately {hours_until_cleanup:.1f} hours"
            
            return "Unable to estimate (insufficient data)"
            
        except Exception:
            return None
    
    def get_comprehensive_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics with detailed metrics."""
        try:
            # Get cache size statistics
            size_stats = self._get_cache_size_stats()
            
            # Combine with metrics
            stats = {
                'cache_info': {
                    'cache_root': str(self.cache_root),
                    'max_size_bytes': self.eviction_config.max_cache_size_bytes,
                    'max_size_mb': self.eviction_config.max_cache_size_bytes / (1024 * 1024)
                },
                'current_usage': {
                    'total_size_bytes': size_stats['total_size_bytes'],
                    'total_size_mb': size_stats['total_size_bytes'] / (1024 * 1024),
                    'entry_count': size_stats['entry_count'],
                    'utilization_percent': (size_stats['total_size_bytes'] / self.eviction_config.max_cache_size_bytes) * 100,
                    'oldest_access': size_stats['oldest_access'].isoformat() if size_stats['oldest_access'] else None,
                    'newest_access': size_stats['newest_access'].isoformat() if size_stats['newest_access'] else None
                },
                'performance_metrics': self.metrics.to_dict(),
                'stage_breakdown': dict(size_stats['stage_sizes']),
                'scope_breakdown': dict(size_stats['scope_sizes']),
                'eviction_config': {
                    'cleanup_threshold_percent': self.eviction_config.cleanup_threshold_percent,
                    'target_utilization_percent': self.eviction_config.target_utilization_percent,
                    'max_entry_age_hours': self.eviction_config.max_entry_age_hours,
                    'cleanup_interval_minutes': self.eviction_config.cleanup_interval_minutes
                },
                'health_indicators': self._get_health_indicators(size_stats)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get comprehensive cache stats: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    def _get_health_indicators(self, size_stats: Dict[str, Any]) -> Dict[str, Any]:
        """Generate cache health indicators."""
        health = {
            'overall_status': 'healthy',
            'warnings': [],
            'recommendations': []
        }
        
        # Check utilization
        utilization = (size_stats['total_size_bytes'] / self.eviction_config.max_cache_size_bytes) * 100
        if utilization > 95:
            health['overall_status'] = 'critical'
            health['warnings'].append(f"Cache utilization critical: {utilization:.1f}%")
            health['recommendations'].append("Immediate cleanup required or increase cache size")
        elif utilization > 85:
            health['overall_status'] = 'warning'
            health['warnings'].append(f"Cache utilization high: {utilization:.1f}%")
            health['recommendations'].append("Consider increasing cleanup frequency")
        
        # Check hit rate
        hit_rate = self.metrics.get_hit_rate()
        if hit_rate < 50 and (self.metrics.hits + self.metrics.misses) > 100:
            health['warnings'].append(f"Low hit rate: {hit_rate:.1f}%")
            health['recommendations'].append("Review caching strategy or increase cache size")
        
        # Check error rate
        total_ops = self.metrics.hits + self.metrics.misses + self.metrics.writes
        if total_ops > 0:
            error_rate = (self.metrics.errors / total_ops) * 100
            if error_rate > 5:
                health['overall_status'] = 'warning' if health['overall_status'] == 'healthy' else health['overall_status']
                health['warnings'].append(f"High error rate: {error_rate:.1f}%")
                health['recommendations'].append("Investigate cache storage issues")
        
        # Check cleanup frequency
        if self.metrics.last_cleanup:
            hours_since_cleanup = (datetime.now() - self.metrics.last_cleanup).total_seconds() / 3600
            if hours_since_cleanup > 24:
                health['warnings'].append(f"No cleanup for {hours_since_cleanup:.1f} hours")
                health['recommendations'].append("Check cleanup scheduling")
        
        return health
    
    def get_stats(self) -> Dict[str, Any]:
        """Get basic cache statistics (backward compatibility)."""
        comprehensive_stats = self.get_comprehensive_stats()
        
        if 'error' in comprehensive_stats:
            return comprehensive_stats
            
        # Return simplified format for backward compatibility
        return {
            'metrics': {
                'hits': self.metrics.hits,
                'misses': self.metrics.misses,
                'writes': self.metrics.writes,
                'evictions': self.metrics.evictions,
                'errors': self.metrics.errors
            },
            'cache_size_bytes': comprehensive_stats['current_usage']['total_size_bytes'],
            'cache_size_mb': comprehensive_stats['current_usage']['total_size_mb'],
            'entry_count': comprehensive_stats['current_usage']['entry_count'],
            'max_size_mb': comprehensive_stats['cache_info']['max_size_mb'],
            'utilization_percent': comprehensive_stats['current_usage']['utilization_percent']
        }
    
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


def record_build_time(cache_manager: CacheManager, stage: str, build_time: float):
    """Record build time for a specific stage."""
    try:
        cache_manager.metrics.add_build_time(stage, build_time)
        logger.debug(f"Recorded build time for stage '{stage}': {build_time:.3f}s")
    except Exception as e:
        logger.warning(f"Failed to record build time for stage '{stage}': {e}")


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