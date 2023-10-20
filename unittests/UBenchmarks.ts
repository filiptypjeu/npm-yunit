import { YTestSuite, Test, Assert } from "yunit";

export default class UTestBenchmark extends YTestSuite {
    @Test()
    async Invalid_Test_Parameters() {
        // operations less than warmups
        Assert.throws(() => this.measure({
            operations: 10,
            warmups: 100,
            fn: () => {},
        }));
        // operations equal to warmups
        Assert.throws(() => this.measure({
            operations: 100,
            warmups: 100,
            fn: () => {},
        }));
        // operations negative
        Assert.throws(() => this.measure({
            operations: -100,
            fn: () => {},
        }));
        // warmups negative
        Assert.throws(() => this.measure({
            operations: 100,
            warmups: -10,
            fn: () => {},
        }));
        // targetTime negative
        Assert.throws(() => this.measure({
            targetTime: -1,
            warmups: 10,
            fn: () => {},
        }));
        // warmups negative
        Assert.throws(() => this.measure({
            targetTime: 1,
            warmups: -10,
            fn: () => {},
        }));
    }

    @Test()
    async Operations_With_Undefined_Warmpus() {
        let a = 0;

        const result = this.measure({
            operations: 1000,
            fn: () => a++,
        });

        Assert.equal(1000, a);
        Assert.equal(990, result.N);
        Assert.equal(10, result.warmups);
    }

    @Test()
    async Operations_With_Warmpus() {
        let a = 0;

        const result = this.measure({
            operations: 1000,
            warmups: 100,
            fn: () => a++,
        });

        Assert.equal(1000, a);
        Assert.equal(900, result.N);
        Assert.equal(100, result.warmups);
    }

    @Test()
    async One_Operation_With_Zero_Warmpus() {
        let a = 0;

        const result = this.measure({
            operations: 1,
            warmups: 0,
            fn: () => a++,
        });

        Assert.equal(1, a);
        Assert.equal(1, result.N);
        Assert.equal(0, result.warmups);
    }

    @Test()
    async TargetTime() {
        let a = 0;

        const result = this.measure({
            targetTime: 1,
            warmups: 100000,
            fn: () => a++,
        });

        Assert.true(result.N > 10_000_000);
        Assert.equal(100000, result.warmups);
        Assert.equal(a, result.N + result.warmups);
    }

    @Test()
    async Operation_Index() {
        const a: number[] = [];

        this.measure({
            operations: 10,
            warmups: 5,
            fn: i => a.push(i),
        });

        Assert.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], a);
    }

    @Test()
    async Error_During_Warmup_Warmup() {
        let a = 0;

        Assert.throws(() => this.measure({
            operations: 1000,
            warmups: 100,
            fn: i => {
                if (i == 5) throw new Error("Error");
                a++;
            },
        }));

        Assert.equal(5, a);
    }

    @Test()
    async Error_During_Warmup() {
        let a = 0;

        Assert.throws(() => this.measure({
            operations: 1000,
            warmups: 100,
            fn: i => {
                if (i == 50) throw new Error("Error");
                a++;
            },
        }));

        Assert.equal(50, a);
    }

    @Test()
    async Error_During_Timing() {
        let a = 0;

        Assert.throws(() => this.measure({
            operations: 1000,
            warmups: 100,
            fn: i => {
                if (i == 500) throw new Error("Error");
                a++;
            },
        }));

        Assert.equal(500, a);
    }

    @Test()
    async Suite() {
        let a = 0;
        const A: [string, number][] = [];
        const B: [string, number][] = [];

        const result = this.measure({
            operations: 100,
            fn: () => a++,
            setup: {
                parameters: ["a", "b", "c"],
                before: (p, i) => A.push([p, i]),
                after: (p, i) => B.push([p, i]),
            }
        });

        Assert.equal(300, a);
        Assert.equal([["a", 0], ["b", 1], ["c", 2]], A);
        Assert.equal([["a", 0], ["b", 1], ["c", 2]], B);
        Assert.true("a" in result);
        Assert.true("b" in result);
        Assert.true("c" in result);
        Assert.false("d" in result);
        Assert.equal(99, result["a"].N);
    }
}
