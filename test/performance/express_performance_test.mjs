/**
 * Express Backend Performance Test Suite
 * Comprehensive performance testing for the Express/Node.js backend
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:5000/api';
const CONCURRENT_USERS = [5, 10, 20];
const TEST_DURATION = 10000; // 10 seconds

class PerformanceTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      concurrentUserTests: [],
      endpointBenchmarks: [],
      resourceUsage: [],
      errors: []
    };
  }

  /**
   * Generate test project data
   */
  generateTestProject(size = 'medium') {
    const components = [];
    const componentCounts = {
      small: 5,
      medium: 20,
      large: 50
    };
    
    const count = componentCounts[size] || 20;
    
    for (let i = 0; i < count; i++) {
      components.push({
        id: `component_${i}`,
        type: i % 3 === 0 ? 'sprite' : i % 3 === 1 ? 'background' : 'object',
        x: Math.random() * 800,
        y: Math.random() * 600,
        width: 32 + Math.random() * 64,
        height: 32 + Math.random() * 64,
        properties: {
          speed: Math.random() * 10,
          health: Math.floor(Math.random() * 100),
          damage: Math.floor(Math.random() * 20)
        }
      });
    }

    return {
      name: `Performance Test Project ${Date.now()}`,
      template: 'platformer',
      description: `Test project with ${count} components`,
      files: [
        {
          path: 'main.py',
          content: this.generateTestCode(size)
        }
      ],
      assets: components
    };
  }

  /**
   * Generate test Python code
   */
  generateTestCode(complexity = 'medium') {
    const loops = complexity === 'simple' ? 10 : complexity === 'complex' ? 100 : 50;
    
    return `
import time
import random

def main():
    # Performance test code
    data = []
    for i in range(${loops}):
        data.append({
            'id': i,
            'value': random.random(),
            'timestamp': time.time()
        })
    
    # Simulate game logic
    for _ in range(100):
        x = random.randint(0, 800)
        y = random.randint(0, 600)
        # Simulate physics calculations
        velocity = (random.random() * 10, random.random() * 10)
        
    return data

if __name__ == "__main__":
    result = main()
    print(f"Processed {len(result)} items")
`;
  }

  /**
   * Test concurrent user sessions
   */
  async testConcurrentUsers(numUsers) {
    console.log(`\nTesting with ${numUsers} concurrent users...`);
    
    const testResult = {
      numUsers,
      startTime: Date.now(),
      userResults: [],
      statistics: {}
    };

    const promises = [];
    for (let i = 0; i < numUsers; i++) {
      promises.push(this.simulateUser(i));
    }

    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        testResult.userResults.push(result.value);
      } else {
        testResult.userResults.push({
          userId: index,
          error: result.reason.message
        });
      }
    });

    testResult.endTime = Date.now();
    testResult.totalTime = testResult.endTime - testResult.startTime;
    testResult.statistics = this.calculateStatistics(testResult.userResults);
    
    return testResult;
  }

  /**
   * Simulate a single user session
   */
  async simulateUser(userId) {
    const result = {
      userId,
      startTime: Date.now(),
      operations: [],
      errors: []
    };

    try {
      // 1. Create project
      const createStart = performance.now();
      const projectData = this.generateTestProject('medium');
      const createResponse = await axios.post(`${API_BASE_URL}/projects`, projectData);
      const createTime = performance.now() - createStart;
      
      result.operations.push({
        operation: 'create_project',
        time: createTime,
        success: createResponse.status === 201
      });

      if (createResponse.data && createResponse.data.id) {
        const projectId = createResponse.data.id;

        // 2. Get project
        const getStart = performance.now();
        const getResponse = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
        const getTime = performance.now() - getStart;
        
        result.operations.push({
          operation: 'get_project',
          time: getTime,
          success: getResponse.status === 200
        });

        // 3. Update project
        const updateStart = performance.now();
        const updateData = {
          name: `Updated ${projectData.name}`,
          description: 'Updated description'
        };
        const updateResponse = await axios.put(`${API_BASE_URL}/projects/${projectId}`, updateData);
        const updateTime = performance.now() - updateStart;
        
        result.operations.push({
          operation: 'update_project',
          time: updateTime,
          success: updateResponse.status === 200
        });

        // 4. Execute code
        const execStart = performance.now();
        const execResponse = await axios.post(`${API_BASE_URL}/execute`, {
          code: this.generateTestCode('medium')
        });
        const execTime = performance.now() - execStart;
        
        result.operations.push({
          operation: 'execute_code',
          time: execTime,
          success: execResponse.status === 200
        });

        // 5. Publish project
        const publishStart = performance.now();
        const publishResponse = await axios.post(`${API_BASE_URL}/projects/${projectId}/publish`);
        const publishTime = performance.now() - publishStart;
        
        result.operations.push({
          operation: 'publish_project',
          time: publishTime,
          success: publishResponse.status === 200
        });

        // 6. List gallery
        const galleryStart = performance.now();
        const galleryResponse = await axios.get(`${API_BASE_URL}/gallery`);
        const galleryTime = performance.now() - galleryStart;
        
        result.operations.push({
          operation: 'list_gallery',
          time: galleryTime,
          success: galleryResponse.status === 200
        });

        // 7. Delete project (cleanup)
        const deleteStart = performance.now();
        const deleteResponse = await axios.delete(`${API_BASE_URL}/projects/${projectId}`);
        const deleteTime = performance.now() - deleteStart;
        
        result.operations.push({
          operation: 'delete_project',
          time: deleteTime,
          success: deleteResponse.status === 204
        });
      }
    } catch (error) {
      result.errors.push({
        message: error.message,
        response: error.response?.data
      });
    }

    result.endTime = Date.now();
    result.totalTime = result.endTime - result.startTime;
    result.success = result.errors.length === 0;
    
    return result;
  }

  /**
   * Benchmark individual endpoints
   */
  async benchmarkEndpoints() {
    console.log('\nBenchmarking individual endpoints...');
    
    const endpoints = [
      {
        name: 'list_projects',
        method: 'GET',
        url: '/projects',
        data: null
      },
      {
        name: 'create_project',
        method: 'POST',
        url: '/projects',
        data: () => this.generateTestProject('small')
      },
      {
        name: 'execute_code',
        method: 'POST',
        url: '/execute',
        data: { code: this.generateTestCode('simple') }
      },
      {
        name: 'list_gallery',
        method: 'GET',
        url: '/gallery',
        data: null
      },
      {
        name: 'list_lessons',
        method: 'GET',
        url: '/lessons',
        data: null
      }
    ];

    const benchmarks = [];

    for (const endpoint of endpoints) {
      console.log(`  Testing ${endpoint.name}...`);
      
      const times = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        try {
          const start = performance.now();
          const data = typeof endpoint.data === 'function' ? endpoint.data() : endpoint.data;
          
          let response;
          if (endpoint.method === 'GET') {
            response = await axios.get(`${API_BASE_URL}${endpoint.url}`);
          } else if (endpoint.method === 'POST') {
            response = await axios.post(`${API_BASE_URL}${endpoint.url}`, data);
          }
          
          const time = performance.now() - start;
          times.push(time);
          
          // Clean up created resources if needed
          if (endpoint.name === 'create_project' && response.data?.id) {
            await axios.delete(`${API_BASE_URL}/projects/${response.data.id}`);
          }
        } catch (error) {
          console.log(`    Error: ${error.message}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (times.length > 0) {
        benchmarks.push({
          endpoint: endpoint.name,
          method: endpoint.method,
          iterations,
          times,
          statistics: {
            mean: times.reduce((a, b) => a + b) / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            p95: this.percentile(times, 95)
          }
        });
      }
    }

    return benchmarks;
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting() {
    console.log('\nTesting rate limiting...');
    
    const result = {
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsRateLimited: 0,
      times: []
    };

    // Send rapid requests
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        axios.post(`${API_BASE_URL}/execute`, { code: 'print("test")' })
          .then(() => ({ success: true }))
          .catch((error) => ({ 
            success: false, 
            status: error.response?.status 
          }))
      );
    }

    const results = await Promise.all(promises);
    
    results.forEach(r => {
      result.requestsSent++;
      if (r.success) {
        result.requestsSuccessful++;
      } else if (r.status === 429) {
        result.requestsRateLimited++;
      }
    });

    result.rateLimitingEnabled = result.requestsRateLimited > 0;
    
    return result;
  }

  /**
   * Calculate statistics from user results
   */
  calculateStatistics(userResults) {
    const stats = {
      totalUsers: userResults.length,
      successfulUsers: 0,
      failedUsers: 0,
      operationTimes: {},
      avgTotalTime: 0
    };

    const totalTimes = [];
    const operationData = {};

    userResults.forEach(result => {
      if (result.success) {
        stats.successfulUsers++;
      } else {
        stats.failedUsers++;
      }

      if (result.totalTime) {
        totalTimes.push(result.totalTime);
      }

      if (result.operations) {
        result.operations.forEach(op => {
          if (!operationData[op.operation]) {
            operationData[op.operation] = [];
          }
          operationData[op.operation].push(op.time);
        });
      }
    });

    // Calculate averages
    if (totalTimes.length > 0) {
      stats.avgTotalTime = totalTimes.reduce((a, b) => a + b) / totalTimes.length;
    }

    // Calculate operation statistics
    for (const [operation, times] of Object.entries(operationData)) {
      if (times.length > 0) {
        stats.operationTimes[operation] = {
          mean: times.reduce((a, b) => a + b) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: this.percentile(times, 95)
        };
      }
    }

    stats.successRate = (stats.successfulUsers / stats.totalUsers) * 100;
    
    return stats;
  }

  /**
   * Calculate percentile
   */
  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    console.log('='.repeat(60));
    console.log('EXPRESS BACKEND PERFORMANCE TEST SUITE');
    console.log('='.repeat(60));

    // Test concurrent users
    for (const numUsers of CONCURRENT_USERS) {
      const result = await this.testConcurrentUsers(numUsers);
      this.results.concurrentUserTests.push(result);
      
      console.log(`\nResults for ${numUsers} concurrent users:`);
      console.log(`  Success rate: ${result.statistics.successRate.toFixed(1)}%`);
      console.log(`  Avg total time: ${result.statistics.avgTotalTime.toFixed(0)}ms`);
      
      // Cool down between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Benchmark individual endpoints
    this.results.endpointBenchmarks = await this.benchmarkEndpoints();

    // Test rate limiting
    this.results.rateLimiting = await this.testRateLimiting();
    console.log(`\nRate limiting: ${this.results.rateLimiting.rateLimitingEnabled ? 'Enabled' : 'Not detected'}`);

    // Save results
    this.saveResults();
    
    return this.results;
  }

  /**
   * Save results to file
   */
  saveResults() {
    const outputPath = path.join(__dirname, 'express_performance_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to ${outputPath}`);
  }
}

// Run tests
async function main() {
  const tester = new PerformanceTester();
  
  try {
    await tester.runAllTests();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));
    
    // Concurrent users summary
    console.log('\n📊 Concurrent User Tests:');
    tester.results.concurrentUserTests.forEach(test => {
      console.log(`  ${test.numUsers} users: ${test.statistics.successRate.toFixed(1)}% success, ${test.totalTime}ms total`);
    });
    
    // Endpoint benchmarks summary
    console.log('\n⚡ Endpoint Performance (P95):');
    tester.results.endpointBenchmarks.forEach(benchmark => {
      const status = benchmark.statistics.p95 < 500 ? '✓' : '⚠️';
      console.log(`  ${status} ${benchmark.endpoint}: ${benchmark.statistics.p95.toFixed(1)}ms`);
    });
    
    // Check for issues
    const issues = [];
    tester.results.concurrentUserTests.forEach(test => {
      if (test.statistics.successRate < 80) {
        issues.push(`Low success rate at ${test.numUsers} users`);
      }
    });
    
    tester.results.endpointBenchmarks.forEach(benchmark => {
      if (benchmark.statistics.p95 > 1000) {
        issues.push(`Slow response for ${benchmark.endpoint}`);
      }
    });
    
    if (issues.length > 0) {
      console.log('\n⚠️ Issues detected:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ All performance tests passed!');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main();