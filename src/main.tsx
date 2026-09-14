import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: 1}}})}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
