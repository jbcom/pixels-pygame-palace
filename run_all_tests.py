#!/usr/bin/env python3
"""
Comprehensive Test Runner
Orchestrates all backend and frontend tests for the game creation platform
"""

import os
import sys
import json
import time
import subprocess
import argparse
import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import threading
import signal

# Test result tracking
class TestResults:
    def __init__(self):
        self.backend_results = {}
        self.playwright_results = {}
        self.start_time = None
        self.end_time = None
        self.flask_process = None
        self.frontend_process = None
        
    def add_backend_result(self, test_name: str, passed: bool, details: str = ""):
        self.backend_results[test_name] = {
            'passed': passed,
            'details': details,
            'timestamp': datetime.datetime.now().isoformat()
        }
    
    def add_playwright_result(self, test_name: str, passed: bool, details: str = ""):
        self.playwright_results[test_name] = {
            'passed': passed,
            'details': details,
            'timestamp': datetime.datetime.now().isoformat()
        }
    
    def generate_report(self) -> str:
        """Generate a comprehensive test report"""
        total_backend = len(self.backend_results)
        passed_backend = sum(1 for r in self.backend_results.values() if r['passed'])
        total_playwright = len(self.playwright_results)
        passed_playwright = sum(1 for r in self.playwright_results.values() if r['passed'])
        
        duration = (self.end_time - self.start_time).total_seconds() if self.end_time else 0
        
        report = f"""
========================================
TEST EXECUTION REPORT
========================================
Generated: {datetime.datetime.now().isoformat()}
Duration: {duration:.2f} seconds

SUMMARY
----------------------------------------
Backend Tests:     {passed_backend}/{total_backend} passed
Playwright Tests:  {passed_playwright}/{total_playwright} passed
Overall Success:   {(passed_backend == total_backend) and (passed_playwright == total_playwright)}

BACKEND TEST RESULTS
----------------------------------------"""
        
        for test_name, result in self.backend_results.items():
            status = "✓ PASS" if result['passed'] else "✗ FAIL"
            report += f"\n{status} - {test_name}"
            if result['details']:
                report += f"\n    {result['details']}"
        
        report += """

PLAYWRIGHT TEST RESULTS
----------------------------------------"""
        
        for test_name, result in self.playwright_results.items():
            status = "✓ PASS" if result['passed'] else "✗ FAIL"
            report += f"\n{status} - {test_name}"
            if result['details']:
                report += f"\n    {result['details']}"
        
        report += "\n\n========================================"
        return report
    
    def save_json_report(self, filepath: str):
        """Save results as JSON for CI/CD integration"""
        report_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'duration': (self.end_time - self.start_time).total_seconds() if self.end_time else 0,
            'backend_tests': self.backend_results,
            'playwright_tests': self.playwright_results,
            'summary': {
                'backend_passed': sum(1 for r in self.backend_results.values() if r['passed']),
                'backend_total': len(self.backend_results),
                'playwright_passed': sum(1 for r in self.playwright_results.values() if r['passed']),
                'playwright_total': len(self.playwright_results)
            }
        }
        
        with open(filepath, 'w') as f:
            json.dump(report_data, f, indent=2)


class TestRunner:
    def __init__(self, verbose: bool = False, parallel: bool = False):
        self.verbose = verbose
        self.parallel = parallel
        self.results = TestResults()
        self.flask_process = None
        self.frontend_process = None
        self.processes = []
        
    def log(self, message: str):
        """Print log message if verbose mode is enabled"""
        if self.verbose:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {message}")
    
    def start_flask_backend(self) -> bool:
        """Start the Flask backend server"""
        self.log("Starting Flask backend...")
        
        env = os.environ.copy()
        env['FLASK_APP'] = 'backend/app.py'
        env['FLASK_ENV'] = 'testing'
        env['SECRET_KEY'] = 'test-secret-key'
        
        try:
            self.flask_process = subprocess.Popen(
                ['python', '-m', 'flask', 'run', '--port', '5001'],
                env=env,
                stdout=subprocess.PIPE if not self.verbose else None,
                stderr=subprocess.PIPE if not self.verbose else None
            )
            self.processes.append(self.flask_process)
            
            # Wait for backend to be ready
            import requests
            max_attempts = 30
            for i in range(max_attempts):
                try:
                    response = requests.get('http://localhost:5001/api/health')
                    if response.status_code == 200:
                        self.log("Flask backend started successfully")
                        return True
                except requests.ConnectionError:
                    time.sleep(1)
            
            self.log("Flask backend failed to start")
            return False
            
        except Exception as e:
            self.log(f"Error starting Flask backend: {e}")
            return False
    
    def start_frontend(self) -> bool:
        """Start the frontend development server"""
        self.log("Starting frontend server...")
        
        try:
            self.frontend_process = subprocess.Popen(
                ['npm', 'run', 'dev'],
                stdout=subprocess.PIPE if not self.verbose else None,
                stderr=subprocess.PIPE if not self.verbose else None
            )
            self.processes.append(self.frontend_process)
            
            # Wait for frontend to be ready
            time.sleep(5)  # Give it time to start
            
            self.log("Frontend server started")
            return True
            
        except Exception as e:
            self.log(f"Error starting frontend: {e}")
            return False
    
    def run_backend_tests(self) -> bool:
        """Run Python backend tests"""
        self.log("Running backend tests...")
        
        test_modules = [
            'test.e2e.backend_test_suite',
            'test.e2e.game_flow_tests'
        ]
        
        all_passed = True
        
        for module in test_modules:
            self.log(f"Running {module}...")
            
            try:
                result = subprocess.run(
                    [sys.executable, '-m', 'unittest', module, '-v'],
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                passed = result.returncode == 0
                all_passed = all_passed and passed
                
                self.results.add_backend_result(
                    module,
                    passed,
                    result.stdout if self.verbose else ""
                )
                
                if not passed and self.verbose:
                    print(f"STDERR: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                self.log(f"Test {module} timed out")
                self.results.add_backend_result(module, False, "Timeout")
                all_passed = False
            except Exception as e:
                self.log(f"Error running {module}: {e}")
                self.results.add_backend_result(module, False, str(e))
                all_passed = False
        
        return all_passed
    
    def run_playwright_tests(self) -> bool:
        """Run Playwright browser tests"""
        self.log("Running Playwright tests...")
        
        # Install Playwright browsers if needed
        self.log("Ensuring Playwright browsers are installed...")
        subprocess.run(['npx', 'playwright', 'install', 'chromium'], check=False)
        
        try:
            # Run Playwright tests
            result = subprocess.run(
                ['npx', 'playwright', 'test', 'test/playwright/full_game_flows.spec.ts', '--reporter=json'],
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            passed = result.returncode == 0
            
            # Parse JSON output if available
            try:
                test_results = json.loads(result.stdout)
                for test in test_results.get('tests', []):
                    self.results.add_playwright_result(
                        test['title'],
                        test['status'] == 'passed',
                        test.get('error', '')
                    )
            except:
                # If JSON parsing fails, just record overall result
                self.results.add_playwright_result(
                    'full_game_flows',
                    passed,
                    result.stdout if self.verbose else ""
                )
            
            if not passed and self.verbose:
                print(f"STDERR: {result.stderr}")
            
            return passed
            
        except subprocess.TimeoutExpired:
            self.log("Playwright tests timed out")
            self.results.add_playwright_result('full_game_flows', False, "Timeout")
            return False
        except Exception as e:
            self.log(f"Error running Playwright tests: {e}")
            self.results.add_playwright_result('full_game_flows', False, str(e))
            return False
    
    def cleanup(self):
        """Clean up all running processes and resources"""
        self.log("Cleaning up...")
        
        # Terminate all tracked processes
        for process in self.processes:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
        
        # Clean up test artifacts
        artifacts_dirs = [
            'test-results/screenshots',
            'test-results/traces',
            'test-results/videos',
            'coverage-backend',
            'coverage-frontend'
        ]
        
        for dir_path in artifacts_dirs:
            if os.path.exists(dir_path):
                # Keep the directory but clean old files
                for file in Path(dir_path).glob('*'):
                    if file.is_file() and (time.time() - file.stat().st_mtime) > 86400:  # 24 hours
                        file.unlink()
        
        self.log("Cleanup complete")
    
    def run_all_tests(self) -> bool:
        """Run all tests in sequence or parallel"""
        self.results.start_time = datetime.datetime.now()
        
        try:
            # Start services
            if not self.start_flask_backend():
                self.log("Failed to start Flask backend")
                return False
            
            if not self.start_frontend():
                self.log("Failed to start frontend")
                return False
            
            # Give services time to stabilize
            time.sleep(3)
            
            # Run tests
            if self.parallel:
                # Run backend and Playwright tests in parallel
                backend_thread = threading.Thread(target=self.run_backend_tests)
                playwright_thread = threading.Thread(target=self.run_playwright_tests)
                
                backend_thread.start()
                playwright_thread.start()
                
                backend_thread.join()
                playwright_thread.join()
            else:
                # Run tests sequentially
                backend_passed = self.run_backend_tests()
                playwright_passed = self.run_playwright_tests()
            
            self.results.end_time = datetime.datetime.now()
            
            # Generate and save reports
            report = self.results.generate_report()
            print(report)
            
            # Save reports to files
            with open('test-results/test-report.txt', 'w') as f:
                f.write(report)
            
            self.results.save_json_report('test-results/test-results.json')
            
            # Determine overall success
            total_tests = len(self.results.backend_results) + len(self.results.playwright_results)
            passed_tests = sum(1 for r in self.results.backend_results.values() if r['passed'])
            passed_tests += sum(1 for r in self.results.playwright_results.values() if r['passed'])
            
            return passed_tests == total_tests
            
        finally:
            self.cleanup()


def main():
    """Main entry point for the test runner"""
    parser = argparse.ArgumentParser(description='Run all tests for the game creation platform')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('-p', '--parallel', action='store_true', help='Run tests in parallel')
    parser.add_argument('--backend-only', action='store_true', help='Run only backend tests')
    parser.add_argument('--playwright-only', action='store_true', help='Run only Playwright tests')
    parser.add_argument('--no-cleanup', action='store_true', help='Skip cleanup after tests')
    
    args = parser.parse_args()
    
    # Create test results directory if it doesn't exist
    os.makedirs('test-results', exist_ok=True)
    os.makedirs('test-results/screenshots', exist_ok=True)
    os.makedirs('test-results/screenshots/visual', exist_ok=True)
    os.makedirs('test-results/screenshots/responsive', exist_ok=True)
    
    # Create test runner
    runner = TestRunner(verbose=args.verbose, parallel=args.parallel)
    
    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print("\nInterrupted by user")
        runner.cleanup()
        sys.exit(1)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Run tests based on arguments
    success = False
    
    try:
        if args.backend_only:
            runner.results.start_time = datetime.datetime.now()
            if runner.start_flask_backend():
                success = runner.run_backend_tests()
            runner.results.end_time = datetime.datetime.now()
        elif args.playwright_only:
            runner.results.start_time = datetime.datetime.now()
            if runner.start_flask_backend() and runner.start_frontend():
                success = runner.run_playwright_tests()
            runner.results.end_time = datetime.datetime.now()
        else:
            success = runner.run_all_tests()
    finally:
        if not args.no_cleanup:
            runner.cleanup()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()