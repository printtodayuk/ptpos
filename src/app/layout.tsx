import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});

const sourceCodePro = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro' });

export const metadata: Metadata = {
  title: 'Print Today EPOS',
  description: 'EPOS system for Print Today by RemotizedIT',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${sourceCodePro.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}