import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PostHogProvider, PostHogPageView } from "@/components/providers/PostHogProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "SkyGen | Motion graphics studio",
  description: "Create, refine, and export motion graphics in SkyGen. An AI video workspace with editable scenes and reusable templates.",
  keywords: ["SkyGen", "motion graphics", "AI video", "video editor"],
  authors: [{ name: "saleem" }],
  icons: {
    icon: "/logo.png",
  },

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={"antialiased bg-background text-foreground"}
      >
        <PostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SessionProvider>
              <Suspense fallback={null}>
                <PostHogPageView />
              </Suspense>
              {children}
              <Toaster />
            </SessionProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
