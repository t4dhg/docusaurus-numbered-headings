const plugin = require("./lib/index.js").default;

console.log("Testing docusaurus-numbered-headings plugin...");

try {
  const context = {
    siteDir: "/test",
    siteConfig: {},
    outDir: "/test/build",
  };

  const pluginInstance = plugin(context);
  console.log("✓ Plugin instantiated successfully");
  console.log("Plugin name:", pluginInstance.name);

  const clientModules = pluginInstance.getClientModules();
  console.log("✓ Client modules function works:", Array.isArray(clientModules));

  console.log("All tests passed! 🎉");
} catch (error) {
  console.error("Test failed:", error.message);
}
