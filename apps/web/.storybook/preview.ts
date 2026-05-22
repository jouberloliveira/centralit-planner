import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: '#F7F8FA' },
        { name: 'raised', value: '#FFFFFF' },
        { name: 'dark', value: '#0B1220' },
      ],
    },
  },
};

export default preview;
