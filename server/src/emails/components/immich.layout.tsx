import * as React from 'react';
import { Body, Container, Head, Hr, Html, Preview, Section, Tailwind, Text } from 'react-email';
// @ts-expect-error
import tailwindPresetEmail from 'tailwindcss-preset-email';
import { ImmichFooter } from 'src/emails/components/footer.template.js';

interface ImmichLayoutProps {
  children: React.ReactNode;
  preview: string;
}

export const ImmichLayout = ({ children, preview }: ImmichLayoutProps) => (
  <Html>
    <Tailwind
      config={{
        presets: [tailwindPresetEmail],
        theme: {
          extend: {
            colors: {
              // Light Theme
              'immich-primary': '#00aeb5',
              'immich-bg': 'white',
              'immich-fg': 'black',
              'immich-gray': '#F6F6F4',
              'immich-footer': '#6A737D',
            },
            fontFamily: {
              sans: ['Overpass', 'sans-serif'],
              mono: ['Overpass Mono', 'monospace'],
            },
          },
        },
      }}
    >
      <Head />
      <Preview>{preview}</Preview>
      <Body className="bg-[#F4F4f4] my-auto mx-auto px-2 font-sans text-base text-gray-800">
        <Container className="my-[40px] mx-auto max-w-[465px]">
          <Section className="my-6 p-12 border border-red-400 rounded-[50px] bg-gray-50">
            <Section className="flex justify-center mb-12">
              <Text className="m-0 text-4xl font-bold text-immich-primary">S&amp;AN</Text>
            </Section>

            {children}
          </Section>

          <Hr className="my-2 text-immich-gray" />

          <ImmichFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

ImmichLayout.PreviewProps = {
  preview: 'This is the preview shown on some mail clients',
  children: <Text>Email body goes here.</Text>,
} as ImmichLayoutProps;

export default ImmichLayout;
