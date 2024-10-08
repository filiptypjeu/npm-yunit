// Export Assert from xunit.ts so that the unittests files don't have to import anything from xunit.ts at all
// But a few changes are necessary...

import { AssertionError } from "assert";
import { Assert as OriginalAssert } from "xunit.ts";

// Define our own Assert.notNull, also guarding against undefined
const extended_notNull = <T>(expression: T | null | undefined, message?: string): asserts expression is T => {
  if (expression !== null && expression !== undefined) {
    return;
  }

  throw new AssertionError({
    message: message || `Expected expression not to be null (or undefined), but expression is null (or undefined)`,
    expected: "(non-null expression)",
    actual: expression,
  });
};

// Define our own Assert.throws, adding extra parameters to the AssertionError
const extended_throws = (expression: () => any, message?: string) => {
  let result: unknown;
  try {
    result = expression();
  } catch (exception) {
    return;
  }

  throw new AssertionError({
    message: message || "Expected expression to throw exception, but expression did not throw exception",
    expected: "(expression throws)",
    actual: result,
  });
};

type AssertType = {
  // Change the typing so that these methods asserts the experssion on the type system level too
  true: (expression: any, message?: string) => asserts expression is true;
  false: (expression: any, message?: string) => asserts expression is false;
  undefined: (expression: any, message?: string) => asserts expression is undefined;
  defined: <T>(expression: T | undefined, message?: string) => asserts expression is T;
  null: (expression: any, message?: string) => asserts expression is null;
  instanceOf: <T>(type: T, expression: any, message?: string) => asserts expression is T;

  notNull: typeof extended_notNull;
  throws: typeof extended_throws;

  // Completely new
  areEqual: typeof OriginalAssert.equal;
  areNotEqual: typeof OriginalAssert.notEqual;

  // The typing for the rest of the methods are unchanged
  equal: typeof OriginalAssert.equal;
  notEqual: typeof OriginalAssert.notEqual;
  empty: typeof OriginalAssert.empty;
  notEmpty: typeof OriginalAssert.notEmpty;
  count: typeof OriginalAssert.count;
  contains: typeof OriginalAssert.contains;
  doesNotContain: typeof OriginalAssert.doesNotContain;
  stringContains: typeof OriginalAssert.stringContains;
  stringDoesNotContain: typeof OriginalAssert.stringDoesNotContain;
  stringStartsWith: typeof OriginalAssert.stringStartsWith;
  stringDoesNotStartWIth: typeof OriginalAssert.stringDoesNotStartWIth;
  stringEndsWith: typeof OriginalAssert.stringEndsWith;
  stringDoesNotEndWith: typeof OriginalAssert.stringDoesNotEndWith;
  doesNotThrow: typeof OriginalAssert.doesNotThrow;
};

// Use our own Assert.throws method
export const Assert: AssertType = {
  ...OriginalAssert,
  notNull: extended_notNull,
  throws: extended_throws,
  areEqual: OriginalAssert.equal,
  areNotEqual: OriginalAssert.notEqual,
};
