/**
 * GitHub template fetching - download and extract templates from GitHub.
 */
import fs from "node:fs/promises";
import fse from "fs-extra";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { extract } from "tar";
import pc from "picocolors";

/**
 * Fetch templates from GitHub and extract to a temporary directory.
 * Returns the path to the extracted starters root.
 */
export async function fetchFromGithub(repo: string, ref: string): Promise<string> {
  const tarballUrl = `https://github.com/${repo}/archive/${ref}.tar.gz`;

  console.log(pc.cyan(`Fetching templates from ${repo}@${ref}...`));

  // Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "naylence-starters-"));
  const tarballPath = path.join(tempDir, "starters.tar.gz");

  try {
    // Download tarball
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch from GitHub: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body from GitHub");
    }

    // Save to file using streams
    const fileStream = createWriteStream(tarballPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pipeline(response.body as any, fileStream);

    // Extract tarball
    const extractDir = path.join(tempDir, "extracted");
    await fs.mkdir(extractDir);

    await extract({
      file: tarballPath,
      cwd: extractDir,
    });

    // Find the extracted directory (GitHub adds repo-ref prefix)
    const contents = await fs.readdir(extractDir);
    if (contents.length !== 1) {
      throw new Error("Unexpected tarball structure");
    }

    const startersRoot = path.join(extractDir, contents[0]);

    // Verify templates directory exists
    const templatesDir = path.join(startersRoot, "templates");
    try {
      await fs.access(templatesDir);
    } catch {
      throw new Error(`No templates directory found in ${repo}@${ref}`);
    }

    console.log(pc.green("✓ Templates fetched successfully"));
    return startersRoot;
  } catch (error) {
    // Clean up on error
    await fse.remove(tempDir).catch(() => {});
    throw error;
  }
}

/**
 * Clean up temporary directory after generation.
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    // Only remove if it's in the temp directory
    if (tempDir.startsWith(os.tmpdir())) {
      await fse.remove(tempDir);
    }
  } catch {
    // Ignore cleanup errors
  }
}
