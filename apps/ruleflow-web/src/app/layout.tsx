import './globals.css';
import { Manrope, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'RuleFlow Platform',
  description: 'Enterprise-grade headless UI + Flow + Rules platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${manrope.variable} ${jetbrains.variable}`}>
        <ThemeProvider defaultTheme="system">
          <ToastProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <OnboardingProvider>
                <AppShell>{children}</AppShell>
              </OnboardingProvider>
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
