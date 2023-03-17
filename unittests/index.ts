import { run } from "yunit";

const main = async () => await run("dist-unittests", "yunit unittests");

main();
