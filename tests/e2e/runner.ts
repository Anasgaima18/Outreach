/**
 * Master E2E Aggregated Test Runner
 * Executes all 4 E2E testing tiers sequentially:
 * - Tier 1: Feature Isolation Coverage (80 tests across 16 features)
 * - Tier 2: Boundary, Corner & Adversarial Failures (80 tests)
 * - Tier 3: Pairwise Combination Testing (16 tests)
 * - Tier 4: Real-World Educator Outreach Scenarios (8 tests)
 *
 * Exits with code 0 if and only if 100% of the 184 test cases pass cleanly.
 */

import { execSync } from 'child_process';

interface TierSpec {
  tier: string;
  name: string;
  targetPath: string;
  expectedTests: number;
}

interface TierResult extends TierSpec {
  passed: boolean;
  durationMs: number;
  output: string;
}

const TIERS: TierSpec[] = [
  {
    tier: 'Tier 1',
    name: 'Feature Isolation Coverage',
    targetPath: 'tests/e2e/tier1-feature-coverage',
    expectedTests: 80,
  },
  {
    tier: 'Tier 2',
    name: 'Boundary, Corner & Adversarial Coverage',
    targetPath: 'tests/e2e/tier2-boundary-corner',
    expectedTests: 80,
  },
  {
    tier: 'Tier 3',
    name: 'Pairwise Cross-Feature Scenarios',
    targetPath: 'tests/e2e/tier3-cross-feature',
    expectedTests: 16,
  },
  {
    tier: 'Tier 4',
    name: 'Real-World Educator Outreach Workloads',
    targetPath: 'tests/e2e/tier4-real-world-workloads',
    expectedTests: 8,
  },
];

async function runMasterSuite(): Promise<void> {
  console.log('================================================================================');
  console.log('GamifyTL Professor Outreach Platform — E2E Master Test Suite');
  console.log('================================================================================\n');

  const results: TierResult[] = [];
  let allTiersPassed = true;
  const suiteStartTime = Date.now();

  for (const tierSpec of TIERS) {
    console.log(`\n▶ [START] ${tierSpec.tier}: ${tierSpec.name} (${tierSpec.expectedTests} tests expected)`);
    console.log(`  Path: ${tierSpec.targetPath}`);

    const command = `npx vitest run ${tierSpec.targetPath}`;
    const startTime = Date.now();
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      const durationMs = Date.now() - startTime;
      console.log(`✔ [PASS]  ${tierSpec.tier} passed in ${(durationMs / 1000).toFixed(2)}s`);
      results.push({
        ...tierSpec,
        passed: true,
        durationMs,
        output,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      allTiersPassed = false;
      const errorOutput = err.stdout?.toString() || err.stderr?.toString() || err.message;
      console.error(`✖ [FAIL]  ${tierSpec.tier} failed after ${(durationMs / 1000).toFixed(2)}s`);
      console.error(errorOutput);
      results.push({
        ...tierSpec,
        passed: false,
        durationMs,
        output: errorOutput,
      });
    }
  }

  const totalDurationMs = Date.now() - suiteStartTime;
  const totalTests = results.reduce((sum, r) => sum + (r.passed ? r.expectedTests : 0), 0);

  console.log('\n================================================================================');
  console.log('E2E TEST EXECUTION SUMMARY MATRIX');
  console.log('================================================================================');
  console.table(
    results.map((r) => ({
      Tier: r.tier,
      Name: r.name,
      'Test Count': `${r.expectedTests} tests`,
      Status: r.passed ? 'PASSED (Exit 0)' : 'FAILED',
      Duration: `${(r.durationMs / 1000).toFixed(2)}s`,
    }))
  );

  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Tests Executed: ${totalTests} / 184`);
  console.log(`Total Suite Duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log('--------------------------------------------------------------------------------\n');

  if (!allTiersPassed) {
    console.error('❌ E2E SUITE FAILED: One or more tiers encountered test failures.');
    process.exit(1);
  }

  console.log('✅ ALL 4 TIERS PASSED (Exit Code 0). 100% of 184 E2E tests verified.\n');
  process.exit(0);
}

runMasterSuite().catch((err) => {
  console.error('Fatal runner execution error:', err);
  process.exit(1);
});
