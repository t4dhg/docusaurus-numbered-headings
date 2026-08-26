export const CONVENTIONS = [
  "iso-2145",
  "usa-classic",
  "spanish-forense",
] as const;
export type Convention = (typeof CONVENTIONS)[number];

export interface PluginOptions {
  enabled?: boolean;
  convention?: Convention;
}

export interface NormalizedPluginOptions {
  enabled: boolean;
  convention: Convention;
}

export function normalizeOptions(options: unknown): NormalizedPluginOptions {
  if (options === undefined) return { enabled: true, convention: "iso-2145" };
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      "[docusaurus-numbered-headings] plugin options must be an object",
    );
  }
  const candidate = options as Record<string, unknown>;
  if (
    candidate.enabled !== undefined &&
    typeof candidate.enabled !== "boolean"
  ) {
    throw new TypeError(
      '[docusaurus-numbered-headings] option "enabled" must be a boolean',
    );
  }
  if (
    candidate.convention !== undefined &&
    !CONVENTIONS.includes(candidate.convention as Convention)
  ) {
    throw new TypeError(
      '[docusaurus-numbered-headings] option "convention" must be one of: ' +
        CONVENTIONS.join(", ") +
        "; received " +
        JSON.stringify(candidate.convention),
    );
  }
  return {
    enabled: candidate.enabled === undefined ? true : candidate.enabled,
    convention: (candidate.convention ?? "iso-2145") as Convention,
  };
}
