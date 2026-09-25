import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./style.css";
import { workspaceFromPath, workspaces } from "./workspace";

const workspace = workspaceFromPath(window.location.pathname) ?? "control";
document.title = `NER LENS · ${workspaces[workspace].name}`;
const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? document.createElement("link");
manifest.rel = "manifest";
manifest.href = `/${workspace}.webmanifest`;
if (!manifest.isConnected) document.head.append(manifest);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: 1}}})}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
