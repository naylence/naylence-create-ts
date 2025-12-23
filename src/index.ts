/**
 * Public API for naylence-create.
 * Exports functions for programmatic use.
 */
export {
  buildTemplateChoices,
  discoverTemplates,
  formatTemplateList,
  templateExists,
  getTemplatePath,
  resolveTemplateFlavorPath,
} from "./templates.js";
export {
  generateProject,
  runInstall,
  ensureEnvFiles,
  ensureGitignoreHasEnvEntries,
} from "./generator.js";
export { fetchFromGithub, cleanupTempDir } from "./github.js";
export {
  toPackageName,
  toPythonPackage,
  getProjectName,
  resolveStartersPath,
  resolveGithubRepo,
  resolveGitRef,
} from "./utils.js";
export type {
  TemplateInfo,
  TemplateManifest,
  TemplateManifestEntry,
  TemplateManifestFlavor,
  GeneratorOptions,
  TemplateSource,
} from "./types.js";
export {
  DEFAULT_FLAVOR,
  DEFAULT_GITHUB_REPO,
  DEFAULT_GITHUB_REF,
  TEMPLATES_DIR,
  PLACEHOLDERS,
} from "./types.js";
