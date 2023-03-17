import { YTestSuite, Test, Assert } from "yunit";

export default class UTestBenchmark extends YTestSuite {
    @Test()
    async Test_Measure() {
        const N = 1000;
        let a = 0;
        let b = 0;
        const A: any[] = [];
        const B: any[] = [];

        this.measure({
            operations: N,
            warmups: 42,
            fn: i => {
                a++;
                b += i;
            },
            setup: {
                parameters: ["a", "b", "c"],
                before: (p, i) => A.push([p, i]),
                after: (p, i) => B.push([p, i]),
            }
        });

        Assert.equal(3*N, a);
        Assert.equal(3*N*(N-1)/2, b);
        Assert.equal([["a", 0], ["b", 1], ["c", 2]], A);
        Assert.equal([["a", 0], ["b", 1], ["c", 2]], B);
    }
}
