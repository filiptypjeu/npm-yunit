const fs = require("fs");
const p = "node_modules/yunit";
if (!fs.existsSync(p)) fs.symlinkSync("../dist", p);
