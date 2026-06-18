import { connect } from "../dist/index.js";

const tool = await connect("opencode");
tool.checkAuth().then((auth) => console.log("OpenCode auth:", auth));
tool.health().then((health) => console.log("OpenCode health:", health));
const result = await tool.chat({
  messages: [{ role: "user", content: "Hello, how are you? What is 1+3?" }],
  model: "opencode/deepseek-v4-flash-free"
});

console.log(result.message.content);