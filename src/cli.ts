/**
 * naylence-create CLI - scaffold Naylence starter templates.
 *
 * Usage:
 *   naylence-create <target-dir>                    # Interactive mode
 *   naylence-create <target-dir> --template <id>   # Non-interactive
 *   naylence-create --list                          # List templates
 */
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import path from "node:path";
import {
  buildTemplateChoices,
  buildFlavorChoices,
  discoverTemplates,
  formatTemplateList,
  resolveTemplateNextSteps,
  templateExists,
} from "./templates.js";
import { selectFlavor } from "./flavor-selection.js";
import { generateProject, runInstall } from "./generator.js";
import { fetchFromGithub, cleanupTempDir } from "./github.js";
import {
  getProjectName,
  resolveGitRef,
  resolveGithubRepo,
  resolveStartersPath,
} from "./utils.js";
import { DEFAULT_FLAVOR, GeneratorOptions } from "./types.js";

const VERSION = "0.1.0";

interface CliOptions {
  template?: string;
  flavor?: string;
  list: boolean;
  install: boolean;
  noInstall: boolean;
  fromLocal: boolean;
  fromGithub: boolean;
  ref?: string;
  startersPath?: string;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("naylence-create")
    .description("Scaffold a new Naylence project from a starter template")
    .version(VERSION)
    .argument("[target-dir]", "Directory to create the project in")
    .option("-t, --template <id>", "Template ID (e.g., agent-on-sentinel)")
    .option("-f, --flavor <flavor>", "Template flavor (ts, py, poly)")
    .option("-l, --list", "List available templates and exit", false)
    .option("--install", "Run package manager install after generation", false)
    .option("--no-install", "Skip package manager install (default)")
    .option("--from-local", "Force reading templates from local path", false)
    .option("--from-github", "Force fetching templates from GitHub", false)
    .option("--ref <ref>", "Git ref (tag/branch/sha) for GitHub fetch")
    .option("--starters-path <path>", "Path to local starters repo")
    .action(async (targetDir: string | undefined, options: CliOptions) => {
      try {
        await run(targetDir, options);
      } catch (error) {
        console.error(pc.red(`\nError: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  await program.parseAsync();
}

async function run(targetDir: string | undefined, options: CliOptions): Promise<void> {
  // Determine template source
  const source = await resolveTemplateSource(options);
  let startersPath: string;
  let shouldCleanup = false;

  if (source.type === "github") {
    startersPath = await fetchFromGithub(source.repo, source.ref);
    shouldCleanup = true;
  } else {
    startersPath = source.path;
  }

  try {
    // Handle --list
    if (options.list) {
      await listTemplates(startersPath);
      return;
    }

    // Require target directory
    if (!targetDir) {
      console.error(pc.red("Error: Target directory is required"));
      console.log("\nUsage: naylence-create <target-dir> [options]");
      console.log("       naylence-create --list");
      process.exit(1);
    }

    // Get template and flavor
    const { templateId, flavor } = await resolveTemplateAndFlavor(
      startersPath,
      options.template,
      options.flavor
    );

    // Validate template exists
    const exists = await templateExists(startersPath, templateId, flavor);
    if (!exists) {
      throw new Error(
        `Template not found: ${templateId}/${flavor}\n` +
          `Run with --list to see available templates.`
      );
    }

    // Get project name
    const projectName = getProjectName(targetDir);

    // Generate project
    const genOptions: GeneratorOptions = {
      targetDir,
      templateId,
      flavor,
      projectName,
      startersPath,
      install: options.install && !options.noInstall,
    };

    await generateProject(genOptions);

    // Optional: run install
    if (genOptions.install) {
      await runInstall(path.resolve(targetDir));
    }

    // Print next steps
    const manifestNextSteps = await resolveTemplateNextSteps(
      startersPath,
      templateId,
      flavor
    );
    printNextSteps(targetDir, genOptions.install, manifestNextSteps);
  } finally {
    // Clean up temp directory if we fetched from GitHub
    if (shouldCleanup) {
      await cleanupTempDir(startersPath);
    }
  }
}

interface ResolvedSource {
  type: "local" | "github";
  path: string;
  repo: string;
  ref: string;
}

async function resolveTemplateSource(options: CliOptions): Promise<ResolvedSource> {
  const localPath = resolveStartersPath(options.startersPath);
  const githubRepo = resolveGithubRepo();
  const gitRef = resolveGitRef(options.ref);

  // Explicit flags take precedence
  if (options.fromLocal) {
    if (!localPath) {
      throw new Error(
        "--from-local requires NAYLENCE_STARTERS_PATH env var or --starters-path"
      );
    }
    return { type: "local", path: localPath, repo: githubRepo, ref: gitRef };
  }

  if (options.fromGithub) {
    return { type: "github", path: "", repo: githubRepo, ref: gitRef };
  }

  // Default: prefer local if available
  if (localPath) {
    console.log(pc.dim(`Using local starters: ${localPath}`));
    return { type: "local", path: localPath, repo: githubRepo, ref: gitRef };
  }

  // Fall back to GitHub
  return { type: "github", path: "", repo: githubRepo, ref: gitRef };
}

async function listTemplates(startersPath: string): Promise<void> {
  const templates = await discoverTemplates(startersPath, {
    onWarning: (message) => console.warn(pc.yellow(message)),
  });
  console.log(formatTemplateList(templates));
}

async function resolveTemplateAndFlavor(
  startersPath: string,
  cliTemplate?: string,
  cliFlavor?: string
): Promise<{ templateId: string; flavor: string }> {
  const templates = await discoverTemplates(startersPath, {
    onWarning: (message) => console.warn(pc.yellow(message)),
  });

  if (templates.length === 0) {
    throw new Error("No templates found in starters repo");
  }

  const promptForFlavor = async (templateId: string, choices: { title: string; value: string }[]) => {
    const response = await prompts({
      type: "select",
      name: "flavor",
      message: "Select a flavor:",
      choices,
    });

    if (!response.flavor) {
      throw new Error("Flavor selection cancelled");
    }

    return response.flavor as string;
  };

  const resolveFlavor = async (selectedTemplateId: string) => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (!selectedTemplate) {
      throw new Error(
        `Template not found: ${selectedTemplateId}\n` +
          `Run with --list to see available templates.`
      );
    }

    const selection = await selectFlavor(selectedTemplate, {
      cliFlavor,
      defaultFlavor: DEFAULT_FLAVOR,
      prompt: async (template) =>
        promptForFlavor(template.id, buildFlavorChoices(template)),
    });

    if (selection.reason === "default" && selectedTemplate.flavors.length > 1) {
      console.log(pc.dim(`Using flavor: ${selection.flavor}`));
    }

    return selection.flavor;
  };

  if (cliTemplate) {
    return {
      templateId: cliTemplate,
      flavor: await resolveFlavor(cliTemplate),
    };
  }

  // Interactive mode
  const templateResponse = await prompts({
    type: "select",
    name: "templateId",
    message: "Select a template:",
    choices: buildTemplateChoices(templates),
  });

  if (!templateResponse.templateId) {
    throw new Error("Template selection cancelled");
  }

  return {
    templateId: templateResponse.templateId,
    flavor: await resolveFlavor(templateResponse.templateId),
  };
}

function printNextSteps(
  targetDir: string,
  installed: boolean,
  nextSteps: string[] | null
): void {
  console.log("Next steps:\n");
  console.log(`  cd ${targetDir}`);

  if (nextSteps && nextSteps.length > 0) {
    for (const step of nextSteps) {
      console.log(`  ${step}`);
    }
    console.log("");
    return;
  }

  if (!installed) {
    console.log("  npm install");
  }

  console.log("  npm run build");
  console.log("  npm run dev");
  console.log("");
}

// Run CLI
main().catch((error) => {
  console.error(pc.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
