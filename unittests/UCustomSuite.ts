import { YTestSuite, Test, Assert, ResourceSetup } from "yunit";

type Resource = "A" | "B" | "C" | "AB";

export default class CustomTestSuite extends YTestSuite<Resource>
{
    public get A(): number { return this.getResource("A") as any; }
    public get B(): string { return this.getResource("B") as any; }
    public get C(): boolean { return this.getResource("C") as any; }

    constructor() {
        super();
        process.setMaxListeners(1000);

        const setups: ResourceSetup<any, Resource>[] = [
            {
                name: "A",
                create: () => 42,
            }, {
                name: "B",
                create: () => "initialized",
            }, {
                name: "C",
                defaultValue: false,
                create: () => true,
            }, {
                name: "AB",
                dependencies: ["A", "B"],
            },
        ];

        for (const s of setups) this.registerResource(s);
    }

    @Test()
    async Test_Get_Nonexistant_Resource() {
        Assert.throws(() => this.A);
        Assert.throws(() => this.B);
        Assert.false(this.C);
    }

    @Test()
    async Test_Create_Resource() {
        this.createResource("A");
        Assert.equal(42, this.A);

        this.createResource("B");
        Assert.equal("initialized", this.B);

        this.createResource("C");
        Assert.true(this.C);
    }

    @Test()
    async Test_Delete_Resource() {
        this.deleteResource("A");
        Assert.throws(() => this.A);

        this.deleteResource("B");
        Assert.throws(() => this.B);

        this.deleteResource("C");
        Assert.false(this.C);
    }
}
