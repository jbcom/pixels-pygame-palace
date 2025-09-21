"""
Compiler Orchestrator - Core compilation engine for the game builder.

This module orchestrates the compilation pipeline:
1. Validate component selections against templates
2. Resolve dependency trees and check compatibility
3. Generate code using Jinja2 templates
4. Package assets with logical-to-physical mapping
5. Build desktop and web outputs
6. Handle content-addressable caching
"""

import os
import json
import hashlib
import logging
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from datetime import datetime
import threading
import asyncio

try:
    from .config import get_config
    from .asset_packager import AssetPackager
    from .ecs_runtime.code_generator import CodeGenerator
    from .templates.template_renderer import TemplateRenderer
except ImportError:
    # Handle case when run as script or in different contexts
    try:
        from config import get_config
        from asset_packager import AssetPackager
        from ecs_runtime.code_generator import CodeGenerator
        from templates.template_renderer import TemplateRenderer
    except ImportError:
        # Provide minimal fallbacks for critical testing
        import os
        import tempfile
        from types import SimpleNamespace
        
        class FallbackConfig:
            """Fallback config with dict-like behavior."""
            def __init__(self):
                self.compiler = SimpleNamespace(
                    CACHE_DIR=os.path.join(tempfile.gettempdir(), 'game_cache'),
                    OUTPUT_DIR=os.path.join(tempfile.gettempdir(), 'game_builds'),
                    enable_desktop_builds=True,
                    enable_web_builds=True
                )
            
            def get(self, key, default=None):
                """Dict-like get method."""
                return getattr(self, key, default)
        
        def get_config():
            """Fallback config for testing."""
            return FallbackConfig()
        
        class AssetPackager:
            def __init__(self): pass
            def package_assets(self, *args, **kwargs): 
                return {'version': '1.0', 'assets': {}, 'total_size': 0}
        
        class CodeGenerator:
            def __init__(self): pass
            def generate_game(self, *args, **kwargs): 
                return {'main.py': '# Generated fallback code\nprint("Hello World!")'}
        
        class TemplateRenderer:
            def __init__(self): pass
            def wrap_for_web(self, code, template_id): 
                return code

logger = logging.getLogger(__name__)


@dataclass
class CompilationRequest:
    """Represents a game compilation request."""
    template_id: str
    components: List[Dict[str, Any]]
    configuration: Dict[str, Any]
    targets: List[str]  # ['desktop', 'web']
    assets: Optional[List[Dict[str, Any]]] = None
    user_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def get_cache_key(self) -> str:
        """Generate content-addressable cache key based on compilation inputs."""
        content = {
            'template_id': self.template_id,
            'components': sorted([c['id'] for c in self.components]),
            'configuration': self.configuration,
            'targets': sorted(self.targets)
        }
        
        # SECURITY: Include asset fingerprints to prevent cache collisions
        if self.assets:
            asset_fingerprints = []
            for asset in self.assets:
                asset_info = {
                    'path': asset.get('path', ''),
                    'type': asset.get('type', ''),
                    'logical_path': asset.get('logical_path', '')
                }
                # Calculate fingerprint of asset metadata
                asset_str = json.dumps(asset_info, sort_keys=True)
                asset_fingerprint = hashlib.sha256(asset_str.encode()).hexdigest()[:8]
                asset_fingerprints.append(asset_fingerprint)
            content['asset_fingerprints'] = sorted(asset_fingerprints)
        
        content_str = json.dumps(content, sort_keys=True)
        return hashlib.sha256(content_str.encode()).hexdigest()[:16]


@dataclass
class CompilationResult:
    """Represents the result of a compilation."""
    success: bool
    compilation_id: str
    cache_key: str
    outputs: Dict[str, str]  # target -> path mapping
    errors: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]
    created_at: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['created_at'] = self.created_at.isoformat()
        return result


class DependencyResolver:
    """Resolves and validates component dependencies."""
    
    def __init__(self, components_registry: Dict[str, Dict]):
        self.components_registry = components_registry
    
    def resolve_dependencies(self, 
                           template: Dict[str, Any], 
                           selected_components: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
        """
        Resolve component dependencies and return (resolved_order, errors).
        
        Args:
            template: The game template
            selected_components: List of selected components with configurations
            
        Returns:
            Tuple of (resolved_component_ids, validation_errors)
        """
        errors = []
        component_ids = [c['id'] for c in selected_components]
        
        # Validate template requirements
        required_systems = template.get('requiredSystems', [])
        required_mechanics = template.get('requiredMechanics', [])
        
        # Check that required slots are filled
        errors.extend(self._validate_required_slots(template, selected_components))
        
        # Check component compatibility
        errors.extend(self._validate_component_compatibility(selected_components))
        
        # Resolve dependency order
        try:
            resolved_order = self._topological_sort(component_ids)
        except ValueError as e:
            errors.append(f"Dependency cycle detected: {e}")
            resolved_order = component_ids  # fallback
        
        return resolved_order, errors
    
    def _validate_required_slots(self, template: Dict, components: List[Dict]) -> List[str]:
        """Validate that all required template slots are filled."""
        errors = []
        component_types = {c['type'] for c in components}
        
        for slot in template.get('slots', []):
            if slot.get('required', False):
                accepted_types = set(slot.get('acceptedTypes', []))
                if not component_types.intersection(accepted_types):
                    errors.append(f"Required slot '{slot['name']}' is not filled")
        
        return errors
    
    def _validate_component_compatibility(self, components: List[Dict]) -> List[str]:
        """Check for component incompatibilities."""
        errors = []
        component_ids = [c['id'] for c in components]
        
        for component in components:
            component_def = self.components_registry.get(component['id'])
            if not component_def:
                errors.append(f"Unknown component: {component['id']}")
                continue
            
            # Check dependencies
            for dep in component_def.get('dependencies', []):
                dep_id = dep['componentId']
                if dep_id not in component_ids and not dep.get('optional', False):
                    errors.append(f"Component '{component['id']}' requires '{dep_id}'")
        
        return errors
    
    def _topological_sort(self, component_ids: List[str]) -> List[str]:
        """Sort components by dependency order using topological sort."""
        # Build dependency graph
        graph = {}
        in_degree = {}
        
        for comp_id in component_ids:
            graph[comp_id] = []
            in_degree[comp_id] = 0
        
        for comp_id in component_ids:
            component_def = self.components_registry.get(comp_id, {})
            for dep in component_def.get('dependencies', []):
                dep_id = dep['componentId']
                if dep_id in component_ids:
                    graph[dep_id].append(comp_id)
                    in_degree[comp_id] += 1
        
        # Kahn's algorithm
        queue = [comp_id for comp_id in component_ids if in_degree[comp_id] == 0]
        result = []
        
        while queue:
            current = queue.pop(0)
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        if len(result) != len(component_ids):
            raise ValueError("Circular dependency detected")
        
        return result


class CompilerOrchestrator:
    """Main orchestrator for game compilation pipeline."""
    
    def __init__(self):
        self.config = get_config()
        # Handle different config structures
        if hasattr(self.config, 'compiler'):
            compilation_config = self.config.compiler
        elif hasattr(self.config, 'COMPILER'):
            compilation_config = self.config.COMPILER
        else:
            # Fallback for dict-style config
            if hasattr(self.config, 'get'):
                compilation_config = self.config.get('COMPILER', {})
            else:
                # For object-style configs, try to get COMPILER attribute
                compilation_config = getattr(self.config, 'COMPILER', {})
                if not compilation_config:
                    # Last fallback - use compiler attribute if available
                    compilation_config = getattr(self.config, 'compiler', {})
        
        cache_dir = getattr(compilation_config, 'CACHE_DIR', None) or getattr(compilation_config, 'get', lambda k, d: d)('CACHE_DIR', '/tmp/game_cache')
        output_dir = getattr(compilation_config, 'OUTPUT_DIR', None) or getattr(compilation_config, 'get', lambda k, d: d)('OUTPUT_DIR', '/tmp/game_builds')
        
        self.cache_dir = Path(cache_dir)
        self.output_dir = Path(output_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        
        # Initialize subsystems
        self.asset_packager = AssetPackager()
        self.code_generator = CodeGenerator()
        self.template_renderer = TemplateRenderer()
        
        # Load registries
        self._load_registries()
        
        # Active compilations
        self.active_compilations: Dict[str, Dict] = {}
        self._compilation_lock = threading.Lock()
    
    def _load_registries(self):
        """Load component, template, and asset registries."""
        try:
            # Load from seed data files
            base_dir = Path(__file__).parent.parent.parent / 'shared' / 'seed-data'
            
            with open(base_dir / 'templates.json', 'r') as f:
                templates_list = json.load(f)
                self.templates_registry = {t['id']: t for t in templates_list}
            
            with open(base_dir / 'components.json', 'r') as f:
                components_list = json.load(f)
                self.components_registry = {c['id']: c for c in components_list}
            
            with open(base_dir / 'mechanics.json', 'r') as f:
                mechanics_list = json.load(f)
                self.mechanics_registry = {m['id']: m for m in mechanics_list}
            
            with open(base_dir / 'assets.json', 'r') as f:
                assets_list = json.load(f)
                self.assets_registry = {a['id']: a for a in assets_list}
            
            logger.info(f"Loaded {len(self.templates_registry)} templates, "
                       f"{len(self.components_registry)} components, "
                       f"{len(self.mechanics_registry)} mechanics, "
                       f"{len(self.assets_registry)} assets")
        
        except Exception as e:
            logger.error(f"Failed to load registries: {e}")
            # Initialize empty registries as fallback
            self.templates_registry = {}
            self.components_registry = {}
            self.mechanics_registry = {}
            self.assets_registry = {}
    
    def start_compilation(self, request: CompilationRequest) -> str:
        """
        Start asynchronous compilation process.
        
        Args:
            request: The compilation request
            
        Returns:
            Compilation ID for tracking progress
        """
        compilation_id = f"comp_{request.get_cache_key()}_{int(datetime.now().timestamp())}"
        
        with self._compilation_lock:
            self.active_compilations[compilation_id] = {
                'request': request,
                'status': 'queued',
                'progress': 0,
                'start_time': datetime.now(),
                'result': None,
                'errors': [],
                'warnings': []
            }
        
        # Start compilation in background thread
        thread = threading.Thread(
            target=self._run_compilation,
            args=(compilation_id, request),
            daemon=True
        )
        thread.start()
        
        return compilation_id
    
    def get_compilation_status(self, compilation_id: str) -> Optional[Dict[str, Any]]:
        """Get status of active or completed compilation."""
        with self._compilation_lock:
            return self.active_compilations.get(compilation_id)
    
    def _run_compilation(self, compilation_id: str, request: CompilationRequest):
        """Execute the compilation pipeline."""
        try:
            self._update_compilation_status(compilation_id, 'validating', 10)
            
            # Step 1: Validate request
            template, validation_errors = self._validate_request(request)
            if validation_errors:
                self._update_compilation_status(
                    compilation_id, 'failed', 100, 
                    errors=validation_errors
                )
                return
            
            self._update_compilation_status(compilation_id, 'resolving', 20)
            
            # Step 2: Resolve dependencies
            resolver = DependencyResolver(self.components_registry)
            resolved_order, dependency_errors = resolver.resolve_dependencies(
                template, request.components
            )
            if dependency_errors:
                self._update_compilation_status(
                    compilation_id, 'failed', 100,
                    errors=dependency_errors
                )
                return
            
            self._update_compilation_status(compilation_id, 'generating', 40)
            
            # Step 3: Generate code
            game_code = self._generate_game_code(
                template, request.components, resolved_order, request.configuration
            )
            
            self._update_compilation_status(compilation_id, 'packaging', 60)
            
            # Step 4: Package assets
            asset_manifest = self._package_assets(request)
            
            self._update_compilation_status(compilation_id, 'building', 80)
            
            # Step 5: Build outputs for each target
            outputs = {}
            for target in request.targets:
                output_path = self._build_target(
                    compilation_id, target, game_code, asset_manifest, request
                )
                outputs[target] = output_path
            
            # Step 6: Create final result
            result = CompilationResult(
                success=True,
                compilation_id=compilation_id,
                cache_key=request.get_cache_key(),
                outputs=outputs,
                errors=[],
                warnings=[],
                metadata={
                    'template_id': request.template_id,
                    'component_count': len(request.components),
                    'targets': request.targets,
                    'resolved_order': resolved_order
                },
                created_at=datetime.now()
            )
            
            self._update_compilation_status(compilation_id, 'completed', 100, result=result)
            logger.info(f"Compilation {compilation_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Compilation {compilation_id} failed: {e}", exc_info=True)
            self._update_compilation_status(
                compilation_id, 'failed', 100,
                errors=[f"Internal error: {str(e)}"]
            )
    
    def _update_compilation_status(self, compilation_id: str, status: str, progress: int, 
                                 result: Optional[CompilationResult] = None,
                                 errors: Optional[List[str]] = None,
                                 warnings: Optional[List[str]] = None):
        """Update compilation status."""
        with self._compilation_lock:
            if compilation_id in self.active_compilations:
                comp = self.active_compilations[compilation_id]
                comp['status'] = status
                comp['progress'] = progress
                if result:
                    comp['result'] = result.to_dict()
                if errors:
                    comp['errors'].extend(errors)
                if warnings:
                    comp['warnings'].extend(warnings)
    
    def _validate_request(self, request: CompilationRequest) -> Tuple[Dict[str, Any], List[str]]:
        """Validate compilation request."""
        errors = []
        
        # Check template exists
        template = self.templates_registry.get(request.template_id)
        if not template:
            errors.append(f"Unknown template: {request.template_id}")
            return {}, errors
        
        # Validate build targets
        valid_targets = {'desktop', 'web'}
        for target in request.targets:
            if target not in valid_targets:
                errors.append(f"Unsupported build target: {target}")
        
        # CRITICAL: Enforce build target flags
        for target in request.targets:
            if target == 'web':
                compiler_config = getattr(self.config, 'compiler', None) or getattr(self.config, 'COMPILER', None) or getattr(self.config, 'get', lambda k, d: d)('COMPILER', {})
                enable_web = getattr(compiler_config, 'enable_web_builds', getattr(compiler_config, 'ENABLE_WEB_BUILDS', True))
                if not enable_web:
                    errors.append(f"Web builds are disabled. Enable ENABLE_WEB_BUILDS in configuration.")
            elif target == 'desktop':
                compiler_config = getattr(self.config, 'compiler', None) or getattr(self.config, 'COMPILER', None) or getattr(self.config, 'get', lambda k, d: d)('COMPILER', {})
                enable_desktop = getattr(compiler_config, 'enable_desktop_builds', getattr(compiler_config, 'ENABLE_DESKTOP_BUILDS', True))
                if not enable_desktop:
                    errors.append(f"Desktop builds are disabled. Enable ENABLE_DESKTOP_BUILDS in configuration.")
        
        # Check template supports requested targets
        supported_targets = set(template.get('buildTargets', ['desktop', 'web']))
        for target in request.targets:
            if target not in supported_targets:
                errors.append(f"Template '{request.template_id}' doesn't support target '{target}'")
        
        return template, errors
    
    def _generate_game_code(self, template: Dict, components: List[Dict], 
                          resolved_order: List[str], configuration: Dict) -> Dict[str, str]:
        """Generate game code using templates."""
        try:
            return self.code_generator.generate_game(
                template, components, resolved_order, configuration
            )
        except Exception as e:
            logger.error(f"Code generation failed: {e}", exc_info=True)
            raise
    
    def _package_assets(self, request: CompilationRequest) -> Dict[str, Any]:
        """Package and prepare assets."""
        try:
            # Collect assets from components
            asset_refs = []
            for component in request.components:
                component_def = self.components_registry.get(component['id'], {})
                asset_refs.extend(component_def.get('assetReferences', []))
            
            # Package assets
            return self.asset_packager.package_assets(
                asset_refs, request.assets or [], request.get_cache_key()
            )
        except Exception as e:
            logger.error(f"Asset packaging failed: {e}", exc_info=True)
            raise
    
    def _build_target(self, compilation_id: str, target: str, game_code: Dict[str, str],
                     asset_manifest: Dict[str, Any], request: CompilationRequest) -> str:
        """Build output for specific target platform."""
        output_path = self.output_dir / compilation_id / target
        output_path.mkdir(parents=True, exist_ok=True)
        
        if target == 'desktop':
            return self._build_desktop(output_path, game_code, asset_manifest, request)
        elif target == 'web':
            return self._build_web(output_path, game_code, asset_manifest, request)
        else:
            raise ValueError(f"Unsupported build target: {target}")
    
    def _build_desktop(self, output_path: Path, game_code: Dict[str, str],
                      asset_manifest: Dict[str, Any], request: CompilationRequest) -> str:
        """Build desktop Python game."""
        # Double-check desktop builds are enabled
        compiler_config = getattr(self.config, 'compiler', None) or getattr(self.config, 'COMPILER', None) or getattr(self.config, 'get', lambda k, d: d)('COMPILER', {})
        enable_desktop = getattr(compiler_config, 'enable_desktop_builds', getattr(compiler_config, 'ENABLE_DESKTOP_BUILDS', True))
        if not enable_desktop:
            raise ValueError("Desktop builds are disabled")
            
        # Write main game file
        main_py = output_path / 'main.py'
        main_py.write_text(game_code.get('main.py', ''))
        
        # Write additional modules
        for filename, code in game_code.items():
            if filename != 'main.py':
                file_path = output_path / filename
                file_path.parent.mkdir(exist_ok=True)
                file_path.write_text(code)
        
        # Copy assets
        assets_dir = output_path / 'assets'
        assets_dir.mkdir(exist_ok=True)
        
        for logical_path, asset_info in asset_manifest.get('assets', {}).items():
            # Handle both old format (physical_path) and new format (asset dict)
            if isinstance(asset_info, dict):
                physical_path = asset_info.get('physical_path')
            else:
                physical_path = asset_info  # legacy format
                
            if physical_path:
                dest_path = assets_dir / logical_path
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                if Path(physical_path).exists():
                    shutil.copy2(physical_path, dest_path)
        
        # Write asset manifest
        manifest_path = output_path / 'assets' / 'manifest.json'
        manifest_path.write_text(json.dumps(asset_manifest, indent=2))
        
        # Write requirements.txt
        requirements = output_path / 'requirements.txt'
        requirements.write_text('pygame-ce>=2.1.0\nPillow>=8.0.0\n')
        
        # Write launch script
        launch_script = output_path / 'run.py'
        launch_script.write_text('''#!/usr/bin/env python3
"""Game launcher script."""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import and run main game
import main

if __name__ == '__main__':
    main.main()
''')
        
        return str(output_path)
    
    def _build_web(self, output_path: Path, game_code: Dict[str, str],
                  asset_manifest: Dict[str, Any], request: CompilationRequest) -> str:
        """Build web-compatible game using pygbag structure."""
        # Double-check web builds are enabled
        compiler_config = getattr(self.config, 'compiler', None) or getattr(self.config, 'COMPILER', None) or getattr(self.config, 'get', lambda k, d: d)('COMPILER', {})
        enable_web = getattr(compiler_config, 'enable_web_builds', getattr(compiler_config, 'ENABLE_WEB_BUILDS', True))
        if not enable_web:
            raise ValueError("Web builds are disabled")
            
        # Create pygbag-compatible structure
        src_dir = output_path / 'src'
        src_dir.mkdir(exist_ok=True)
        
        # Write main.py with web compatibility wrapper
        main_py = src_dir / 'main.py'
        try:
            web_wrapped_code = self.template_renderer.wrap_for_web(
                game_code.get('main.py', ''), request.template_id
            )
        except Exception as e:
            logger.warning(f"Template rendering failed: {e}, using original code")
            web_wrapped_code = game_code.get('main.py', '')
        main_py.write_text(web_wrapped_code)
        
        # Write other modules
        for filename, code in game_code.items():
            if filename != 'main.py':
                file_path = src_dir / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(code)
        
        # Copy and convert assets for web
        assets_dir = src_dir / 'assets'
        assets_dir.mkdir(exist_ok=True)
        
        for logical_path, asset_info in asset_manifest.get('assets', {}).items():
            # Handle both old format (physical_path) and new format (asset dict)
            if isinstance(asset_info, dict):
                physical_path = asset_info.get('physical_path')
            else:
                physical_path = asset_info  # legacy format
                
            if physical_path:
                dest_path = assets_dir / logical_path
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                if Path(physical_path).exists():
                    # Convert assets for web compatibility if needed
                    self.asset_packager.convert_for_web(physical_path, dest_path)
        
        # Write pygbag configuration
        pygbag_toml = output_path / 'pygbag.toml'
        template = self.templates_registry.get(request.template_id, {})
        game_settings = template.get('gameSettings', {})
        
        config_content = f'''[pygbag]
width = {game_settings.get("screenWidth", 800)}
height = {game_settings.get("screenHeight", 600)}
title = "{template.get("name", "Generated Game")}"
author = "Pixel's PyGame Palace"
icon = "pygame"
archive = false
ume_block = 0
cdn = "https://pyodide.org/"
template = "custom"
name = "{request.get_cache_key()}"
'''
        pygbag_toml.write_text(config_content)
        
        return str(output_path)
    
    def cleanup_old_compilations(self, max_age_hours: int = 24) -> int:
        """Clean up old compilation results."""
        cleaned = 0
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
        
        with self._compilation_lock:
            to_remove = []
            for comp_id, comp_data in self.active_compilations.items():
                if comp_data['start_time'].timestamp() < cutoff_time:
                    to_remove.append(comp_id)
            
            for comp_id in to_remove:
                del self.active_compilations[comp_id]
                
                # Clean up output directory
                output_path = self.output_dir / comp_id
                if output_path.exists():
                    shutil.rmtree(output_path)
                
                cleaned += 1
        
        logger.info(f"Cleaned up {cleaned} old compilations")
        return cleaned


# Global instance
compiler_orchestrator = CompilerOrchestrator()