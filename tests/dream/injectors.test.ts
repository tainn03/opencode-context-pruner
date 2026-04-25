/**
 * tests/dream/injectors.test.ts
 *
 * Test Dream Phase 3.2: Context injector
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { injectDreamContext, InjectorUtils } from '../../lib/dream/injectors/context-injector';
import type { DreamConfig } from '../../lib/dream/types';

const defaultConfig: DreamConfig = {
  enabled: true,
  triggerOn: ['compress'],
  idleTimeout: 300,
  archiveThreshold: 50,
  maxEntriesPerRun: 15,
  injectIntoContext: true,
  lspEnabled: false,
};

test('Dream Injector: Extract entries from AGENTS.md', async () => {
  const agentsContent = `## Technical Backlog

* **security**: SQL injection fixed with prepared statements ✅ *(session1)*
* **performance**: Database queries optimized ✅ *(session2)*
* **refactor**: Code cleanup complete ✅ *(session3)*
`;

  const entries = InjectorUtils.parseAgentsMarkdown(agentsContent);

  assert.equal(entries.length, 3, 'Should extract 3 entries');
  assert.equal(entries[0].category, 'security');
  assert.ok(entries[0].content.includes('SQL injection'));
  assert.equal(entries[1].category, 'performance');
  assert.equal(entries[2].category, 'refactor');
});

test('Dream Injector: Build context summary', async () => {
  const entries = [
    {
      category: 'security',
      content: 'SQL injection vulnerability patched',
    },
    {
      category: 'performance',
      content: 'Query optimization complete',
    },
    {
      category: 'architecture',
      content: 'Migrated to microservices',
    },
  ];

  const summary = InjectorUtils.buildContextSummary(entries);

  assert.ok(summary.includes('Dream Memory'), 'Should have memory header');
  assert.ok(summary.includes('Security'), 'Should include security category');
  assert.ok(summary.includes('Performance'), 'Should include performance category');
  assert.ok(summary.includes('Architecture'), 'Should include architecture category');
  assert.ok(summary.includes('SQL injection'), 'Should include specific content');
});

test('Dream Injector: Format for system prompt', async () => {
  const summary = '[Dream Memory: Test]';
  const formatted = InjectorUtils.formatContextForSystemPrompt(summary);

  assert.ok(formatted.includes('---'), 'Should have separators');
  assert.ok(formatted.includes('[Dream Memory'), 'Should include summary');
  assert.ok(formatted.includes('avoid repeating'), 'Should include guidance');
});

test('Dream Injector: Skip injection if disabled', async () => {
  const config = { ...defaultConfig, injectIntoContext: false };
  const agentsContent = '* **test**: entry';

  const mockContext = { projectRoot: '/tmp', sessionId: 'test' };
  const result = await injectDreamContext(agentsContent, mockContext as any, config);

  assert.equal(result, '', 'Should return empty string if injection disabled');
});

test('Dream Injector: Return empty for missing content', async () => {
  const mockContext = { projectRoot: '/tmp', sessionId: 'test' };
  const result = await injectDreamContext('', mockContext as any, defaultConfig);

  assert.equal(result, '', 'Should return empty for empty content');
});

test('Dream Injector: Limit to latest entries', async () => {
  const agentsContent = `## Technical Backlog

* **bug**: Bug 1 *(s1)*
* **bug**: Bug 2 *(s2)*
* **bug**: Bug 3 *(s3)*
* **security**: Security issue *(s1)*
* **performance**: Perf fix *(s2)*
`;

  const mockContext = { projectRoot: '/tmp', sessionId: 'test' };
  const result = await injectDreamContext(agentsContent, mockContext as any, defaultConfig);

  // Should include entries from summary
  assert.ok(result.includes('Dream Memory'), 'Should have header');
  assert.ok(result.includes('Bug'), 'Should include bug category');
  assert.ok(result.length > 10, 'Should have substantial content');
});

test('Dream Injector: Estimate tokens', async () => {
  const entries = [
    { category: 'security', content: 'SQL injection fixed' },
    { category: 'performance', content: 'Query optimization' },
    { category: 'bug', content: 'Timeout issue resolved' },
  ];

  const summary = InjectorUtils.buildContextSummary(entries);

  // Should be roughly < 150 tokens for 3 entries
  const estimatedTokens = Math.round(summary.length / 4);
  assert.ok(estimatedTokens < 200, `Should stay under 200 tokens, got ${estimatedTokens}`);
});
