import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Everroot | Family memories, carried forward',
  description: 'A warm digital family archive that turns remembered voices into stories, letters and shared legacy.',
  openGraph: { title: 'Everroot', description: 'Family memories, carried forward', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Everroot', description: 'Family memories, carried forward', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
