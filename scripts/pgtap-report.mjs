export function extractExpectedPlanCount(sql) {
  const plans = [...sql.matchAll(/\bselect\s+(?:public\.)?plan\s*\(\s*(\d+)\s*\)\s*;/gi)];

  if (plans.length !== 1) {
    throw new Error(`Expected exactly one pgTAP plan() declaration; found ${plans.length}.`);
  }

  return Number(plans[0][1]);
}

export function summarizePgTapOutput(output, expected) {
  const plans = [...output.matchAll(/^\s*1\.\.(\d+)\s*$/gim)].map((match) => Number(match[1]));
  const assertions = [...output.matchAll(/^\s*(not\s+)?ok\s+(\d+)\b/gim)];
  const failed = assertions.filter((match) => match[1]).length;
  const assertionNumbersAreSequential = assertions.every((match, index) => Number(match[2]) === index + 1);
  const planned = plans.reduce((total, count) => total + count, 0);
  const executed = assertions.length;

  return {
    expected,
    planned,
    executed,
    failed,
    consistent: plans.length === 1
      && planned === expected
      && executed === expected
      && failed === 0
      && assertionNumbersAreSequential,
  };
}

export function formatPgTapSummary(fileName, report) {
  return `pgTAP ${fileName}: executed ${report.executed} assertions; TAP plan ${report.planned}; SQL plan() ${report.expected}; failed ${report.failed}.`;
}
