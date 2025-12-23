/**
 * Shared types for naylence-create CLI.
 */

export interface TemplateInfo {
  id: string;
  name?: string;
  description?: string;
  flavors: string[];
  flavorPaths?: Record<string, string>;
  path: string;
  order?: number;
  category?: string;
  aliases?: string[];
  hidden?: boolean;
  deprecated?: boolean;
}

export interface TemplateManifestFlavor {
  id: string;
  path?: string;
}

export type TemplateManifestFlavorInput = string | TemplateManifestFlavor;

export interface TemplateManifestEntryInput {
  id: string;
  name: string;
  description: string;
  flavors: TemplateManifestFlavorInput[];
  order?: number;
  category?: string;
  aliases?: string[];
  hidden?: boolean;
  deprecated?: boolean;
}

export interface TemplateManifestEntry {
  id: string;
  name: string;
  description: string;
  flavors: TemplateManifestFlavor[];
  order?: number;
  category?: string;
  aliases?: string[];
  hidden?: boolean;
  deprecated?: boolean;
}

export interface TemplateManifest {
  version?: number;
  templates: TemplateManifestEntry[];
}

export interface GeneratorOptions {
  targetDir: string;
  templateId: string;
  flavor: string;
  projectName: string;
  startersPath: string;
  install: boolean;
}

export interface TemplateSource {
  type: "local" | "github";
  path?: string;
  repo?: string;
  ref?: string;
}

export const DEFAULT_FLAVOR = "ts";
export const DEFAULT_GITHUB_REPO = "naylence/naylence-starters";
export const DEFAULT_GITHUB_REF = "main";
export const TEMPLATES_DIR = "templates";

// Binary file extensions to skip during placeholder substitution
export const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".wasm",
]);

// Placeholders to substitute
export const PLACEHOLDERS = {
  PROJECT_NAME: "__PROJECT_NAME__",
  PACKAGE_NAME: "__PACKAGE_NAME__",
  PY_PACKAGE: "__PY_PACKAGE__",
};
