import numberedHeadings, {
  remarkFrontmatterToggle,
  type Convention,
  type PluginOptions,
} from "docusaurus-numbered-headings";

const convention: Convention = "spanish-forense";
const options = { enabled: true, convention } satisfies PluginOptions;
const plugin = numberedHeadings(
  {} as Parameters<typeof numberedHeadings>[0],
  options,
);
const transform = remarkFrontmatterToggle();

void plugin;
void transform;
