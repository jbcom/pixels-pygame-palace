#!/usr/bin/env python3
"""
Test script to verify the security implementation
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from security_config import CodeValidator

def test_code_validation():
    """Test various code samples for security validation"""
    
    print("=" * 60)
    print("SECURITY VALIDATION TESTS")
    print("=" * 60)
    
    # Test cases: (description, code, expected_valid)
    test_cases = [
        (
            "Valid pygame code",
            """
import pygame
pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Safe Game")
clock = pygame.time.Clock()

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    screen.fill((0, 0, 0))
    pygame.draw.circle(screen, (255, 0, 0), (400, 300), 50)
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
""",
            True
        ),
        (
            "Attempt to access filesystem",
            """
import pygame
pygame.init()

# Try to read sensitive file
with open('/etc/passwd', 'r') as f:
    data = f.read()
    print(data)
""",
            False
        ),
        (
            "Attempt to import os module",
            """
import pygame
import os

pygame.init()
# Try to execute system commands
os.system('ls /')
""",
            False
        ),
        (
            "Attempt to use subprocess",
            """
import pygame
import subprocess

pygame.init()
# Try to spawn subprocess
result = subprocess.run(['ls', '-la'], capture_output=True)
print(result.stdout)
""",
            False
        ),
        (
            "Attempt to use eval",
            """
import pygame
pygame.init()

# Try to use eval
code = "print('evil code')"
eval(code)
""",
            False
        ),
        (
            "Attempt to use __import__",
            """
import pygame
pygame.init()

# Try to dynamically import modules
os = __import__('os')
os.system('whoami')
""",
            False
        ),
        (
            "Attempt network access",
            """
import pygame
import socket

pygame.init()
# Try to make network connection
s = socket.socket()
s.connect(('google.com', 80))
""",
            False
        ),
        (
            "Attempt to access globals",
            """
import pygame
pygame.init()

# Try to access global namespace
g = globals()
print(g)
""",
            False
        ),
        (
            "Valid game with allowed modules",
            """
import pygame
import random
import math

pygame.init()
screen = pygame.display.set_mode((800, 600))

# Generate random positions
positions = [(random.randint(0, 800), random.randint(0, 600)) for _ in range(10)]

# Use math functions
angle = math.pi / 4
radius = math.sqrt(100)

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    screen.fill((0, 0, 0))
    for pos in positions:
        pygame.draw.circle(screen, (255, 255, 255), pos, 5)
    
    pygame.display.flip()

pygame.quit()
""",
            True
        ),
        (
            "Missing pygame import",
            """
# This is just Python code without pygame
print("Hello World")
for i in range(10):
    print(i)
""",
            False
        )
    ]
    
    # Run tests
    passed = 0
    failed = 0
    
    for description, code, expected_valid in test_cases:
        print(f"\nTest: {description}")
        print("-" * 40)
        
        is_valid, error_msg = CodeValidator.validate_code(code)
        
        if is_valid == expected_valid:
            print(f"✓ PASSED - Validation result: {'Valid' if is_valid else 'Invalid'}")
            if not is_valid:
                print(f"  Error: {error_msg}")
            passed += 1
        else:
            print(f"✗ FAILED - Expected: {'Valid' if expected_valid else 'Invalid'}, Got: {'Valid' if is_valid else 'Invalid'}")
            if error_msg:
                print(f"  Error: {error_msg}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"TEST SUMMARY: {passed} passed, {failed} failed out of {len(test_cases)} tests")
    print("=" * 60)
    
    return failed == 0


def test_docker_availability():
    """Test if Docker is available and configured"""
    print("\n" + "=" * 60)
    print("DOCKER AVAILABILITY TEST")
    print("=" * 60)
    
    try:
        import docker
        print("✓ Docker library installed")
        
        try:
            client = docker.from_env()
            client.ping()
            print("✓ Docker daemon is running and accessible")
            
            # Check if our image exists
            try:
                client.images.get('game-executor:latest')
                print("✓ game-executor:latest Docker image found")
            except docker.errors.ImageNotFound:
                print("✗ game-executor:latest Docker image not found")
                print("  Run: cd backend && ./build_docker.sh")
            
            return True
            
        except docker.errors.DockerException as e:
            print(f"✗ Docker daemon not accessible: {e}")
            print("  Make sure Docker is installed and running")
            return False
            
    except ImportError:
        print("✗ Docker library not installed")
        print("  This should have been installed already")
        return False


def main():
    """Run all security tests"""
    print("\n" + "=" * 60)
    print("PYTHON GAME EXECUTOR SECURITY TESTS")
    print("=" * 60)
    
    # Test code validation
    validation_passed = test_code_validation()
    
    # Test Docker availability
    docker_available = test_docker_availability()
    
    # Overall summary
    print("\n" + "=" * 60)
    print("OVERALL SUMMARY")
    print("=" * 60)
    
    if validation_passed:
        print("✓ Code validation security: PASSED")
    else:
        print("✗ Code validation security: FAILED")
    
    if docker_available:
        print("✓ Docker containerization: AVAILABLE")
    else:
        print("⚠ Docker containerization: NOT AVAILABLE (fallback to subprocess)")
    
    print("\nSecurity implementation status:")
    if validation_passed and docker_available:
        print("✓ FULLY SECURE - All security features operational")
    elif validation_passed:
        print("⚠ PARTIALLY SECURE - Code validation working, Docker not available")
    else:
        print("✗ INSECURE - Critical security features not working")
    
    print("=" * 60)


if __name__ == "__main__":
    main()