import type { Meta, StoryObj } from '@storybook/react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';
import { Button } from './button';

const meta: Meta<typeof Drawer> = {
  title: 'Primitives/Drawer',
  component: Drawer,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Drawer>;

export const Basic: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Issue details</DrawerTitle>
          <DrawerDescription>
            Inspect and edit an issue without leaving the board.
          </DrawerDescription>
        </DrawerHeader>
        <div className="mt-2 flex flex-col gap-2 text-sm text-fg-secondary">
          <p>Drawer body. Real fields ship in CEN-13.</p>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};
