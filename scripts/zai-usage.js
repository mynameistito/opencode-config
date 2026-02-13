#!/usr/bin/env node

/**
 * Z.AI Usage Query Script
 * Fetches and displays Z.AI API quota and usage statistics
 * Requires OC_ZAI_API_KEY environment variable
 */

const https = require('https');

const API_KEY = process.env.OC_ZAI_API_KEY;

if (!API_KEY) {
  console.error('Error: OC_ZAI_API_KEY environment variable is not set');
  console.error('Please set your Z.AI API key: export OC_ZAI_API_KEY="your-key"');
  process.exit(1);
}

// Calculate time window (last 24 hours)
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const formatDate = (d) => d.toISOString().replace('T', ' ').substring(0, 19);
const startTime = formatDate(yesterday);
const endTime = formatDate(now);

// Helper function to make HTTPS requests
const fetchData = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.z.ai',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept-Language': 'en-US,en',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
};

// Main execution
(async () => {
  try {
    const encodedStart = encodeURIComponent(startTime);
    const encodedEnd = encodeURIComponent(endTime);

    // Fetch all data in parallel
    const [quotaData, modelData, toolData] = await Promise.all([
      fetchData('/api/monitor/usage/quota/limit'),
      fetchData(`/api/monitor/usage/model-usage?startTime=${encodedStart}&endTime=${encodedEnd}`),
      fetchData(`/api/monitor/usage/tool-usage?startTime=${encodedStart}&endTime=${encodedEnd}`)
    ]);

    // Format and display output
    console.log('=== Z.AI Usage Statistics ===\n');

    // Quota Limits
    console.log('Quota Limits:');
    if (quotaData.data && quotaData.data.limits) {
      quotaData.data.limits.forEach(limit => {
        if (limit.type === 'TOKENS_LIMIT') {
          console.log(`  - Token Usage (5h): ${limit.percentage || 0}%`);
        } else if (limit.type === 'TIME_LIMIT') {
          console.log(`  - MCP Usage (Monthly): ${limit.percentage || 0}%`);
        }
      });
    }
    console.log('');

    // Model Usage
    console.log('Model Usage (Last 24h):');
    if (modelData.data && modelData.data.totalUsage) {
      const tokens = modelData.data.totalUsage.totalTokensUsage || 0;
      console.log(`  - Total Tokens: ${tokens.toLocaleString()}`);
    } else {
      console.log('  - Total Tokens: 0');
    }
    console.log('');

    // Tool Usage
    console.log('Tool Usage (Last 24h):');
    if (toolData.data && toolData.data.totalUsage) {
      const search = toolData.data.totalUsage.totalNetworkSearchCount || 0;
      const reader = toolData.data.totalUsage.totalWebReadMcpCount || 0;
      console.log(`  - Web Search: ${search}, Web Reader: ${reader}`);
    } else {
      console.log('  - Web Search: 0, Web Reader: 0');
    }

    console.log('\n===========================');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
