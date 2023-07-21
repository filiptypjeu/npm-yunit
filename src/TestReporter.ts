import { TestSuite } from "xunit.ts";
import ResultReporter from "xunit.ts/dist/src/Reporters/ResultReporter";
import TestSuiteResults from "xunit.ts/dist/src/Framework/TestSuiteResults";
import { ResultType } from "xunit.ts/dist/src/Framework/ResultType";
import { AssertionError } from "assert";
import path from "path";
import "colors";

const sum = (a: number[]) => a.reduce((acc, current) => acc + current, 0);
const ns = (ns: number) => (ns > 1e4 ? us(ns / 1e3) : `${Math.round(ns)} ns`);
const us = (us: number) => (us > 1e4 ? ms(us / 1e3) : `${Math.round(us)} us`);
const ms = (ms: number) => `${Math.round(ms)} ms`;
const MOps = (ops: number) => `${Math.round(ops / 1000) / 1000} MOp/s`;
const p = (singular: "test" | "suite", n: number) => {
  if (n === 1) return singular;
  return singular + "s";
};

export interface PerformanceTestOptions {
  comment?: string;
  operations: number;
  warmups: number;
}

export interface PerformanceTestResult extends PerformanceTestOptions {
  // The number of operations measured
  N: number;
  // Total amount of time for N operations in nanoseconds
  total: number;
  // Average time per operation in nanoseconds
  average: number;
  // Operations per second
  perSecond: number;
}

interface PerformanceTestResultInternal extends PerformanceTestResult {
  suite: string;
  test: string;
}

export interface PerformanceResultReporter extends ResultReporter {
  performanceTestStarted(options: PerformanceTestOptions): void;
  performanceTestErrored(onOperation: number): void;
  performanceTestEnded(result: PerformanceTestResult): void;
}

export const isPerfReporter = (r: ResultReporter): r is PerformanceResultReporter =>
  ["performanceTestStarted", "performanceTestErrored", "performanceTestEnded"].reduce<boolean>((res, s) => res && s in r, true);

export class ConsoleReporter implements PerformanceResultReporter {
  protected m_failedTests: string[] = [];
  protected m_indent = 0;
  protected m_suiteName = "";
  protected m_testName = "";
  protected m_results: PerformanceTestResultInternal[] = [];
  protected readonly name: string;
  protected readonly path: string;
  protected readonly filters: string[];

  constructor(o: { name: string; path?: string; filters?: string[] }) {
    this.path = o.path || "";
    this.name = o.name;
    this.filters = o?.filters || [];
  }

  protected i = (str: string) => "    ".repeat(this.m_indent).concat(str.toString());
  protected ii = () => this.m_indent++;
  protected id = () => {
    this.m_indent--;
    if (this.m_indent < 0) throw new Error("Unexpected indent");
  };

  protected out = (output?: string, ...rest: string[]) => (output ? console.log(this.i(output), ...rest) : console.log());

  protected green = (g: string, ...white: string[]) => this.out(g.green, ...white);
  protected red = (r: string, ...white: string[]) => this.out(r.red, ...white);
  protected yellow = (r: string, ...white: string[]) => this.out(r.yellow, ...white);

  protected dash = (...output: string[]) => this.green("[----------]", ...output);
  protected ddash = (...output: string[]) => this.green("[==========]", ...output);
  protected passed = (n: number) => this.green("[  PASSED  ]", `${n} ${p("test", n)}.`);
  protected failed = (...output: string[]) => this.red("[  FAILED  ]", ...output);
  protected unknown = (...output: string[]) => this.red("[  ??????  ]", ...output);

  protected testStart = (testName: string) => this.green("[ RUN      ]", testName);
  protected testOk = (testName: string, duration: number) => this.green("[       OK ]", testName, `(${ms(duration)})`);
  protected testFail = (testName: string, duration: number) => this.failed(testName, `(${ms(duration)})`);

  protected ptestStart = () => this.yellow("[ MEASURE  ]");
  protected ptestOk = () => this.yellow("[     DONE ]");
  protected ptestFail = () => this.failed();

  runStarted(): void {
    this.m_failedTests = [];
    this.ddash(`Running ${this.name}`);
    this.dash(`Path: ${this.path ? path.resolve(this.path) : ""}`);
    this.dash(`Filters: [${this.filters.map(f => JSON.stringify(f)).join(", ")}]`);
    this.dash("Global test environment set-up.");
  }

  suiteStarted(suite: TestSuite): void {
    this.out();
    const n = Object.keys(suite.getTests([])).length;
    this.dash(`${n} ${p("test", n)} from ${suite.constructor.name}`);
  }

  testStarted(suite: TestSuite, test_name: string): void {
    this.m_suiteName = suite.constructor.name;
    this.m_testName = test_name;
    this.testStart(`${this.m_suiteName}.${this.m_testName}`);
    this.ii();
  }

  testPassed(suite: TestSuite, test_name: string, duration: number): void {
    this.id();
    this.testOk(`${suite.constructor.name}.${test_name}`, duration);
  }

  testFailed(suite: TestSuite, test_name: string, error: AssertionError, duration: number): void {
    this.testErrored(suite, test_name, error, duration);
  }

  testIncomplete(suite: TestSuite, test_name: string): void {
    this.testErrored(suite, test_name);
  }

  testErrored(suite: TestSuite, test_name: string, error?: Error, duration?: number): void {
    const name = `${suite.constructor.name}.${test_name}`;
    this.m_failedTests.push(name);

    if (error) this.out(error.stack || error.message);
    if (error instanceof AssertionError) {
      this.out("Expected:", String(error.expected).green);
      this.out("  Actual:", String(error.actual).red);
    }

    this.id();
    this.testFail(name, duration || 0);
  }

  suiteCompleted(suite: TestSuite, results: TestSuiteResults): void {
    const total = results.total();
    // XXX: This is the sum of the individual tests, not the total amount for the whole suite
    const time = results.time();
    this.dash(`${total} ${p("test", total)} from ${suite.constructor.name} (${ms(time)} total)`);
  }

  runCompleted(suites: Record<string, TestSuiteResults>): void {
    const results = Object.values(suites);

    const nSuites = results.length;
    const nTotal = sum(results.map(sr => sr.total()));
    const nPassed = sum(results.map(sr => sr.count(ResultType.Passed)));
    const nFailed = this.m_failedTests.length;
    const tTotal = sum(results.flatMap(sr => Object.values(sr.results)).map(r => r.duration));

    this.out();
    this.dash(`Global test environment tear-down`);
    this.ddash(`${nTotal} ${p("test", nTotal)} from ${nSuites} test ${p("suite", nSuites)} ran. (${ms(tTotal)} total)`);
    this.passed(nPassed);

    if (nFailed > 0) {
      this.failed(`${nFailed} ${p("test", nFailed)}, listed below:`);
      this.m_failedTests.forEach(name => this.failed(name));
    }
    this.out();

    if (!this.m_results.length) return;

    const setup: { header: string; parser: (result: PerformanceTestResultInternal) => string }[] = [
      {
        header: "Suite",
        parser: r => r.suite,
      },
      {
        header: "Test",
        parser: r => r.test,
      },
      {
        header: "Comment",
        parser: r => r.comment || "",
      },
      {
        header: "N",
        parser: r => r.N.toString(),
      },
      {
        header: "Total",
        parser: r => ns(r.total),
      },
      {
        header: "Mean",
        parser: r => ns(r.average),
      },
      {
        header: "MOp/s",
        parser: r => MOps(r.perSecond).split(" ")[0] || "?",
      },
    ];
    const columns = setup.map(c => {
      const rows = this.m_results.map(r => c.parser(r));
      return {
        header: c.header,
        rows,
        width: rows.concat(c.header).reduce((max, s) => Math.max(max, s.length), 0),
      };
    });
    this.out("| " + columns.map(c => c.header.padStart(c.width)).join(" | ") + " |");
    this.out("|-" + columns.map(c => "-".repeat(c.width)).join("-|-") + "-|");
    for (let i = 0; i < this.m_results.length; i++) {
      this.out("| " + columns.map(c => c.rows[i]!.padStart(c.width)).join(" | ") + " |");
    }
    this.out();
  }

  performanceTestStarted(o: PerformanceTestOptions): void {
    this.ptestStart();
    this.ii();
    if (o.comment) this.out("   Comment:", `${o.comment}`.green);
    this.out("Operations:", `${o.operations}`.green);
    this.out("   Warmups:", `${o.warmups}`.green);
  }

  performanceTestErrored(onOperation: number): void {
    this.out(`Failed on operation ${onOperation}`.red);
    this.id();
    this.ptestFail();
  }

  performanceTestEnded(result: PerformanceTestResult): void {
    this.m_results.push({
      suite: this.m_suiteName,
      test: this.m_testName,
      ...result,
    });
    this.out("         N:", `${result.N}`.green);
    this.out("Total time:", ns(result.total).green);
    this.out("   Average:", ns(result.average).green);
    this.out("      Rate:", MOps(result.perSecond).green);
    this.id();
    this.ptestOk();
  }
}
