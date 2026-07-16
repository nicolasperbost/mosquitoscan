import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Rejoindre une session — MosquitoRadar" },
      { name: "description", content: "Rejoignez une session de triangulation multi-appareils." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = useParams({ from: "/join/$code" });
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mosquito_join_code", code);
    }
    navigate({ to: "/multi", search: { code } as never, replace: true });
  }, [code, navigate]);
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-panel p-6 text-center max-w-sm">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Session</div>
        <div className="font-mono-x text-3xl text-teal tracking-[0.3em] mt-2">{code}</div>
        <p className="text-xs text-muted-foreground mt-3">Connexion à la session en cours…</p>
      </div>
    </main>
  );
}