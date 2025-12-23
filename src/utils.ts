/**
 * Utility functions for naylence-create CLI.
 */
import path from "node:path";

/**
 * Sanitize a project name to a valid npm package name.
 * - Lowercase
 * - Replace spaces and underscores with hyphens
 * - Remove invalid characters
 * - Ensure it starts with a letter or @
 */
export function toPackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-@/]/g, "")
    .replace(/^[^a-z@]/, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Sanitize a project name to a valid Python package name.
 * - Lowercase
 * - Replace hyphens and spaces with underscores
 * - Remove invalid characters
 * - Ensure it starts with a letter
 */
export function toPythonPackage(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^[^a-z]/, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Extract project name from target directory path.
 */
export function getProjectName(targetDir: string): string {
  return path.basename(path.resolve(targetDir));
}

/**
 * Check if a file should be treated as binary based on extension.
 */
export function isBinaryFile(filePath: string, binaryExtensions: Set<string>): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.has(ext);
}

/**
 * Resolve the starters path from environment or default.
 */
export function resolveStartersPath(cliPath?: string): string | undefined {
  // CLI flag takes precedence
  if (cliPath) {
    return path.resolve(cliPath);
  }

  // Environment variable
  const envPath = process.env.NAYLENCE_STARTERS_PATH;
  if (envPath) {
    return path.resolve(envPath);
  }

  return undefined;
}

/**
 * Resolve GitHub repo from environment or default.
 */
export function resolveGithubRepo(): string {
  return process.env.NAYLENCE_STARTERS_GITHUB || "naylence/naylence-starters";
}

/**
 * Resolve Git ref from environment or default.
 */
export function resolveGitRef(cliRef?: string): string {
  if (cliRef) {
    return cliRef;
  }
  return process.env.NAYLENCE_STARTERS_REF || "main";
}
