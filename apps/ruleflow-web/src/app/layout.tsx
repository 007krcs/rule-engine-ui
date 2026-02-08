import './globals.css';
import { Manrope, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'RuleFlow Platform',
  description: 'Enterprise-grade headless UI + Flow + Rules platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${manrope.variable} ${jetbrains.variable} bg-background text-foreground`}>
        <ThemeProvider defaultTheme="system">
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

