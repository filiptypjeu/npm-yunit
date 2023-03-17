import { YTestSuite, isPerfReporter, ConsoleReporter } from ".";
import TestSuiteLoader from "xunit.ts/dist/src/Runners/TestSuiteLoader";
import TestRunner from "xunit.ts/dist/src/Runners/TestRunner";
import TestSuiteRunner from "xunit.ts/dist/src/Runners/TestSuiteRunner";
import Runner from "xunit.ts/dist/src/Runners/Runner";
import FileSystem from "xunit.ts/dist/src/IO/FileSystem";
import * as fs from "fs/promises";
import ResultReporter from "xunit.ts/dist/src/Reporters/ResultReporter";
import Args from "command-line-args";

export class YTestSuiteRunner extends TestSuiteRunner {
  constructor(runner: TestRunner, public readonly rs: ResultReporter[]) {
    super(runner, rs);
  }

  // Make sure the test suite has access to all performance test reporters (test suites does not normally have access to the reporters)
  override async runSuite(suite: YTestSuite, filters: RegExp[]) {
    suite.reporters = [];
    this.rs.forEach(r => isPerfReporter(r) && suite.reporters.push(r));

    return super.runSuite(suite, filters);
  }
}

/**
 * Function that sets up xunit.ts and runs all tests. Using the provided CLI for this does not allow for using custom reporters.
 */
export const run = async (path: string, name: string): Promise<void> => {
  const args = Args([
    {
      name: "filter",
      alias: "f",
      type: String,
      multiple: true,
    },
  ]);
  // eslint-disable-next-line
  let filters: string[] = args["filter"] || [];
  filters = filters.flatMap(f => f.split(",")).map(f => f.trim());

  const loader = new TestSuiteLoader(new FileSystem(fs));
  // Using our own custom reporter
  const reporters = [new ConsoleReporter(name, filters)];
  const test_runner = new TestRunner(reporters);
  // Using our own custom test suite runner
  const test_suite_runner = new YTestSuiteRunner(test_runner, reporters);

  const runner = new Runner(loader, test_suite_runner, reporters);

  try {
    await runner.runAll(
      path,
      filters.map(f => new RegExp(f))
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
