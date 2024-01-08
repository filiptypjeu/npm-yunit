import { Assert, TestSuite } from "xunit.ts";
import TestInfo from "xunit.ts/dist/src/Framework/TestInfo";
import { hrtime } from "process";
import { PerformanceResultReporter } from "./TestReporter";
import TestResult from "xunit.ts/dist/src/Framework/TestResult";

export interface ResourceSetup<T, R extends string = string> {
  name: R;
  dependencies?: R[];
  // Giving a default value assures that the resource always has value, even if it has not been explicitly created
  defaultValue?: T;
  create?: () => T;
  atDelete?: (resource: T) => void;
}

interface ResourceSetupInternal<T, R extends string> extends ResourceSetup<T, R> {
  resource?: T;
}

type PerformaceSuiteParameter = { toString: () => string };

export type PerformanceTestSetup = {
  comment?: string;
  // The function that should be timed
  fn: (operation: number) => any;
} & (
  | {
      // The exact number of operations that are supposed to be run, including warmups
      operations: number;
      // The number of operations that should work as warmup operations and not be included in the timing
      warmups?: number;
    }
  | {
      // The number of seconds the test performance test should be run
      targetTime: number;
      // The number of operations to use for deducing how many operations should be timed
      warmups: number;
    }
);

export type PerformanceSuiteSetup<T extends PerformaceSuiteParameter> = {
  comment?: string;
  fn: (operation: number) => any;
  operations: number;
  warmups?: number;
  setup: {
    parameters: T[];
    before: (param: T, index: number) => any;
    after?: (param: T, index: number) => any;
    beforeAll?: () => any;
    afterAll?: () => any;
  };
};

export interface PerformanceTestResult {
  comment?: string;
  // The number of warmup operations
  warmups: number;
  // The number of operations measured
  N: number;
  // Total amount of time for N operations in nanoseconds
  total: number;
  // Average time per operation in nanoseconds
  average: number;
  // Operations per second
  perSecond: number;
}

/**
 * Our own test method decorator because the one in xunit.ts has an ugly default way of writing the test names.
 */
export const Test = () => (suite: TestSuite, method_name: string, info: TestInfo) => suite.addTest(method_name, info);

export abstract class YTestSuite<R extends string = string> extends TestSuite {
  public reporters: PerformanceResultReporter[] = [];
  protected resourceSetups: ResourceSetupInternal<unknown, R>[] = [];
  protected createdResources: R[] = [];

  protected findResourceSetupOrThrow(name: R): ResourceSetupInternal<unknown, R> {
    const r = this.resourceSetups.find(r => r.name === name);
    if (!r) throw new Error(`Invalid resource '${name}': Not registered`);
    return r;
  }

  /**
   * Register a resource to the test suite.
   */
  public registerResource(setup: ResourceSetup<any, R>) {
    if (this.resourceSetups.find(r => r.name === setup.name)) throw new Error(`Can not register resource '${setup.name}': Duplicate name`);
    this.resourceSetups.push({ ...setup });
  }

  /**
   * Remove a registered resource from the test suite. A resource can not be removed while it's created.
   */
  public removeResource(name: R): ResourceSetup<unknown, R> {
    if (this.isResourceCreated(name)) throw new Error(`Can not remove resource '${name}': Currently created`);
    // Make sure the resource exist
    const resource = this.findResourceSetupOrThrow(name);
    this.resourceSetups = this.resourceSetups.filter(r => r.name !== name);
    return resource;
  }

  /**
   * Remove all registered resources from the test suite. Throws an error if any resource is created.
   */
  public removeAllResources(): void {
    if (this.createdResources.length)
      throw new Error(`Can not remove all resources: Resources [${this.createdResources.join(", ")}] currently created`);

    for (const r of this.resourceSetups.reverse()) {
      this.removeResource(r.name);
    }
  }

  public isResourceCreated(name: R): boolean {
    return this.createdResources.includes(name);
  }

  /**
   * Get a resource from the test suite, assuming it has been created or have a default value.
   */
  public getResource(name: R): unknown {
    const setup = this.findResourceSetupOrThrow(name);
    if (this.isResourceCreated(name)) return setup.resource;
    if (setup.defaultValue !== undefined) return setup.defaultValue;
    throw new Error(`Can not get resource '${name}': Not created and no default value`);
  }

  /**
   * Create a registered resource.
   */
  public createResource(name: R, throwIfExists: boolean = true): void {
    // Check if already created
    if (this.isResourceCreated(name)) {
      if (throwIfExists) throw new Error(`Can not create resource '${name}': Already created`);
      return;
    }

    const setup = this.findResourceSetupOrThrow(name);

    // Create dependencies first
    for (const d of setup.dependencies || []) this.createResource(d, false);

    // Create the actual resource...
    if (setup.create) setup.resource = setup.create();

    // ...and mark it as created
    this.createdResources.push(name);
  }

  /**
   * Create registered resources in the correct order. The correct order is the order in which they are registered to the Suite, not the order given in the parameter here.
   */
  public createResources(names: R[], throwIfExists: boolean = true): void {
    // Check that all the given resources are registered first
    names.forEach(name => this.findResourceSetupOrThrow(name));

    const correctOrder = this.resourceSetups.map(r => r.name).filter(name => names.includes(name));
    for (const name of correctOrder) this.createResource(name, throwIfExists);
  }

  /**
   * Delete a registered resource, assuming it has been created.
   */
  public deleteResource(name: R): void {
    // Check if already deleted
    if (!this.isResourceCreated(name)) throw new Error(`Can not delete resource '${name}': Not created`);

    const setup = this.findResourceSetupOrThrow(name);

    // Do nothing if the resource can not be released
    if (setup.atDelete) setup.atDelete(setup.resource);

    setup.resource = undefined;
    this.createdResources = this.createdResources.filter(n => n !== name);
  }

  /**
   * Delete all created resources.
   */
  public deleteAllResources(): void {
    for (const name of this.createdResources.reverse()) {
      this.deleteResource(name);
    }
  }

  /**
   * Method that gets called before each test starts. Override if needed.
   */
  public async runBeforeEachTest(): Promise<void> {}

  /**
   * Method that gets called after each test ends. Override if needed.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async runAfterEachTest(_resultSoFar: TestResult): Promise<void> {}

  static msSince = (start: [number, number]) => {
    const [s, ns] = hrtime(start);
    return s * 1e3 + ns / 1e6;
  };

  static nsSince = (start: [number, number]) => {
    const [s, ns] = hrtime(start);
    return s * 1e9 + ns;
  };

  /**
   * Measure the performance of a function, and report the results.
   *
   * XXX: Add averaging over many iterations?
   */
  protected measure(o: PerformanceTestSetup): PerformanceTestResult;
  protected measure<T extends PerformaceSuiteParameter>(o: PerformanceSuiteSetup<T>): Record<string, PerformanceTestResult>;
  protected measure<T extends PerformaceSuiteParameter>(o: PerformanceTestSetup | PerformanceSuiteSetup<T>): any {
    if (!("setup" in o)) return this.runMeasurement(o);

    if (o.setup.beforeAll) o.setup.beforeAll();
    let i = 0;
    const result: Record<string, PerformanceTestResult> = {};
    for (const p of o.setup.parameters) {
      const comment = [o.comment, `${p.toString()}`].filter(s => s).join(", ");
      o.setup.before(p, i);
      result[p.toString()] = this.runMeasurement({ ...o, comment });
      if (o.setup.after) o.setup.after(p, i);
      i++;
    }
    if (o.setup.afterAll) o.setup.afterAll();
    return result;
  }

  private runMeasurement = (o: PerformanceTestSetup) => {
    let warmups: number;
    let N: number | undefined;

    if ("targetTime" in o) {
      Assert.true(o.targetTime > 0);
      Assert.true(o.warmups > 0);
      warmups = o.warmups;
    } else {
      Assert.true(o.operations > 0);
      warmups = o.warmups ?? Math.floor(o.operations / 100);
      N = o.operations - warmups;
      Assert.true(warmups >= 0);
      Assert.true(N > 0);
    }

    for (const r of this.reporters) r.performanceTestStarted({ ...o, warmups });

    let total: number;
    let i = 0;
    try {
      // Do warmup for warmup
      const WW = Math.floor(warmups / 5);
      for (; i < WW; i++) {
        o.fn(i);
      }

      // Do the rest of the warmup
      const warmupStart = hrtime();
      for (; i < warmups; i++) {
        o.fn(i);
      }
      const warmupDuration = YTestSuite.nsSince(warmupStart);

      // Deduce N if only a target time was given
      if (N === undefined) {
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
        const seconds = (o as any).targetTime || 5;
        const avg = warmupDuration / warmups;
        N = Math.round((seconds * 1.5e9) / avg);
      }

      const M = warmups + N;
      const actualStart = hrtime();
      for (; i < M; i++) {
        o.fn(i);
      }
      total = YTestSuite.nsSince(actualStart);
    } catch (error) {
      for (const r of this.reporters) r.performanceTestErrored(i, i < warmups);
      throw error;
    }

    const average = N && total / N;
    const perSecond = average && Math.floor(1e9 / average);

    const result: PerformanceTestResult = {
      comment: o.comment,
      warmups,
      N,
      total,
      average,
      perSecond,
    };

    for (const r of this.reporters) r.performanceTestEnded(result);
    return result;
  };
}
