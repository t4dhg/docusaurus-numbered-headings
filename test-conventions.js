// Test both numbering conventions
const plugin = require("./lib/index.js").default;

console.log("Testing docusaurus-numbered-headings plugin...\n");

// Test default configuration (should use iso-2145)
console.log("1. Testing default configuration:");
const defaultPlugin = plugin({}, {});
console.log("Plugin name:", defaultPlugin.name);
console.log("Client modules:", defaultPlugin.getClientModules());
console.log("");

// Test with iso-2145 convention explicitly
console.log("2. Testing with iso-2145 convention:");
const iso2145Plugin = plugin({}, { convention: "iso-2145" });
console.log("Plugin name:", iso2145Plugin.name);
console.log("Client modules:", iso2145Plugin.getClientModules());
console.log("");

// Test with usa-classic convention
console.log("3. Testing with usa-classic convention:");
const usaClassicPlugin = plugin({}, { convention: "usa-classic" });
console.log("Plugin name:", usaClassicPlugin.name);
console.log("Client modules:", usaClassicPlugin.getClientModules());
console.log("");

// Test with disabled plugin
console.log("4. Testing with disabled plugin:");
const disabledPlugin = plugin({}, { enabled: false });
console.log("Plugin name:", disabledPlugin.name);
console.log("Client modules:", disabledPlugin.getClientModules());
console.log("");

console.log("All tests completed successfully!");
