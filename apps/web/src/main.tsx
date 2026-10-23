import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { useProgress } from "./lib/queries";
import { Spinner, Toasts } from "./components/Layout";
import { Title } from "./screens/Title";
import { Register } from "./screens/Register";
import { HowToPlay } from "./screens/HowToPlay";
import { Rules } from "./screens/Rules";
import { PreRound } from "./screens/PreRound";
import { Round } from "./screens/Round";
import { Report } from "./screens/Report";
import { Review } from "./screens/Review";
import { Total } from "./screens/Total";

// The console is route-split so players never download it (§4).
const Manager = lazy(() => import("./manager/Manager"));

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function Player({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useProgress();
  if (isLoading) return <Spinner />;
  if (!data?.registered) return <Navigate to="/register" replace />;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Title />} />
          <Route path="/register" element={<Register />} />
          <Route path="/how-to-play" element={<Player><HowToPlay /></Player>} />
          <Route path="/rules" element={<Player><Rules /></Player>} />
          <Route path="/play/:key" element={<Player><PreRound /></Player>} />
          <Route path="/round/:id" element={<Player><Round /></Player>} />
          <Route path="/report/:id" element={<Player><Report /></Player>} />
          <Route path="/review/:id" element={<Player><Review /></Player>} />
          <Route path="/total" element={<Player><Total /></Player>} />
          <Route path="/manager/*" element={<Suspense fallback={<Spinner />}><Manager /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
