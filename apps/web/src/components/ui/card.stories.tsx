import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Basic: Story = {
  render: () => (
    <Card className="w-[320px]">
      <CardHeader>
        <CardTitle>Issue card</CardTitle>
        <CardDescription>Short description of an issue.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-fg-secondary">Body content lives here.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="secondary">
          Open
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const TypeAccent: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Card className="w-[320px] border-l-[3px] border-l-type-epic">
        <CardHeader>
          <CardTitle>Epic</CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-[320px] border-l-[3px] border-l-type-feature">
        <CardHeader>
          <CardTitle>Feature</CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-[320px] border-l-[3px] border-l-type-story">
        <CardHeader>
          <CardTitle>Story</CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-[320px] border-l-[3px] border-l-type-task">
        <CardHeader>
          <CardTitle>Task</CardTitle>
        </CardHeader>
      </Card>
    </div>
  ),
};
