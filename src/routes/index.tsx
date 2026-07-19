import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Building2, Wifi, HardDrive, Waves, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// CORRECTIF (lot 6) : nouvelle page d'accueil publique, accessible sans
// connexion — remplace le tableau de bord pro (mockData + fausse
// authentification) qui occupait "/" auparavant. Le vrai tableau de bord
// pro reste sur /pro (lot 5), réservé aux comptes connectés.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MosquitoRadar — Détection acoustique de moustiques" },
      { name: "description", content: "Analyse acoustique en temps réel pour détecter et localiser les moustiques. Gratuit pour un usage personnel, tableau de bord multi-sites pour les professionnels." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <main className="min-h-screen px-4 pt-10 pb-16 max-w-md mx-auto">
      {/* Hero */}
      <section className="text-center mb-10">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "rgba(0,229,195,0.12)", boxShadow: "0 0 32px var(--teal-glow)" }}
        >
          <Radio size={28} className="text-teal" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">MosquitoRadar</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Détection acoustique de moustiques par analyse du battement d'ailes — avec le micro de votre téléphone,
          ou des capteurs dédiés pour un suivi continu.
        </p>
      </section>

      {/* Two paths */}
      <section className="space-y-3 mb-10">
        <Link to="/detection" className="glass-panel p-4 flex items-center gap-3 hover:border-teal transition-colors block">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,229,195,0.1)" }}>
            <Radio size={18} className="text-teal" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm">Essayer gratuitement</div>
            <div className="text-[11px] text-muted-foreground">Détection avec le micro de votre téléphone, aucun compte requis</div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
        </Link>

        <Link to="/account" className="glass-panel p-4 flex items-center gap-3 hover:border-teal transition-colors block">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,229,195,0.1)" }}>
            <Building2 size={18} className="text-teal" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm">
              {!loading && user ? "Accéder à mon espace pro" : "Espace professionnel"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {!loading && user ? "Connecté — ouvrir le tableau de bord" : "Multi-sites, zones à risque, rapports — hôtellerie, camping, dératisation"}
            </div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
        </Link>
      </section>

      {/* Feature highlights */}
      <section className="space-y-4 mb-10">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">Comment ça marche</div>
        <div className="grid grid-cols-1 gap-3">
          {[
            { Icon: Waves, title: "Analyse spectrale en temps réel", desc: "Le battement d'ailes d'un moustique a une signature de fréquence reconnaissable — l'app l'isole du bruit ambiant." },
            { Icon: Wifi, title: "Capteurs fixes optionnels", desc: "Couplez un micro externe ou un capteur WiFi pour une surveillance continue, sans dépendre d'un téléphone." },
            { Icon: HardDrive, title: "Import de relevés autonomes", desc: "Importez les enregistrements d'un boîtier logger posé en zone isolée, pour analyse différée." },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="glass-panel p-3 flex gap-3">
              <Icon size={18} className="text-teal shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-display">{title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Honest positioning — no overclaiming */}
      <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
        MosquitoRadar est un outil d'aide à la détection et à la localisation acoustique.
        Il ne constitue pas un diagnostic sanitaire ni un certificat de conformité réglementaire.
      </p>
    </main>
  );
}
