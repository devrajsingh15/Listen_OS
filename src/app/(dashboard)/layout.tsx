import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Theme } from "@radix-ui/themes";
import { SettingsProvider } from "@/context/SettingsContext";
import { ToastProvider } from "@/context/ToastContext";
import { ErrorNotification } from "@/components/ErrorNotification";
import "../globals.css";

export const metadata: Metadata = {
  title: "ListenOS - AI Productivity Assistant",
  description: "Your AI-powered voice productivity assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-background font-sans text-foreground antialiased">
        <SettingsProvider>
          <ToastProvider>
            <Theme appearance="inherit" accentColor="gray" grayColor="gray" radius="medium">
              {children}
              <ErrorNotification />
            </Theme>
          </ToastProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
