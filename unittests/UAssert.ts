import { YTestSuite, Test, Assert } from "yunit";

class MyClass {}
class MyError extends Error {}

export default class UAssert extends YTestSuite {
    @Test()
    async Test_True_Typing() {
        const f = (n: boolean): true => {
            Assert.true(n);
            // This should compile since the Assert.true forces the argument to be true
            return n;
        }

        Assert.true(f(true));
        Assert.throws(() => f(false));
    }

    @Test()
    async Test_False_Typing() {
        const f = (n: boolean): false => {
            Assert.false(n);
            // This should compile since the Assert.false forces the argument to be false
            return n;
        }

        Assert.false(f(false));
        Assert.throws(() => f(true));
    }

    @Test()
    async Test_Undefined_Typing() {
        const f = (n: any): undefined => {
            Assert.undefined(n);
            // This should compile since the Assert.undefined forces the argument to be undefined
            return n;
        }

        Assert.undefined(f(undefined));
        Assert.throws(() => f(null));
    }

    @Test()
    async Test_Defined_Typing() {
        const f = (n?: number): number => {
            Assert.defined(n);
            // This should compile since the Assert.defined forces the argument to be defined
            return n;
        }

        Assert.defined(f(1));
        Assert.throws(() => f(undefined));
    }

    @Test()
    async Test_Null_Typing() {
        const f = (n: number | null): null => {
            Assert.null(n);
            // This should compile since the Assert.null forces the argument to be null
            return n;
        }

        Assert.null(f(null));
        Assert.throws(() => f(1));
    }

    @Test()
    async Test_NotNull_Typing() {
        const f = (n: number | null | undefined): number => {
            Assert.notNull(n);
            // This should compile since the Assert.notNull forces the argument to be non-null
            return n;
        }

        Assert.equal(1, f(1));
        Assert.throws(() => f(null));
        Assert.throws(() => f(undefined));
    }

    @Test()
    async Test_InstanceOf_Typing() {
        const f = (instance: unknown): MyClass => {
            Assert.instanceOf(MyClass, instance);
            // This should compile since the Assert.instanceOf forces the argument to be of the specified instance
            return instance;
        }

        const c = new MyClass();
        Assert.equal(c, f(c));
        Assert.throws(() => f(null));
        Assert.throws(() => f(undefined));
        Assert.throws(() => f(1));
        Assert.throws(() => f("1"));
    }

    @Test()
    async Test_null_vs_undefined() {
        const a = null;
        const b = undefined;
        const c = 0;

        // Testing Assert.null
        Assert.null(a);
        Assert.throws(() => Assert.null(b));
        Assert.throws(() => Assert.null(c));

        // Testing Assert.notNull
        Assert.throws(() => Assert.notNull(a));
        Assert.throws(() => Assert.notNull(b));
        Assert.notNull(c);

        // Testing Assert.undefined
        Assert.throws(() => Assert.undefined(a));
        Assert.undefined(b);
        Assert.throws(() => Assert.undefined(c));

        // Testing Assert.defined
        Assert.defined(a);
        Assert.throws(() => Assert.defined(b));
        Assert.defined(c);
    }

    @Test()
    async Test_Throws() {
        Assert.throws(() => { throw 42; });
        Assert.throws(() => { throw new Error("error"); });
        Assert.throws(() => { throw new MyError("error"); });
        Assert.throws(() => Assert.throws(() => {}));
    }

    @Test()
    async Test_ThrowsException() {
        Assert.throwsException(() => { throw new Error("error"); }, Error);
        Assert.throwsException(() => { throw new MyError("error"); }, Error);
        Assert.throwsException(() => { throw new MyError("error"); }, MyError);

        Assert.throwsException(() => Assert.throwsException(() => { throw 42; }, Error), Assert.AssertionError);
        Assert.throwsException(() => Assert.throws(() => {}), Assert.AssertionError);
        Assert.throwsException(() => Assert.throwsException(() => {}, Error), Assert.AssertionError);
        Assert.throwsException(() => Assert.throwsException(() => { throw new Error("error"); }, MyError), Assert.AssertionError);
    }

    @Test()
    async Test_AreEqual_and_AreNotEqual() {
        Assert.areEqual(1, 1);
        Assert.areNotEqual(1, -1);
    }
}
