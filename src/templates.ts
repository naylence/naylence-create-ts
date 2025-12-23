/**
 * Template discovery - scan starters repo for available templates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  TemplateInfo,
  TemplateManifest,
  TemplateManifestEntry,
  TemplateManifestEntryInput,
  TemplateManifestFlavor,
  TEMPLATES_DIR,
} from "./types.js";

const MANIFEST_FILENAME = "manifest.json";

export interface TemplateDiscoveryOptions {
  onWarning?: (message: string) => void;
}

export interface TemplatePromptChoice {
  title: string;
  value: string;
  description?: string;
}

/**
 * Discover all templates in the starters directory.
 * Structure: <startersPath>/templates/<templateId>/<flavor>/
 */
export async function discoverTemplates(
  startersPath: string,
  options: TemplateDiscoveryOptions = {}
): Promise<TemplateInfo[]> {
  let manifest: TemplateManifest | null = null;

  try {
    manifest = await readTemplateManifest(startersPath);
  } catch (error) {
    options.onWarning?.(buildManifestWarning(startersPath, error as Error));
  }

  if (manifest) {
    const templates = await templatesFromManifest(startersPath, manifest);
    return sortTemplates(templates);
  }

  const templates = await scanTemplates(startersPath);
  return sortTemplates(templates);
}

/**
 * Get the path to a specific template+flavor.
 */
export function getTemplatePath(startersPath: string, templateId: string, flavor: string): string {
  return path.join(startersPath, TEMPLATES_DIR, templateId, flavor);
}

/**
 * Resolve the path to a specific template+flavor, honoring manifest overrides.
 */
export async function resolveTemplateFlavorPath(
  startersPath: string,
  templateId: string,
  flavor: string
): Promise<string> {
  try {
    const manifest = await readTemplateManifest(startersPath);
    if (manifest) {
      const entry = manifest.templates.find((template) => template.id === templateId);
      const flavorInfo = entry?.flavors.find((item) => item.id === flavor);
      if (flavorInfo) {
        const relativePath = flavorInfo.path || flavorInfo.id;
        return path.join(startersPath, TEMPLATES_DIR, templateId, relativePath);
      }
    }
  } catch {
    // Ignore manifest errors here; fall back to directory layout.
  }

  return getTemplatePath(startersPath, templateId, flavor);
}

/**
 * Check if a template+flavor exists.
 */
export async function templateExists(
  startersPath: string,
  templateId: string,
  flavor: string
): Promise<boolean> {
  const templatePath = await resolveTemplateFlavorPath(startersPath, templateId, flavor);
  try {
    const stat = await fs.stat(templatePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Format templates for display.
 */
export function formatTemplateList(templates: TemplateInfo[]): string {
  if (templates.length === 0) {
    return "No templates found.";
  }

  const lines: string[] = ["Available templates:", ""];

  for (const template of templates) {
    const label =
      template.name && template.name !== template.id
        ? `${template.name} (${template.id})`
        : template.id;
    lines.push(`  ${label}`);

    if (template.description) {
      lines.push(`    ${template.description}`);
    }

    lines.push(`    flavors: ${template.flavors.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Build prompt choices from templates.
 */
export function buildTemplateChoices(templates: TemplateInfo[]): TemplatePromptChoice[] {
  return templates.map((template) => {
    const descriptionParts: string[] = [];

    if (template.description) {
      descriptionParts.push(template.description);
    }

    if (template.flavors.length > 0) {
      descriptionParts.push(`flavors: ${template.flavors.join(", ")}`);
    }

    return {
      title: template.name || template.id,
      value: template.id,
      description: descriptionParts.length > 0 ? descriptionParts.join(" | ") : undefined,
    };
  });
}

async function readTemplateManifest(startersPath: string): Promise<TemplateManifest | null> {
  const manifestPath = getManifestPath(startersPath);
  let raw: string;

  try {
    raw = await fs.readFile(manifestPath, "utf-8");
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw new Error(`Unable to read manifest: ${manifestPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in manifest: ${manifestPath}`);
  }

  return normalizeManifest(parsed, manifestPath);
}

function normalizeManifest(data: unknown, manifestPath: string): TemplateManifest {
  if (!data || typeof data !== "object") {
    throw new Error(`Manifest must be an object: ${manifestPath}`);
  }

  const manifest = data as { version?: number; templates?: TemplateManifestEntryInput[] };
  if (!Array.isArray(manifest.templates)) {
    throw new Error(`Manifest must include a templates array: ${manifestPath}`);
  }

  const templates = manifest.templates.map((entry, index) =>
    normalizeManifestEntry(entry, manifestPath, index)
  );

  return {
    version: manifest.version,
    templates,
  };
}

function normalizeManifestEntry(
  entry: TemplateManifestEntryInput,
  manifestPath: string,
  index: number
): TemplateManifestEntry {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Invalid template entry at index ${index}: ${manifestPath}`);
  }

  if (typeof entry.id !== "string" || entry.id.trim() === "") {
    throw new Error(`Template entry missing id at index ${index}: ${manifestPath}`);
  }

  if (typeof entry.name !== "string" || entry.name.trim() === "") {
    throw new Error(`Template entry missing name for ${entry.id}: ${manifestPath}`);
  }

  if (typeof entry.description !== "string" || entry.description.trim() === "") {
    throw new Error(`Template entry missing description for ${entry.id}: ${manifestPath}`);
  }

  if (!Array.isArray(entry.flavors) || entry.flavors.length === 0) {
    throw new Error(`Template entry missing flavors for ${entry.id}: ${manifestPath}`);
  }

  const normalizedFlavors = entry.flavors.map((flavor, flavorIndex) =>
    normalizeManifestFlavor(flavor, entry.id, flavorIndex, manifestPath)
  );

  return {
    ...entry,
    flavors: normalizedFlavors,
  };
}

function normalizeManifestFlavor(
  flavor: string | TemplateManifestFlavor,
  templateId: string,
  flavorIndex: number,
  manifestPath: string
): TemplateManifestFlavor {
  if (typeof flavor === "string") {
    return { id: flavor };
  }

  if (!flavor || typeof flavor !== "object") {
    throw new Error(
      `Invalid flavor entry for ${templateId} at index ${flavorIndex}: ${manifestPath}`
    );
  }

  if (typeof flavor.id !== "string" || flavor.id.trim() === "") {
    throw new Error(
      `Flavor entry missing id for ${templateId} at index ${flavorIndex}: ${manifestPath}`
    );
  }

  if (flavor.path && path.isAbsolute(flavor.path)) {
    throw new Error(
      `Flavor path must be relative for ${templateId}/${flavor.id}: ${manifestPath}`
    );
  }

  return {
    id: flavor.id,
    path: flavor.path,
  };
}

function buildManifestWarning(startersPath: string, error: Error): string {
  const manifestPath = getManifestPath(startersPath);
  return `Warning: Unable to read ${manifestPath} (${error.message}). Falling back to directory scan.`;
}

async function templatesFromManifest(
  startersPath: string,
  manifest: TemplateManifest
): Promise<TemplateInfo[]> {
  const templatesDir = path.join(startersPath, TEMPLATES_DIR);
  const templates: TemplateInfo[] = [];

  for (const entry of manifest.templates) {
    const templatePath = path.join(templatesDir, entry.id);
    if (!(await isDirectory(templatePath))) {
      continue;
    }

    const flavors: string[] = [];
    const flavorPaths: Record<string, string> = {};

    for (const flavor of entry.flavors) {
      const relativePath = flavor.path || flavor.id;
      const fullPath = path.join(templatePath, relativePath);

      if (await isDirectory(fullPath)) {
        flavors.push(flavor.id);
        if (relativePath !== flavor.id) {
          flavorPaths[flavor.id] = relativePath;
        }
      }
    }

    if (flavors.length === 0) {
      continue;
    }

    templates.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      flavors,
      flavorPaths: Object.keys(flavorPaths).length > 0 ? flavorPaths : undefined,
      path: templatePath,
      order: entry.order,
      category: entry.category,
      aliases: entry.aliases,
      hidden: entry.hidden,
      deprecated: entry.deprecated,
    });
  }

  return templates;
}

async function scanTemplates(startersPath: string): Promise<TemplateInfo[]> {
  const templatesDir = path.join(startersPath, TEMPLATES_DIR);

  try {
    await fs.access(templatesDir);
  } catch {
    throw new Error(
      `Templates directory not found: ${templatesDir}\n` +
        `Make sure NAYLENCE_STARTERS_PATH points to the starters repo root.`
    );
  }

  const templateDirs = await fs.readdir(templatesDir, { withFileTypes: true });
  const templates: TemplateInfo[] = [];

  for (const dir of templateDirs) {
    if (!dir.isDirectory()) continue;

    const templateId = dir.name;
    const templatePath = path.join(templatesDir, templateId);

    // Scan for flavors (subdirectories)
    const flavorDirs = await fs.readdir(templatePath, { withFileTypes: true });
    const flavors = flavorDirs.filter((d) => d.isDirectory()).map((d) => d.name);

    if (flavors.length > 0) {
      templates.push({
        id: templateId,
        name: templateId,
        flavors,
        path: templatePath,
      });
    }
  }

  return templates;
}

function sortTemplates(templates: TemplateInfo[]): TemplateInfo[] {
  return [...templates].sort((a, b) => {
    const aOrder = a.order ?? Number.POSITIVE_INFINITY;
    const bOrder = b.order ?? Number.POSITIVE_INFINITY;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aName = (a.name || a.id).toLowerCase();
    const bName = (b.name || b.id).toLowerCase();
    return aName.localeCompare(bName);
  });
}

function getManifestPath(startersPath: string): string {
  return path.join(startersPath, TEMPLATES_DIR, MANIFEST_FILENAME);
}

function isNotFoundError(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
