#!/usr/bin/env python3
"""
Critical Path Test Runner
Runs all critical path tests and generates a comprehensive report
"""

import sys
import os
import json
import time
import unittest
from io import StringIO
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

def run_test_suite(test_module_name, test_class_names=None):
    """Run tests from a module and return results"""
    try:
        module = __import__(test_module_name, fromlist=[''])
        
        if test_class_names:
            # Load specific test classes
            suite = unittest.TestSuite()
            for class_name in test_class_names:
                test_class = getattr(module, class_name)
                tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
                suite.addTests(tests)
        else:
            # Load all tests from module
            suite = unittest.TestLoader().loadTestsFromModule(module)
        
        # Run tests with custom result collector
        stream = StringIO()
        runner = unittest.TextTestRunner(stream=stream, verbosity=2)
        result = runner.run(suite)
        
        return {
            'module': test_module_name,
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100) if result.testsRun > 0 else 0,
            'output': stream.getvalue(),
            'passed': result.wasSuccessful()
        }
    except Exception as e:
        return {
            'module': test_module_name,
            'tests_run': 0,
            'failures': 0,
            'errors': 1,
            'skipped': 0,
            'success_rate': 0,
            'output': str(e),
            'passed': False
        }

def main():
    """Run all critical path tests"""
    print("=" * 70)
    print("CRITICAL PATH TEST RUNNER")
    print("=" * 70)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    results = []
    
    # Critical path test suites
    test_suites = [
        {
            'module': 'game_flow_tests',
            'classes': ['PlatformerFlowTest', 'RPGFlowTest', 'PuzzleFlowTest', 
                       'RacingFlowTest', 'SpaceFlowTest', 'DungeonFlowTest'],
            'description': 'Game Creation Flow Tests'
        },
        {
            'module': 'mock_flask_handler',
            'classes': None,
            'description': 'Mock Handler Validation'
        }
    ]
    
    # Run each test suite
    for suite_config in test_suites:
        print(f"\nRunning: {suite_config['description']}")
        print("-" * 50)
        
        result = run_test_suite(suite_config['module'], suite_config.get('classes'))
        result['description'] = suite_config['description']
        results.append(result)
        
        print(f"Tests Run: {result['tests_run']}")
        print(f"Failures: {result['failures']}")
        print(f"Errors: {result['errors']}")
        print(f"Skipped: {result['skipped']}")
        print(f"Success Rate: {result['success_rate']:.1f}%")
    
    # Calculate overall statistics
    total_tests = sum(r['tests_run'] for r in results)
    total_failures = sum(r['failures'] for r in results)
    total_errors = sum(r['errors'] for r in results)
    total_skipped = sum(r['skipped'] for r in results)
    total_passed = total_tests - total_failures - total_errors - total_skipped
    
    print("\n" + "=" * 70)
    print("OVERALL TEST RESULTS")
    print("=" * 70)
    print(f"Total Tests Run: {total_tests}")
    print(f"Passed: {total_passed}")
    print(f"Failed: {total_failures}")
    print(f"Errors: {total_errors}")
    print(f"Skipped: {total_skipped}")
    
    if total_tests > 0:
        overall_success_rate = (total_passed / (total_tests - total_skipped)) * 100 if (total_tests - total_skipped) > 0 else 0
        print(f"Overall Success Rate: {overall_success_rate:.1f}%")
    
    # Critical paths assessment
    print("\n" + "=" * 70)
    print("CRITICAL PATH COVERAGE")
    print("=" * 70)
    
    critical_paths = {
        'Game Creation': ['test_stage_title_screen', 'test_stage_gameplay_setup', 'test_stage_assets_selection', 'test_stage_ending_screen'],
        'Game Compilation': ['test_compilation'],
        'Game Export': ['test_export_game'],
        'Project Management': ['test_save_project'],
        'Complete Flow': ['test_complete_flow']
    }
    
    for path_name, test_methods in critical_paths.items():
        covered = 0
        total = 0
        for result in results:
            if 'Game Creation Flow' in result.get('description', ''):
                output = result.get('output', '')
                for method in test_methods:
                    total += output.count(f"{method} ")
                    if " ok" in output:
                        lines = output.split('\n')
                        for line in lines:
                            if method in line and " ok" in line:
                                covered += 1
        
        coverage = (covered / total * 100) if total > 0 else 0
        status = "✓ COVERED" if coverage >= 80 else "⚠ PARTIAL" if coverage > 0 else "✗ NOT COVERED"
        print(f"{path_name}: {status} ({coverage:.1f}% coverage)")
    
    # Save results to JSON
    results_data = {
        'timestamp': datetime.now().isoformat(),
        'total_tests': total_tests,
        'passed': total_passed,
        'failed': total_failures,
        'errors': total_errors,
        'skipped': total_skipped,
        'success_rate': overall_success_rate if total_tests > 0 else 0,
        'test_suites': results
    }
    
    with open('test_results.json', 'w') as f:
        json.dump(results_data, f, indent=2, default=str)
    
    print(f"\nResults saved to test_results.json")
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return overall_success_rate >= 80  # Return True if success rate is 80% or higher

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)