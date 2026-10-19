import type { ReactNode } from 'react';
import '../src/style.css';

export const metadata = {
  title: 'Minutes — Meeting review & follow-ups',
  description: 'Connect your Zoom meetings, review source documents, and track evidence-backed follow-ups.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
