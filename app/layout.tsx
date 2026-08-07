import type { Metadata } from 'next';

import { PostHogProvider } from '@/components/PostHogProvider';

import './globals.css';

export const metadata: Metadata = {
  title: 'terminal v.01',
  description:
    "Seth Wood's resume, projects, and about page, served as a CRT terminal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider />
        {children}
      </body>
    </html>
  );
}
