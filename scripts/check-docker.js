#!/usr/bin/env node
/**
 * Check Docker containers status
 */
const { execSync } = require('child_process');

try {
  console.log('=== Docker Containers Status ===\n');
  
  const output = execSync('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', {
    encoding: 'utf-8'
  });
  
  console.log(output);
  
  // Check specific containers
  const containers = ['visual-cms-frontend-1', 'visual-cms-backend-1', 'visual-cms-db-1'];
  
  for (const container of containers) {
    try {
      const status = execSync(`docker inspect -f "{{.State.Status}}" ${container}`, {
        encoding: 'utf-8'
      }).trim();
      
      console.log(`${container}: ${status}`);
    } catch (e) {
      console.log(`${container}: NOT FOUND`);
    }
  }
  
  console.log('\n=== Frontend Logs (last 10 lines) ===\n');
  try {
    const frontendLogs = execSync('docker logs visual-cms-frontend-1 --tail 10 2>&1', {
      encoding: 'utf-8'
    });
    console.log(frontendLogs);
  } catch (e) {
    console.log('Could not get frontend logs');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}
