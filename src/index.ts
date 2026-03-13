#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { logInfo } from './logger.js';
import { createMcpServer } from './server.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  const safeRpcUrl = config.solanaRpcUrl.split('?')[0];
  logInfo('mcp_server_started', {
    mode: config.mode,
    apiUrl: config.apiUrl,
    solanaRpcUrl: safeRpcUrl,
    maxSwapSol: config.maxSwapSol,
    requireConfirm: config.requireConfirm,
  });
};

main().catch((error) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'fatal_startup_error',
      ts: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
});
