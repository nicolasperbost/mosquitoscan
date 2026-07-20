import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Lock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Page atteinte en cliquant le lien reçu par email suite à "Mot de passe
// oublié" (voir resetPassword() dans useAuth.ts). Supabase, en suivant ce
// lien, établit automatiquement une session de récupération temporaire
// (visible via onAuthStateChange côté useAuth, événement "PASSWORD_RECOVERY"
// — non géré explicitement ici puisque useAuth expose déjà `user` dès que
// la session existe, récupération ou non). Cette page se contente de
// proposer un nouveau mot de passe et appelle updateUser() dessus.

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — MosquitoRadar" },
      { name: "description", content: "Choisis un nouveau mot de passe pour ton compte MosquitoRadar." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDone(true);
    toast.success("Mot de passe mis à jour");
    setTimeout(() => navigate({ to: "/account" }), 1800);
  };

  return (
    <main className="min-h-screen pb-32 px-4 pt-6 max-w-md mx-auto">
      <header className="grid grid-cols-3 items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-teal flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> Accueil
        </Link>
        <h1 className="text-base font-display font-semibold text-center">Nouveau mot de passe</h1>
        <span />
      </header>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Chargement…</div>
      ) : !user ? (
        <section className="glass-panel p-4 text-center">
          <p className="text-sm font-display mb-2">Lien invalide ou expiré</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            Ce lien de réinitialisation n'est plus valide. Redemande un nouveau lien depuis la page de connexion.
          </p>
          <Link to="/account" className="btn-primary inline-block text-sm">Retour à la connexion</Link>
        </section>
      ) : done ? (
        <section className="glass-panel p-4 text-center">
          <CheckCircle2 size={24} className="mx-auto text-teal mb-3" />
          <p className="text-sm font-display">Mot de passe mis à jour</p>
          <p className="text-[11px] text-muted-foreground mt-1">Redirection…</p>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground mb-1">Choisis un nouveau mot de passe pour ton compte.</p>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lock size={11} /> Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border rounded-md px-3 py-2 text-sm mt-1"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
              autoComplete="new-password"
              minLength={6}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lock size={11} /> Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-transparent border rounded-md px-3 py-2 text-sm mt-1"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
            {submitting ? "…" : "Mettre à jour le mot de passe"}
          </button>
        </form>
      )}
    </main>
  );
}
