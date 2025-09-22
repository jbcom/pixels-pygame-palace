"""
Security configuration for game sandbox execution using subprocess
"""

import ast
import re
from typing import List, Dict, Set, Tuple

# Resource limits for sandbox
SANDBOX_LIMITS = {
    'max_execution_time': 300,  # 5 minutes
    'max_memory_mb': 256,
    'max_cpu_percent': 50,
    'max_processes': 50,
    'max_open_files': 50,
    'max_code_size': 100000,  # 100KB
}

# Whitelist of allowed Python modules
ALLOWED_MODULES = {
    'pygame',
    'math',
    'random',
    'time',
    'sys',
    'json',
    'base64',
    'collections',
    'itertools',
    'functools',
    'datetime',
    'copy',
    'enum',
    'typing',
}

# Whitelist of allowed pygame submodules
ALLOWED_PYGAME_MODULES = {
    'pygame.display',
    'pygame.event',
    'pygame.key',
    'pygame.mouse',
    'pygame.draw',
    'pygame.image',
    'pygame.font',
    'pygame.mixer',
    'pygame.sprite',
    'pygame.time',
    'pygame.transform',
    'pygame.surface',
    'pygame.rect',
    'pygame.color',
    'pygame.mask',
    'pygame.math',
}

# Blacklist of dangerous functions and attributes
BLACKLISTED_FUNCTIONS = {
    '__import__',
    'eval',
    'exec',
    'compile',
    'open',
    'file',
    'input',
    'raw_input',
    'execfile',
    'reload',
    '__builtins__',
    'globals',
    'locals',
    'vars',
    'dir',
    'getattr',
    'setattr',
    'delattr',
    'hasattr',
    '__class__',
    '__bases__',
    '__subclasses__',
    '__mro__',
    '__dict__',
    '__code__',
    '__func__',
    '__closure__',
    '__annotations__',
    '__globals__',
    'breakpoint',
}

# Blacklisted module patterns
BLACKLISTED_MODULES = {
    'os',
    'subprocess',
    'socket',
    'urllib',
    'requests',
    'http',
    'ftplib',
    'telnetlib',
    'ssl',
    'importlib',
    'pkgutil',
    'pip',
    'setuptools',
    'distutils',
    'ctypes',
    'cffi',
    'multiprocessing',
    'threading',
    'asyncio',
    'concurrent',
    'pickle',
    'shelve',
    'marshal',
    'sqlite3',
    'dbm',
    'tempfile',
    'shutil',
    'pathlib',
    'glob',
    'fileinput',
    'linecache',
    'tokenize',
    'ast',
    'code',
    'codeop',
    'dis',
    'inspect',
    'pdb',
    'trace',
    'traceback',
    'gc',
    'weakref',
    'resource',
    'signal',
    'atexit',
    'logging',
    'warnings',
    'builtins',
    '_thread',
    'mmap',
    'select',
    'selectors',
    'termios',
    'tty',
    'pty',
    'fcntl',
    'grp',
    'pwd',
    'spwd',
    'platform',
    'sysconfig',
    'zipfile',
    'tarfile',
    'gzip',
    'bz2',
    'lzma',
    'csv',
    'email',
    'mailbox',
    'mimetypes',
    'webbrowser',
    'cgi',
    'cgitb',
    'wsgiref',
    'xml',
    'html',
    'http',
    'xmlrpc',
}

# Dangerous code patterns to detect
DANGEROUS_PATTERNS = [
    r'\b__[a-z]+__\b',  # Dunder methods
    r'\.\./',  # Path traversal
    r'\bexec\s*\(',  # exec function
    r'\beval\s*\(',  # eval function
    r'\bcompile\s*\(',  # compile function
    r'\b__import__\s*\(',  # __import__ function
    r'\bopen\s*\(',  # open function
    r'\bfile\s*\(',  # file function
    r'\bos\.',  # os module usage
    r'\bsubprocess\.',  # subprocess module usage
    r'\bsocket\.',  # socket module usage
    r'\bimportlib\.',  # importlib usage
    r'\bpkgutil\.',  # pkgutil usage
    r'\bsys\.exit',  # sys.exit
    r'(?<!pygame\.)\bexit\s*\(',  # exit function (but allow pygame.quit)
    r'(?<!pygame\.)\bquit\s*\(',  # quit function (but allow pygame.quit)
    r'lambda.*:.*lambda',  # Nested lambdas (potential obfuscation)
    r'\\x[0-9a-f]{2}',  # Hex string escapes (potential obfuscation)
    r'\\[0-7]{3}',  # Octal string escapes (potential obfuscation)
]


class CodeValidator:
    """Validates user code for security issues"""
    
    @staticmethod
    def validate_code(code: str) -> Tuple[bool, str]:
        """
        Validate user code for security issues
        
        Args:
            code: Python code to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check code size
        if len(code) > SANDBOX_LIMITS['max_code_size']:
            return False, f"Code size exceeds limit ({SANDBOX_LIMITS['max_code_size']} bytes)"
        
        # Check for dangerous patterns using regex
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE | re.MULTILINE):
                return False, f"Dangerous code pattern detected: {pattern}"
        
        # Parse AST for deeper analysis
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error in code: {str(e)}"
        
        # Validate AST nodes
        validator = ASTValidator()
        try:
            validator.visit(tree)
        except SecurityError as e:
            return False, str(e)
        
        # Check for pygame import
        if not validator.has_pygame_import:
            return False, "Code must import pygame to create a game"
        
        return True, ""


class SecurityError(Exception):
    """Exception raised for security violations"""
    pass


class ASTValidator(ast.NodeVisitor):
    """AST visitor to validate code security"""
    
    def __init__(self):
        self.has_pygame_import = False
        self.imported_modules = set()
        
    def visit_Import(self, node):
        """Validate import statements"""
        for alias in node.names:
            module_name = alias.name.split('.')[0]
            
            if module_name == 'pygame':
                self.has_pygame_import = True
                # Check for allowed pygame submodules
                if '.' in alias.name and alias.name not in ALLOWED_PYGAME_MODULES:
                    raise SecurityError(f"Import of pygame submodule '{alias.name}' not allowed")
            elif module_name not in ALLOWED_MODULES:
                raise SecurityError(f"Import of module '{module_name}' not allowed")
            
            self.imported_modules.add(module_name)
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Validate from-import statements"""
        if node.module:
            module_name = node.module.split('.')[0]
            
            if module_name == 'pygame':
                self.has_pygame_import = True
                # Check for allowed pygame submodules
                if node.module not in ALLOWED_PYGAME_MODULES and node.module != 'pygame':
                    raise SecurityError(f"Import from pygame submodule '{node.module}' not allowed")
            elif module_name not in ALLOWED_MODULES:
                raise SecurityError(f"Import from module '{module_name}' not allowed")
            
            self.imported_modules.add(module_name)
        self.generic_visit(node)
    
    def visit_Name(self, node):
        """Check for blacklisted names"""
        # Special handling for quit/exit - allow if it's pygame.quit
        if node.id in ['quit', 'exit']:
            # Check if this is part of pygame.quit() by looking at parent context
            # This will be caught by visit_Call if it's a direct call
            pass
        elif node.id in BLACKLISTED_FUNCTIONS:
            raise SecurityError(f"Use of '{node.id}' is not allowed")
        self.generic_visit(node)
    
    def visit_Attribute(self, node):
        """Check for dangerous attributes"""
        # Check for dunder attributes
        if hasattr(node, 'attr') and node.attr.startswith('__') and node.attr.endswith('__'):
            # Allow some safe dunder methods
            safe_dunders = {'__init__', '__str__', '__repr__', '__len__', '__iter__', '__next__', '__enter__', '__exit__'}
            if node.attr not in safe_dunders:
                raise SecurityError(f"Use of dunder attribute '{node.attr}' is not allowed")
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """Check for dangerous function calls"""
        # Check for pygame.quit() - this is allowed
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name) and node.func.value.id == 'pygame':
                if node.func.attr == 'quit':
                    # pygame.quit() is allowed
                    self.generic_visit(node)
                    return
        
        # Check for direct quit() or exit() calls - not allowed
        if isinstance(node.func, ast.Name):
            if node.func.id in ['quit', 'exit']:
                raise SecurityError(f"Direct call to '{node.func.id}' is not allowed (use pygame.quit() instead)")
            if node.func.id in BLACKLISTED_FUNCTIONS:
                raise SecurityError(f"Call to '{node.func.id}' is not allowed")
        
        # Check for getattr/setattr/delattr with string arguments
        if isinstance(node.func, ast.Name) and node.func.id in ['getattr', 'setattr', 'delattr', 'hasattr']:
            raise SecurityError(f"Call to '{node.func.id}' is not allowed")
        
        self.generic_visit(node)
    
    def visit_With(self, node):
        """Check for dangerous context managers"""
        for item in node.items:
            # Check for open() calls in with statements
            if isinstance(item.context_expr, ast.Call):
                if isinstance(item.context_expr.func, ast.Name):
                    if item.context_expr.func.id == 'open':
                        raise SecurityError("File operations are not allowed")
        self.generic_visit(node)
    
    def visit_Try(self, node):
        """Allow try/except but check the body"""
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node):
        """Allow function definitions but check for dangerous patterns"""
        # Check for exec/eval in function decorators
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name) and decorator.id in BLACKLISTED_FUNCTIONS:
                raise SecurityError(f"Use of '{decorator.id}' as decorator is not allowed")
        self.generic_visit(node)
    
    def visit_ClassDef(self, node):
        """Allow class definitions but check for dangerous patterns"""
        # Check for dangerous base classes
        for base in node.bases:
            if isinstance(base, ast.Name) and base.id in ['type', 'object']:
                # Allow inheriting from object, but not type
                if base.id == 'type':
                    raise SecurityError("Metaclass manipulation is not allowed")
        self.generic_visit(node)
    
    def visit_Lambda(self, node):
        """Allow lambda but check for nested lambdas"""
        # Nested lambdas can be used for obfuscation
        for child_node in ast.walk(node.body):
            if isinstance(child_node, ast.Lambda) and child_node != node:
                raise SecurityError("Nested lambda functions are not allowed")
        self.generic_visit(node)