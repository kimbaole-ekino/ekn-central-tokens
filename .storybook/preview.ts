import type { Preview } from "@storybook/html-vite";
import "../storybook/token-guide.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    options: {
      storySort: {
        order: [
          "Overview",
          "Token Sets",
          "Themes and Theme Groups",
          "Colors",
          "Typography",
          "Spacing and sizing",
          "Radius and borders",
          "Shadows and opacity",
          "Aliases",
          "Developer usage",
        ],
      },
    },
  },
};

export default preview;
