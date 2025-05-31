// Example docusaurus.config.js usage

module.exports = {
  title: "My Site",
  tagline: "My site tagline",

  // Basic usage - just add to plugins array
  plugins: ["docusaurus-numbered-headings"],

  // Advanced usage with options
  plugins: [
    [
      "docusaurus-numbered-headings",
      {
        enabled: true, // Set to false to disable
      },
    ],
  ],

  // ... rest of your docusaurus config
};
