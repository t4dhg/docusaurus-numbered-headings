import numberedHeadings, {
  remarkFrontmatterToggle,
} from "docusaurus-numbered-headings";

const convention = process.env.DNH_CONVENTION || "iso-2145";
const enabled = process.env.DNH_ENABLED !== "false";

export default {
  title: "Numbered headings fixture",
  url: "https://fixture.invalid",
  baseUrl: "/",
  onBrokenLinks: "throw",
  plugins: [[numberedHeadings, { enabled, convention }]],
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.mjs",
          remarkPlugins: [remarkFrontmatterToggle],
        },
        blog: false,
      },
    ],
  ],
};
