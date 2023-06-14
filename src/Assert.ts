// Export Assert from xunit.ts so that the unittests files don't have to import anything from xunit.ts at all
// But a few changes are necessary...

import { AssertionError } from "assert";
import { Assert as OriginalAssert } from "xunit.ts";

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
  notNull: <T>(expression: T | null, message?: string) => asserts expression is T;

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
  instanceOf: typeof OriginalAssert.instanceOf;
  throws: typeof OriginalAssert.throws;
  doesNotThrow: typeof OriginalAssert.doesNotThrow;
};

// Use our own Assert.throws method
export const Assert: AssertType = {
  ...OriginalAssert,
  throws: extended_throws,
};
