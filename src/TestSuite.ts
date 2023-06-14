import { TestSuite } from "xunit.ts";
import TestInfo from "xunit.ts/dist/src/Framework/TestInfo";
import { hrtime } from "process";
import { PerformanceResultReporter, PerformanceTestOptions, PerformanceTestResult } from "./TestReporter";

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

export interface PerformanceTestSetup extends PerformanceTestOptions {
  fn: (operation: number) => any;
}

type PerformaceParameter = { toString: () => string };

export interface PerformanceSuiteSetup<T extends PerformaceParameter> extends Omit<PerformanceTestSetup, "warmups"> {
  warmups?: number;
  setup?: {
    parameters: T[];
    before: (param: T, index: number) => any;
    after?: (param: T, index: number) => any;
    beforeAll?: () => any;
    afterAll?: () => any;
  };
}

// Export Assert from xunit.ts too so that the unittests files don't have to import anything from xunit.ts at all.
export { Assert } from "xunit.ts";

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
    if (this.resourceSetups.find(r => r.name === setup.name))
      throw new Error(`Can not register resource '${setup.name}': Duplicate name`);
    this.resourceSetups.push({ ...setup });
  }

  /**
   * Remove a registered resource from the test suite. A resource can not be removed while it's created.
   */
  public removeResource(name: R) {
    if (this.isResourceCreated(name))
      throw new Error(`Can not remove resource '${name}': Currently created`);
    this.findResourceSetupOrThrow(name);
    this.resourceSetups = this.resourceSetups.filter(r => r.name !== name);
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

  protected msSince = (start: [number, number]) => {
    const [s, ns] = hrtime(start);
    return s * 1e3 + ns / 1e6;
  };

  protected nsSince = (start: [number, number]) => {
    const [s, ns] = hrtime(start);
    return s * 1e9 + ns;
  };

  /**
   * Measure the performance of a function, and report the results.
   *
   * XXX: Add averaging over many iterations?
   */
  protected measure = <T extends PerformaceParameter>(options: PerformanceSuiteSetup<T>) => {
    const warmups = options.warmups ?? Math.floor(options.operations / 100);
    const o = { ...options, warmups };

    if (!o.setup) return this.runMeasurement(o);

    if (o.setup.beforeAll) o.setup.beforeAll();
    let i = 0;
    for (const p of o.setup.parameters) {
      const comment = [o.comment, `${p.toString()}`].filter(s => s).join(", ");
      o.setup.before(p, i);
      this.runMeasurement({ ...o, comment });
      if (o.setup.after) o.setup.after(p, i);
      i++;
    }
    if (o.setup.afterAll) o.setup.afterAll();
  };

  private runMeasurement = (o: PerformanceTestSetup) => {
    for (const r of this.reporters) r.performanceTestStarted(o);

    let total: number;
    let N = o.operations - o.warmups;
    let i = 0;
    try {
      // Do a short warmup warmup
      for (; i < 10; i++) {
        o.fn(i);
      }

      // Do a warmup to deduce a good N
      const warmupStart = hrtime();
      for (; i < o.warmups; i++) {
        o.fn(i);
      }
      const warmupDuration = this.nsSince(warmupStart);

      // Decrease N for the actual iteration if the original N seems too large
      // Target for a 5 second iteration, but use 6 seconds in the calculation due to the warmup operations usually being slower
      const avg = warmupDuration / (o.warmups - 10);
      N = Math.min(N, Math.round(6e9 / avg));
      const M = o.warmups + N;

      const actualStart = hrtime();
      for (; i < M; i++) {
        o.fn(i);
      }
      total = this.nsSince(actualStart);
    } catch (error) {
      for (const r of this.reporters) r.performanceTestErrored(i);
      throw error;
    }

    const average = N && total / N;
    const perSecond = average && Math.floor(1e9 / average);

    const result: PerformanceTestResult = {
      ...o,
      N,
      total,
      average,
      perSecond,
    };

    for (const r of this.reporters) r.performanceTestEnded(result);
  };
}
