import { YTestSuite, Test, Assert } from "yunit";

class UTestCallbacksBase extends YTestSuite {
    protected m_before = 0;
    protected m_after = 0;

    public override async runBeforeEachTest(): Promise<void> {
        this.m_before++;
    }

    public override async runAfterEachTest(): Promise<void> {
        this.m_after++;
    }
}

export default class UTestCallbacks extends UTestCallbacksBase {
    public override async runBeforeEachTest(): Promise<void> {
        super.runBeforeEachTest();
        this.m_before *= 2;
    }

    public override async runAfterEachTest(): Promise<void> {
        super.runAfterEachTest();
        this.m_after *= 2;
    }

    @Test()
    async Test_Callbacks_1() {
        Assert.areEqual(2, this.m_before);
        Assert.areEqual(0, this.m_after);
    }

    @Test()
    async Test_Callbacks_2() {
        Assert.areEqual(6, this.m_before);
        Assert.areEqual(2, this.m_after);
    }
}
