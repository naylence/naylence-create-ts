/**
 * Project generator - copy template and substitute placeholders.
 */
import fs from "node:fs/promises";
import fse from "fs-extra";
import path from "node:path";
import { BINARY_EXTENSIONS, GeneratorOptions, PLACEHOLDERS } from "./types.js";
import { resolveTemplateFlavorPath } from "./templates.js";
import { isBinaryFile, toPackageName, toPythonPackage } from "./utils.js";
import pc from "picocolors";

/**
 * Generate a new project from a template.
 */
export async function generateProject(options: GeneratorOptions): Promise<void> {
  const { targetDir, templateId, flavor, projectName, startersPath } = options;

  const templatePath = await resolveTemplateFlavorPath(startersPath, templateId, flavor);
  const targetPath = path.resolve(targetDir);

  // Validate template exists
  try {
    await fs.access(templatePath);
  } catch {
    throw new Error(
      `Template not found: ${templateId}/${flavor}\n` +
        `Path: ${templatePath}\n` +
        `Run with --list to see available templates.`
    );
  }

  // Check target directory
  await validateTargetDir(targetPath);

  // Copy template
  console.log(pc.cyan(`\nCopying template ${templateId}/${flavor}...`));
  await copyTemplate(templatePath, targetPath);

  // Substitute placeholders
  console.log(pc.cyan("Substituting placeholders..."));
  const substitutions = buildSubstitutions(projectName);
  await substituteInDirectory(targetPath, substitutions);

  await ensureEnvFiles(templatePath, targetPath);
  await ensureGitignoreHasEnvEntries(targetPath);

  console.log("Initialized .env.agent and .env.client (if templates present)");
  console.log(pc.green(`\n✓ Project created at ${targetPath}\n`));
}

/**
 * Validate target directory - fail if non-empty, allow if empty or doesn't exist.
 */
async function validateTargetDir(targetPath: string): Promise<void> {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error(`Target path exists but is not a directory: ${targetPath}`);
    }

    const contents = await fs.readdir(targetPath);
    if (contents.length > 0) {
      throw new Error(
        `Target directory is not empty: ${targetPath}\n` +
          `Please choose an empty directory or a new path.`
      );
    }
  } catch (err: unknown) {
    // Directory doesn't exist - that's fine, we'll create it
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}

/**
 * Copy template directory, excluding .git, node_modules, dist, lock files, and other build artifacts.
 */
async function copyTemplate(src: string, dest: string): Promise<void> {
  const EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", ".tmp", "__pycache__", ".venv", "venv"]);
  const EXCLUDE_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".env"]);

  await fse.copy(src, dest, {
    filter: (srcPath) => {
      const relativePath = path.relative(src, srcPath);
      if (!relativePath) return true; // Include root

      const parts = relativePath.split(path.sep);
      const filename = path.basename(srcPath);

      // Exclude lock files and .env at root level
      if (parts.length === 1 && EXCLUDE_FILES.has(filename)) {
        return false;
      }

      // Exclude env templates anywhere
      if (filename.startsWith(".env.") && filename.endsWith(".template")) {
        return false;
      }

      // Exclude if any part of the path matches excluded directories
      return !parts.some((part) => EXCLUDE_DIRS.has(part));
    },
    preserveTimestamps: true,
  });
}

export async function ensureEnvFiles(templateDir: string, destDir: string): Promise<void> {
  const envNames = ["agent", "client"];

  for (const name of envNames) {
    const templatePath = path.join(templateDir, `.env.${name}.template`);
    const outPath = path.join(destDir, `.env.${name}`);

    if (await fse.pathExists(outPath)) {
      continue;
    }

    if (await fse.pathExists(templatePath)) {
      await fs.copyFile(templatePath, outPath);
    } else {
      console.warn(`[warn] Missing ${templatePath}, skipping env init`);
    }
  }
}

export async function ensureGitignoreHasEnvEntries(destDir: string): Promise<void> {
  const gitignorePath = path.join(destDir, ".gitignore");
  const entries = [".env.agent", ".env.client"];

  if (!(await fse.pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, `${entries.join("\n")}\n`, "utf-8");
    return;
  }

  const content = await fs.readFile(gitignorePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const existing = new Set(lines.map((line) => line.trim()).filter((line) => line.length > 0));
  const missing = entries.filter((entry) => !existing.has(entry));

  if (missing.length === 0) {
    return;
  }

  const separator = content.endsWith("\n") ? "" : "\n";
  const updated = `${content}${separator}${missing.join("\n")}\n`;
  await fs.writeFile(gitignorePath, updated, "utf-8");
}

/**
 * Build substitution map from project name.
 */
function buildSubstitutions(projectName: string): Map<string, string> {
  const substitutions = new Map<string, string>();

  substitutions.set(PLACEHOLDERS.PROJECT_NAME, projectName);
  substitutions.set(PLACEHOLDERS.PACKAGE_NAME, toPackageName(projectName));
  substitutions.set(PLACEHOLDERS.PY_PACKAGE, toPythonPackage(projectName));

  return substitutions;
}

/**
 * Recursively substitute placeholders in all text files.
 */
async function substituteInDirectory(
  dirPath: string,
  substitutions: Map<string, string>
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      await substituteInDirectory(fullPath, substitutions);
    } else if (entry.isFile()) {
      await substituteInFile(fullPath, substitutions);
    }
  }
}

/**
 * Substitute placeholders in a single file.
 */
async function substituteInFile(
  filePath: string,
  substitutions: Map<string, string>
): Promise<void> {
  // Skip binary files
  if (isBinaryFile(filePath, BINARY_EXTENSIONS)) {
    return;
  }

  try {
    let content = await fs.readFile(filePath, "utf-8");
    let modified = false;

    for (const [placeholder, value] of substitutions) {
      if (content.includes(placeholder)) {
        content = content.replaceAll(placeholder, value);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(filePath, content, "utf-8");
    }
  } catch {
    // Skip files that can't be read as text
  }
}

/**
 * Run package manager install in the target directory.
 */
export async function runInstall(targetDir: string): Promise<void> {
  const { execSync } = await import("node:child_process");

  // Detect package manager
  const pm = await detectPackageManager(targetDir);

  console.log(pc.cyan(`\nInstalling dependencies with ${pm}...`));

  try {
    execSync(`${pm} install`, {
      cwd: targetDir,
      stdio: "inherit",
    });
    console.log(pc.green("✓ Dependencies installed"));
  } catch {
    console.log(pc.yellow("⚠ Failed to install dependencies. Run manually."));
  }
}

/**
 * Detect which package manager to use.
 */
async function detectPackageManager(targetDir: string): Promise<string> {
  // Check for lock files
  try {
    await fs.access(path.join(targetDir, "pnpm-lock.yaml"));
    return "pnpm";
  } catch {}

  try {
    await fs.access(path.join(targetDir, "yarn.lock"));
    return "yarn";
  } catch {}

  try {
    await fs.access(path.join(targetDir, "bun.lockb"));
    return "bun";
  } catch {}

  // Check if pnpm is available globally
  try {
    const { execSync } = await import("node:child_process");
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {}

  return "npm";
}
