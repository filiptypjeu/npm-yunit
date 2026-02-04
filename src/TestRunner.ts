import { YTestSuite, isPerfReporter, ConsoleReporter } from ".";
import TestSuiteLoader from "xunit.ts/dist/src/Runners/TestSuiteLoader";
import TestRunner from "xunit.ts/dist/src/Runners/TestRunner";
import TestSuite from "xunit.ts/dist/src/Framework/TestSuite";
import TestSuiteRunner from "xunit.ts/dist/src/Runners/TestSuiteRunner";
import TestInfo from "xunit.ts/dist/src/Framework/TestInfo";
import TestResult from "xunit.ts/dist/src/Framework/TestResult";
import { ResultType } from "xunit.ts/dist/src/Framework/ResultType";
import Runner from "xunit.ts/dist/src/Runners/Runner";
import FileSystem from "xunit.ts/dist/src/IO/FileSystem";
import * as fs from "fs/promises";
import ResultReporter from "xunit.ts/dist/src/Reporters/ResultReporter";
import Args from "command-line-args";
import path from "path";
import { AssertionError } from "assert";

const isTestSuitePrototype = (proto: unknown): proto is TestSuite => {
  // XXX: Why not just proto instanceof TestSuite?
  return !!proto && typeof proto === "object" && "getTests" in proto && typeof proto.getTests === "function";
};

class YTestSuiteLoader extends TestSuiteLoader {
  constructor(protected readonly m_file_system: FileSystem) {
    super(m_file_system);
  }

  // Identfying valid test suites when loading is not always handled correctly in xunit.ts
  async loadTestSuite(module_path: string, filters: RegExp[]): Promise<TestSuite | null> {
    const test_class = await import(module_path);

    const proto = test_class.default?.prototype;
    if (!isTestSuitePrototype(proto)) return null;

    const tests = proto.getTests(filters);
    if (!tests || Object.keys(tests).length === 0) return null;

    const suite: TestSuite = new test_class.default();
    suite.setTests(tests);
    return suite;
  }

  override async loadTestSuites(dir: string, filters: RegExp[]): Promise<Record<string, TestSuite>> {
    const suites: Record<string, TestSuite> = {};

    const files = (await this.m_file_system.getFiles(dir)).filter(f => f.endsWith(".js"));

    for (const file of files) {
      const suite = await this.loadTestSuite(file, filters);
      if (suite) suites[file] = suite;
    }
    return suites;
  }
}

class YTestSuiteRunner extends TestSuiteRunner {
  constructor(
    runner: YTestRunner,
    public readonly rs: ResultReporter[],
  ) {
    super(runner, rs);
  }

  // Make sure the test suite has access to all performance test reporters (test suites does not normally have access to the reporters)
  override async runSuite(suite: YTestSuite, filters: RegExp[]) {
    suite.reporters = [];
    this.rs.forEach(r => isPerfReporter(r) && suite.reporters.push(r));

    return super.runSuite(suite, filters);
  }
}

export class YTestRunner extends TestRunner {
  public override async runTest(name: string, info: TestInfo, suite: YTestSuite): Promise<TestResult> {
    await Promise.all(suite.reporters.map(r => r.testStarted(suite, name)));

    const result = info.value ? await this.run(suite, info.value) : new TestResult(ResultType.Incomplete, 0);

    switch (result.type) {
      case ResultType.Incomplete:
        await Promise.all(suite.reporters.map(r => r.testIncomplete(suite, name)));
        break;

      case ResultType.Passed:
        await Promise.all(suite.reporters.map(r => r.testPassed(suite, name, result.duration)));
        break;

      case ResultType.Failed:
        await Promise.all(suite.reporters.map(r => r.testFailed(suite, name, result.error as AssertionError, result.duration)));
        break;

      case ResultType.Error:
        await Promise.all(suite.reporters.map(r => r.testErrored(suite, name, result.error as Error, result.duration)));
        break;
    }

    return result;
  }

  protected async run(suite: YTestSuite, fn: () => Promise<void>): Promise<TestResult> {
    try {
      await suite.runBeforeEachTest();
    } catch (e) {
      return new TestResult(ResultType.Error, 0, e as Error);
    }

    let result: TestResult;
    const start = process.hrtime();
    try {
      await fn.call(suite);
      const duration = YTestSuite.msSince(start);
      result = new TestResult(ResultType.Passed, duration);
    } catch (e) {
      const duration = YTestSuite.msSince(start);
      if (e instanceof AssertionError) {
        result = new TestResult(ResultType.Failed, duration, e);
      } else {
        result = new TestResult(ResultType.Error, duration, e as Error);
      }
    }

    try {
      await suite.runAfterEachTest(result);
    } catch (e) {
      if (result.type === ResultType.Passed) result = new TestResult(ResultType.Error, result.duration, e as Error);
    }

    return result;
  }
}

/**
 * Function that sets up xunit.ts and runs all tests. Using the provided CLI for this does not allow for using custom reporters.
 *
 * @param path The relative path after transpilation, from the file where this function is called, to a directory to search for files with test suites.
 */
export const run = async (relative_path: string, name: string): Promise<void> => {
  const caller_file = getCallerFile("run") || ".";
  const absolute_path = path.resolve(caller_file, "..", relative_path);

  const args = Args([
    {
      name: "filter",
      alias: "f",
      type: String,
      multiple: true,
    },
  ]);
  let filters: string[] = args["filter"] || [];
  filters = filters.flatMap(f => f.split(",")).map(f => f.trim());

  // Using our own custom test suite loader
  const test_suite_loader = new YTestSuiteLoader(new FileSystem(fs));

  // Using our own custom reporter
  const reporters = [new ConsoleReporter({ path: absolute_path, name, filters })];
  const test_runner = new YTestRunner(reporters);
  // Using our own custom test suite runner
  const test_suite_runner = new YTestSuiteRunner(test_runner, reporters);

  const runner = new Runner(test_suite_loader, test_suite_runner, reporters);

  try {
    await runner.runAll(
      absolute_path,
      filters.map(f => new RegExp(f)),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`An unhandled ${error.name} occurred: ${error.message}`);
      console.error(error.stack || "(no call stack)");
    } else {
      console.error(error);
    }
  }
};

const getCallerFile = (function_name: string): string | null | undefined => {
  const prepareStackTraceOrg = Error.prepareStackTrace;
  const err = new Error();
  let name: string | null | undefined;

  Error.prepareStackTrace = (_, stack) => stack;

  const stack = err.stack as unknown as NodeJS.CallSite[];

  let found = false;
  for (const cs of stack) {
    if (found) {
      name = cs.getFileName();
      break;
    }
    if (cs.getFunctionName() === function_name) found = true;
  }

  Error.prepareStackTrace = prepareStackTraceOrg;

  return name;
};
