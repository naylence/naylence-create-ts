import { describe, it, expect, vi } from "vitest";
import { selectFlavor } from "../src/flavor-selection.js";
import type { TemplateInfo } from "../src/types.js";

function buildTemplate(id: string, flavors: string[]): TemplateInfo {
  return {
    id,
    flavors,
    path: `/tmp/${id}`,
  };
}

describe("selectFlavor", () => {
  it("defaults to ts when available without prompting", async () => {
    const template = buildTemplate("sample", ["ts", "py"]);
    const prompt = vi.fn(async () => "py");

    const result = await selectFlavor(template, {
      defaultFlavor: "ts",
      prompt,
    });

    expect(result.flavor).toBe("ts");
    expect(result.reason).toBe("default");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("auto-selects the only available flavor", async () => {
    const template = buildTemplate("sample", ["py"]);
    const prompt = vi.fn(async () => "py");

    const result = await selectFlavor(template, {
      defaultFlavor: "ts",
      prompt,
    });

    expect(result.flavor).toBe("py");
    expect(result.reason).toBe("only");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("prompts when multiple flavors exist and ts is unavailable", async () => {
    const template = buildTemplate("sample", ["py", "go"]);
    const prompt = vi.fn(async () => "py");

    const result = await selectFlavor(template, {
      defaultFlavor: "ts",
      prompt,
    });

    expect(result.flavor).toBe("py");
    expect(result.reason).toBe("prompt");
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("respects --flavor overrides when provided", async () => {
    const template = buildTemplate("sample", ["ts", "py"]);
    const prompt = vi.fn(async () => "ts");

    const result = await selectFlavor(template, {
      defaultFlavor: "ts",
      cliFlavor: "py",
      prompt,
    });

    expect(result.flavor).toBe("py");
    expect(result.reason).toBe("cli");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("errors when --flavor is unavailable", async () => {
    const template = buildTemplate("sample", ["ts"]);

    await expect(
      selectFlavor(template, {
        defaultFlavor: "ts",
        cliFlavor: "py",
      })
    ).rejects.toThrow(/--list/);
  });
});
