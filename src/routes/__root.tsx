import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { TeamProvider } from "@/lib/team-context";
import { Toaster } from "@/components/ui/sonner";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sivua ei löytynyt</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Etsimääsi sivua ei ole olemassa tai se on siirretty.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Etusivulle
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Birdie — Pidä kirjaa golfkaudestasi" },
      {
        name: "description",
        content: "Pidä kirjaa birdieistä, eagleista ja holareista golfporukkasi kanssa.",
      },
      { name: "author", content: "Birdie" },
      { property: "og:title", content: "Birdie — Pidä kirjaa golfkaudestasi" },
      {
        property: "og:description",
        content: "Pidä kirjaa birdieistä, eagleista ja holareista golfporukkasi kanssa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Birdie" },
      { name: "theme-color", content: "#0b0f0a" },
      { name: "twitter:title", content: "Birdie — Pidä kirjaa golfkaudestasi" },
      {
        name: "twitter:description",
        content: "Pidä kirjaa birdieistä, eagleista ja holareista golfporukkasi kanssa.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/NltAKmeaw2M0vQ4utZe49nsxRds1/social-images/social-1777035571831-Gemini_Generated_Image_kmwq8gkmwq8gkmwq.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/NltAKmeaw2M0vQ4utZe49nsxRds1/social-images/social-1777035571831-Gemini_Generated_Image_kmwq8gkmwq8gkmwq.webp",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://cdn.gpteng.co", crossOrigin: "anonymous" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <TeamProvider>
        <Outlet />
        <InstallPromptEventBridge />
        <Toaster />
      </TeamProvider>
    </AuthProvider>
  );
}

function InstallPromptEventBridge() {
  useInstallPrompt();
  return null;
}
