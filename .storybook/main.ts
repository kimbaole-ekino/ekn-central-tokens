import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
  stories: ["../storybook/*.stories.ts"],
  framework: { name: "@storybook/html-vite", options: {} },
};

export default config;
