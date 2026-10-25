import { describe, expect, it } from 'vitest';
import { extractExpectedPlanCount, formatPgTapSummary, summarizePgTapOutput } from './pgtap-report.mjs';

describe('pgTAP assertion reporting', () => {
  it('reads the declared plan from each SQL test file', () => {
    expect(extractExpectedPlanCount('select public.plan(18);')).toBe(18);
  });

  it('compares emitted TAP plans and executed assertions with the declared plan', () => {
    const report = summarizePgTapOutput(
      ['1..2', 'ok 1 - first assertion', 'ok 2 - second assertion'].join('\n'),
      2,
    );

    expect(report).toEqual({
      expected: 2,
      planned: 2,
      executed: 2,
      failed: 0,
      consistent: true,
    });
  });

  it('flags a plan mismatch and failed assertions', () => {
    const report = summarizePgTapOutput(
      ['1..3', 'ok 1 - first assertion', 'not ok 2 - second assertion'].join('\n'),
      2,
    );

    expect(report).toEqual({
      expected: 2,
      planned: 3,
      executed: 2,
      failed: 1,
      consistent: false,
    });
  });

  it('fails when pg_prove output contains no plan or assertion lines', () => {
    expect(summarizePgTapOutput('No TAP output', 2).consistent).toBe(false);
  });

  it('formats the number of executed assertions against the declared plan', () => {
    const report = summarizePgTapOutput(
      ['1..2', 'ok 1 - first assertion', 'ok 2 - second assertion'].join('\n'),
      2,
    );

    expect(formatPgTapSummary('transit_catalog_rls.test.sql', report)).toBe(
      'pgTAP transit_catalog_rls.test.sql: executed 2 assertions; TAP plan 2; SQL plan() 2; failed 0.',
    );
  });
});
