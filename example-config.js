// Example Docusaurus configuration showing both numbering conventions

// Configuration with ISO 2145 numbering (default)
const configISO = {
  title: "My Site",
  tagline: "Documentation with ISO 2145 numbering",
  url: "https://your-docusaurus-test-site.com",
  baseUrl: "/",

  plugins: [
    // Using default convention (iso-2145)
    "docusaurus-numbered-headings",

    // Or explicitly specify iso-2145
    // [
    //   "docusaurus-numbered-headings",
    //   {
    //     convention: "iso-2145"
    //   }
    // ]
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
        },
      },
    ],
  ],
};

// Configuration with USA Classic numbering
const configUSA = {
  title: "My Site",
  tagline: "Documentation with USA Classic numbering",
  url: "https://your-docusaurus-test-site.com",
  baseUrl: "/",

  plugins: [
    [
      "docusaurus-numbered-headings",
      {
        convention: "usa-classic",
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
        },
      },
    ],
  ],
};

// Configuration with disabled numbering
const configDisabled = {
  title: "My Site",
  tagline: "Documentation without numbering",
  url: "https://your-docusaurus-test-site.com",
  baseUrl: "/",

  plugins: [
    [
      "docusaurus-numbered-headings",
      {
        enabled: false,
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
        },
      },
    ],
  ],
};

module.exports = configISO; // Change this to use different configurations
