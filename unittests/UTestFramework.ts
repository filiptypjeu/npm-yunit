import { YTestSuite, Test, Assert } from "yunit";

export default class UTestFramework extends YTestSuite {
    @Test()
    async Test_Delete_All_Resources_OK() {
        this.deleteAllResources();
    }

    @Test()
    async Test_Remove_Nonexistant_Resource() {
        Assert.throws(() => this.removeResource("Test"));
    }

    @Test()
    async Test_Create_Nonexistant_Resource() {
        Assert.throws(() => this.createResource("Test"));
    }

    @Test()
    async Test_Delete_Nonexistant_Resource() {
        Assert.throws(() => this.deleteResource("Test"));
    }

    @Test()
    async Test_Register_Resource() {
        let t = 10;
        Assert.throws(() => this.getResource("Test"));
        Assert.equal(10, t);

        this.registerResource({
            name: "Test",
            create: () => 1,
            atDelete: (n: number) => t += n,
        })
        Assert.throws(() => this.getResource("Test"));
        Assert.equal(10, t);

        this.createResource("Test");
        Assert.equal(1, this.getResource("Test"));
        Assert.equal(10, t);

        this.deleteResource("Test");
        Assert.throws(() => this.getResource("Test"));
        Assert.equal(11, t);

        this.removeResource("Test");
    }

    @Test()
    async Test_Register_Resource_with_DefaultValue() {
        Assert.throws(() => this.getResource("Test"));

        this.registerResource({
            name: "Test",
            defaultValue: false,
            create: () => true,
        })
        Assert.equal(false, this.getResource("Test"));

        this.createResource("Test");
        Assert.equal(true, this.getResource("Test"));

        this.deleteResource("Test");
        Assert.equal(false, this.getResource("Test"));

        this.removeResource("Test");
    }

    @Test()
    async Test_Register_Resource_with_Dependencies() {
        this.registerResource({
            name: "Test",
            dependencies: ["Test2"],
        })
        Assert.throws(() => this.createResource("Test"));

        this.registerResource({
            name: "Test2",
            defaultValue: false,
            create: () => true,
        })
        this.createResource("Test");
        Assert.equal(true, this.getResource("Test2"));

        this.removeResource("Test");
        this.removeResource("Test2");
    }
}
