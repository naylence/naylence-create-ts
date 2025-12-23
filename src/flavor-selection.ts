import { TemplateInfo } from "./types.js";

export type FlavorSelectionReason = "cli" | "default" | "only" | "prompt";

export interface FlavorSelectionResult {
  flavor: string;
  reason: FlavorSelectionReason;
}

export interface FlavorSelectionOptions {
  cliFlavor?: string;
  defaultFlavor: string;
  prompt?: (template: TemplateInfo) => Promise<string | null>;
}

export async function selectFlavor(
  template: TemplateInfo,
  options: FlavorSelectionOptions
): Promise<FlavorSelectionResult> {
  const { cliFlavor, defaultFlavor, prompt } = options;
  const flavors = template.flavors;

  if (!flavors || flavors.length === 0) {
    throw new Error(`Template entry missing flavors for ${template.id}`);
  }

  if (cliFlavor) {
    if (!flavors.includes(cliFlavor)) {
      const available = flavors.join(", ");
      throw new Error(
        `Flavor "${cliFlavor}" not found for template "${template.id}". ` +
          `Available flavors: ${available}.\n` +
          `Run with --list to see available templates.`
      );
    }

    return { flavor: cliFlavor, reason: "cli" };
  }

  if (flavors.includes(defaultFlavor)) {
    return { flavor: defaultFlavor, reason: "default" };
  }

  if (flavors.length === 1) {
    return { flavor: flavors[0], reason: "only" };
  }

  if (!prompt) {
    throw new Error(`Flavor selection required for template "${template.id}"`);
  }

  const selectedFlavor = await prompt(template);
  if (!selectedFlavor) {
    throw new Error("Flavor selection cancelled");
  }

  if (!flavors.includes(selectedFlavor)) {
    const available = flavors.join(", ");
    throw new Error(
      `Flavor "${selectedFlavor}" not found for template "${template.id}". ` +
        `Available flavors: ${available}.`
    );
  }

  return { flavor: selectedFlavor, reason: "prompt" };
}
