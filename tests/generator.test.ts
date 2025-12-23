/**
 * Tests for naylence-create generator.
 *
 * These tests use the local starters repo and verify:
 * - Templates are discovered correctly
 * - Projects are generated with correct structure
 * - Placeholders are substituted
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fse from "fs-extra";
import {
  discoverTemplates,
  formatTemplateList,
  buildTemplateChoices,
  resolveTemplateNextSteps,
  generateProject,
  ensureEnvFiles,
  templateExists,
  toPackageName,
  toPythonPackage,
  getProjectName,
} from "../src/index.js";

// Resolve starters path from env or default to sibling repo
const STARTERS_PATH =
  process.env.NAYLENCE_STARTERS_PATH ||
  path.resolve(import.meta.dirname, "../../naylence-starters");

let tempDir: string;

beforeAll(async () => {
  // Create temp directory for test outputs
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "naylence-create-test-"));
});

afterAll(async () => {
  // Clean up temp directory
  await fse.remove(tempDir);
});

describe("utils", () => {
  describe("toPackageName", () => {
    it("converts to lowercase", () => {
      expect(toPackageName("MyProject")).toBe("myproject");
    });

    it("replaces spaces with hyphens", () => {
      expect(toPackageName("my project")).toBe("my-project");
    });

    it("replaces underscores with hyphens", () => {
      expect(toPackageName("my_project")).toBe("my-project");
    });

    it("removes invalid characters", () => {
      expect(toPackageName("my$project!")).toBe("myproject");
    });

    it("handles scoped packages", () => {
      expect(toPackageName("@scope/my-pkg")).toBe("@scope/my-pkg");
    });
  });

  describe("toPythonPackage", () => {
    it("converts to lowercase", () => {
      expect(toPythonPackage("MyProject")).toBe("myproject");
    });

    it("replaces hyphens with underscores", () => {
      expect(toPythonPackage("my-project")).toBe("my_project");
    });

    it("replaces spaces with underscores", () => {
      expect(toPythonPackage("my project")).toBe("my_project");
    });
  });

  describe("getProjectName", () => {
    it("extracts basename from path", () => {
      expect(getProjectName("/path/to/my-project")).toBe("my-project");
    });

    it("handles relative paths", () => {
      expect(getProjectName("./my-project")).toBe("my-project");
    });

    it("handles just a name", () => {
      expect(getProjectName("my-project")).toBe("my-project");
    });
  });
});

describe("template discovery", () => {
  it("discovers templates from starters repo", async () => {
    const templates = await discoverTemplates(STARTERS_PATH);

    expect(templates).toBeInstanceOf(Array);
    expect(templates.length).toBeGreaterThan(0);

    // Check structure
    const first = templates[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("flavors");
    expect(first).toHaveProperty("path");
    expect(first.flavors).toBeInstanceOf(Array);
    expect(first.flavors.length).toBeGreaterThan(0);
  });

  it("finds agent-on-sentinel template", async () => {
    const templates = await discoverTemplates(STARTERS_PATH);
    const agentTemplate = templates.find((t) => t.id === "agent-on-sentinel");

    expect(agentTemplate).toBeDefined();
    expect(agentTemplate!.flavors).toContain("ts");
  });

  it("uses manifest metadata when available", async () => {
    const templates = await discoverTemplates(STARTERS_PATH);
    const agentTemplate = templates.find((t) => t.id === "agent-on-sentinel");

    expect(agentTemplate).toBeDefined();
    expect(agentTemplate!.name).toBe("Agent on Sentinel");
    expect(agentTemplate!.description).toContain("Starter agent");
    expect(agentTemplate!.flavorDetails?.py?.nextSteps).toContain("python3 -m venv .venv");

    const listOutput = formatTemplateList([agentTemplate!]);
    expect(listOutput).toContain("Agent on Sentinel (agent-on-sentinel)");
    expect(listOutput).toContain("Starter agent with Sentinel runtime");

    const choices = buildTemplateChoices([agentTemplate!]);
    expect(choices[0].title).toBe("Agent on Sentinel");
    expect(choices[0].description).toContain("Starter agent");
  });

  it("resolves manifest-defined next steps per flavor", async () => {
    const tsSteps = await resolveTemplateNextSteps(
      STARTERS_PATH,
      "agent-on-sentinel",
      "ts"
    );
    const pySteps = await resolveTemplateNextSteps(
      STARTERS_PATH,
      "agent-on-sentinel",
      "py"
    );

    expect(tsSteps).toContain("npm install");
    expect(pySteps).toContain("python3 -m venv .venv");
  });

  it("falls back to directory scan when manifest is missing", async () => {
    const startersPath = path.join(tempDir, "no-manifest");
    const flavorPath = path.join(startersPath, "templates", "sample-template", "ts");

    await fs.mkdir(flavorPath, { recursive: true });

    const templates = await discoverTemplates(startersPath);
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe("sample-template");
    expect(templates[0].name).toBe("sample-template");
    expect(templates[0].description).toBeUndefined();
  });

  it("warns and falls back when manifest is invalid", async () => {
    const startersPath = path.join(tempDir, "invalid-manifest");
    const templatesPath = path.join(startersPath, "templates");
    const flavorPath = path.join(templatesPath, "sample-template", "ts");

    await fs.mkdir(flavorPath, { recursive: true });
    await fs.writeFile(path.join(templatesPath, "manifest.json"), "{ invalid", "utf-8");

    let warning = "";
    const templates = await discoverTemplates(startersPath, {
      onWarning: (message) => {
        warning = message;
      },
    });

    expect(warning).toContain("Warning:");
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe("sample-template");
  });

  it("templateExists returns true for existing template", async () => {
    const exists = await templateExists(STARTERS_PATH, "agent-on-sentinel", "ts");
    expect(exists).toBe(true);
  });

  it("templateExists returns false for non-existing template", async () => {
    const exists = await templateExists(STARTERS_PATH, "non-existent", "ts");
    expect(exists).toBe(false);
  });
});

describe("project generation", () => {
  it("generates a project from template", async () => {
    const projectName = "test-generated-project";
    const targetDir = path.join(tempDir, projectName);

    await generateProject({
      targetDir,
      templateId: "agent-on-sentinel",
      flavor: "ts",
      projectName,
      startersPath: STARTERS_PATH,
      install: false,
    });

    // Check key files exist
    expect(await fse.pathExists(path.join(targetDir, "package.json"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "README.md"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "tsconfig.json"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "compose.yaml"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "src"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "src/echo-agent.ts"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, "src/client.ts"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, ".env.agent"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, ".env.client"))).toBe(true);
    expect(await fse.pathExists(path.join(targetDir, ".env.agent.template"))).toBe(false);
    expect(await fse.pathExists(path.join(targetDir, ".env.client.template"))).toBe(false);

    const gitignore = await fs.readFile(path.join(targetDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".env.agent");
    expect(gitignore).toContain(".env.client");
  });

  it("does not copy .git directory", async () => {
    const projectName = "test-no-git";
    const targetDir = path.join(tempDir, projectName);

    await generateProject({
      targetDir,
      templateId: "agent-on-sentinel",
      flavor: "ts",
      projectName,
      startersPath: STARTERS_PATH,
      install: false,
    });

    expect(await fse.pathExists(path.join(targetDir, ".git"))).toBe(false);
  });

  it("fails if target directory is not empty", async () => {
    const projectName = "test-non-empty";
    const targetDir = path.join(tempDir, projectName);

    // Create non-empty directory
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "existing.txt"), "content");

    await expect(
      generateProject({
        targetDir,
        templateId: "agent-on-sentinel",
        flavor: "ts",
        projectName,
        startersPath: STARTERS_PATH,
        install: false,
      })
    ).rejects.toThrow(/not empty/);
  });

  it("succeeds if target directory is empty", async () => {
    const projectName = "test-empty-dir";
    const targetDir = path.join(tempDir, projectName);

    // Create empty directory
    await fs.mkdir(targetDir, { recursive: true });

    await generateProject({
      targetDir,
      templateId: "agent-on-sentinel",
      flavor: "ts",
      projectName,
      startersPath: STARTERS_PATH,
      install: false,
    });

    expect(await fse.pathExists(path.join(targetDir, "package.json"))).toBe(true);
  });

  it("does not overwrite existing env files", async () => {
    const targetDir = path.join(tempDir, "test-env-no-overwrite");
    const templateDir = path.join(tempDir, "test-env-no-overwrite-template");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(templateDir, { recursive: true });

    await fs.writeFile(path.join(targetDir, ".env.agent"), "existing=keep", "utf-8");
    await fs.writeFile(path.join(templateDir, ".env.agent.template"), "existing=replace", "utf-8");
    await fs.writeFile(path.join(templateDir, ".env.client.template"), "client=created", "utf-8");

    await ensureEnvFiles(templateDir, targetDir);

    const agentEnv = await fs.readFile(path.join(targetDir, ".env.agent"), "utf-8");
    const clientEnvExists = await fse.pathExists(path.join(targetDir, ".env.client"));

    expect(agentEnv).toBe("existing=keep");
    expect(clientEnvExists).toBe(true);
  });
});

describe("placeholder substitution", () => {
  it("substitutes __PROJECT_NAME__ in files", async () => {
    const projectName = "my-awesome-project";
    const targetDir = path.join(tempDir, projectName);

    await generateProject({
      targetDir,
      templateId: "agent-on-sentinel",
      flavor: "ts",
      projectName,
      startersPath: STARTERS_PATH,
      install: false,
    });

    // Read files and check no placeholders remain
    const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf-8");
    const packageJson = await fs.readFile(path.join(targetDir, "package.json"), "utf-8");

    expect(readme).not.toContain("__PROJECT_NAME__");
    expect(packageJson).not.toContain("__PROJECT_NAME__");
    expect(readme).not.toContain("__PACKAGE_NAME__");
    expect(packageJson).not.toContain("__PACKAGE_NAME__");
  });
});
