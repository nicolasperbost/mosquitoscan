import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChevronLeft, Cloud, CloudOff, LogOut, Mail, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Compte — MosquitoRadar" },
      { name: "description", content: "Connectez-vous pour synchroniser votre historique de détections entre vos appareils." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading, signIn, signUp, signOut, resetPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Renseigne un email et un mot de passe");
      return;
    }
    setSubmitting(true);
    const { error } = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === "signup") {
      toast.success("Compte créé — vérifie ta boîte mail si une confirmation est requise.");
    } else {
      toast.success("Connecté — synchronisation en cours…");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Renseigne ton email");
      return;
    }
    setSubmitting(true);
    const { error } = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setResetSent(true);
  };

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Compte</h1>
        <span />
      </header>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Chargement…</div>
      ) : user ? (
        <section className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={16} className="text-teal" />
            <span className="font-display text-sm">Synchronisation active</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-1">Connecté en tant que</p>
          <p className="text-sm font-mono-x mb-4">{user.email}</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            Ton historique de détections et ta pièce configurée sont synchronisés avec ce compte —
            accessibles depuis n'importe quel appareil où tu te connectes.
          </p>
          <button
            onClick={async () => {
              await signOut();
              toast("Déconnecté — les données restent disponibles localement sur cet appareil.");
            }}
            className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"
          >
            <LogOut size={14} /> Se déconnecter
          </button>
        </section>
      ) : mode === "forgot" ? (
        <>
          <button
            onClick={() => { setMode("signin"); setResetSent(false); }}
            className="text-muted-foreground hover:text-teal flex items-center gap-1 text-xs mb-4"
          >
            <ArrowLeft size={14} /> Retour à la connexion
          </button>

          {resetSent ? (
            <section className="glass-panel p-4 text-center">
              <Mail size={24} className="mx-auto text-teal mb-3" />
              <p className="text-sm font-display mb-2">Email envoyé</p>
              <p className="text-[11px] text-muted-foreground">
                Si un compte existe pour <strong className="text-foreground">{email}</strong>, un lien de réinitialisation
                vient d'être envoyé. Clique dessus pour choisir un nouveau mot de passe.
              </p>
            </section>
          ) : (
            <form onSubmit={handleForgotSubmit} className="glass-panel p-4 space-y-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                Renseigne l'email de ton compte — on t'envoie un lien pour choisir un nouveau mot de passe.
              </p>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Mail size={11} /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border rounded-md px-3 py-2 text-sm mt-1"
                  style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
                {submitting ? "…" : "Envoyer le lien"}
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <section
            className="rounded-lg p-3 mb-4 text-[11px] flex gap-2 items-start"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <CloudOff size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Sans compte, l'app fonctionne normalement mais tes données restent uniquement sur cet appareil.
              Connecte-toi pour les synchroniser et les retrouver ailleurs.
            </span>
          </section>

          <div className="flex gap-1 mb-4 glass-panel p-1 text-[11px]">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-1.5 rounded-md transition font-display"
                style={{
                  background: mode === m ? "var(--teal)" : "transparent",
                  color: mode === m ? "#0A0F1E" : "var(--muted-foreground)",
                }}
              >
                {m === "signin" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="glass-panel p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Mail size={11} /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border rounded-md px-3 py-2 text-sm mt-1"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Lock size={11} /> Mot de passe
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setResetSent(false); }}
                    className="text-[10px] text-teal hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border rounded-md px-3 py-2 text-sm mt-1"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
              {submitting ? "…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </>
      )}

      <BottomNav />
    </main>
  );
}
