import React, { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Super-Admin" | "Technicien" | "Client_Standard" | "Auditeur_Tiers";
  status: "Actif" | "Suspendu";
  lastActive: string;
  avatarColor: string;
  createdAt: string;
}

interface AuthGateProps {
  children: React.ReactNode;
  onUserChange?: (user: User | null) => void;
}

// Preset default accounts matching the main application
export const PRESET_USERS: User[] = [
  {
    id: "u1",
    name: "Nicolas Perbost",
    email: "nicolas.perbost@gmail.com",
    role: "Super-Admin",
    status: "Actif",
    lastActive: "En ligne",
    avatarColor: "bg-teal-600 text-white",
    createdAt: "12/03/2026",
  },
  {
    id: "u2",
    name: "Sarah Jenkins",
    email: "sarah.j@compliance-corp.com",
    role: "Client_Standard",
    status: "Actif",
    lastActive: "En ligne",
    avatarColor: "bg-indigo-600 text-white",
    createdAt: "04/05/2026",
  },
  {
    id: "u3",
    name: "Thomas Vasseur",
    email: "thomas.v@terrain-pest.fr",
    role: "Technicien",
    status: "Actif",
    lastActive: "Il y a 2h",
    avatarColor: "bg-amber-600 text-white",
    createdAt: "18/06/2026",
  },
];

export default function AuthGate({ children, onUserChange }: AuthGateProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  
  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<User["role"]>("Client_Standard");
  
  // UI states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("mosquito_scan_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        if (onUserChange) onUserChange(parsed);
      } catch (e) {
        localStorage.removeItem("mosquito_scan_user");
      }
    }
    
    // Ensure initial users list is in localStorage
    if (!localStorage.getItem("mosquito_scan_users_list")) {
      localStorage.setItem("mosquito_scan_users_list", JSON.stringify(PRESET_USERS));
    }
  }, []);

  const saveUserSession = (user: User) => {
    localStorage.setItem("mosquito_scan_user", JSON.stringify(user));
    setCurrentUser(user);
    if (onUserChange) onUserChange(user);
    
    // Log the auth event
    addAuditLog("AUTH", `Connexion réussie de l'utilisateur ${user.email}`, user.email, "SUCCESS");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Find user in registered list
      const registeredUsersList = JSON.parse(localStorage.getItem("mosquito_scan_users_list") || "[]");
      const matchedUser = registeredUsersList.find((u: User) => u.email.toLowerCase() === email.toLowerCase());

      if (matchedUser) {
        if (matchedUser.status === "Suspendu") {
          setError("Ce compte a été suspendu par l'administrateur. Veuillez contacter le support.");
          setIsLoading(false);
          addAuditLog("AUTH", `Tentative de connexion bloquée (compte suspendu) : ${email}`, email, "BLOCKED");
          return;
        }

        // Simulating matching password "password" or any password for preset/demo ease
        if (password.length >= 4) {
          const updatedUser = { ...matchedUser, lastActive: "En ligne" };
          
          // Update the list with active status
          const updatedList = registeredUsersList.map((u: User) => u.id === matchedUser.id ? updatedUser : u);
          localStorage.setItem("mosquito_scan_users_list", JSON.stringify(updatedList));

          saveUserSession(updatedUser);
        } else {
          setError("Le mot de passe doit comporter au moins 4 caractères.");
          addAuditLog("AUTH", `Mot de passe incorrect pour : ${email}`, email, "WARNING");
        }
      } else {
        setError("Adresse email inconnue. Créez un compte ou utilisez l'un de nos profils préconfigurés !");
        addAuditLog("AUTH", `Échec de connexion (email inconnu) : ${email}`, email, "BLOCKED");
      }
      setIsLoading(false);
    }, 800);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name || !email || !password) {
      setError("Veuillez remplir tous les champs requis.");
      return;
    }

    if (password.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const registeredUsersList = JSON.parse(localStorage.getItem("mosquito_scan_users_list") || "[]");
      const emailExists = registeredUsersList.some((u: User) => u.email.toLowerCase() === email.toLowerCase());

      if (emailExists) {
        setError("Cette adresse email est déjà enregistrée.");
        setIsLoading(false);
        return;
      }

      // Create new user
      const colors = [
        "bg-teal-600 text-white",
        "bg-emerald-600 text-white",
        "bg-amber-600 text-white",
        "bg-pink-600 text-white",
        "bg-violet-600 text-white",
        "bg-indigo-600 text-white",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newUser: User = {
        id: "u_" + Date.now(),
        name,
        email,
        role,
        status: "Actif",
        lastActive: "En ligne",
        avatarColor: randomColor,
        createdAt: new Date().toLocaleDateString("fr-FR"),
      };

      const newList = [...registeredUsersList, newUser];
      localStorage.setItem("mosquito_scan_users_list", JSON.stringify(newList));
      
      saveUserSession(newUser);
      setSuccess("Compte créé avec succès !");
      setIsLoading(false);
      
      addAuditLog("SECURITY", `Nouvel utilisateur inscrit : ${email} avec le rôle ${role}`, email, "SUCCESS");
    }, 800);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setSuccess("Un email de réinitialisation temporaire a été envoyé (simulation).");
      setIsLoading(false);
      addAuditLog("AUTH", `Demande de réinitialisation de mot de passe pour : ${email}`, email, "SUCCESS");
    }, 1000);
  };

  const handleQuickLogin = (preset: User) => {
    setIsLoading(true);
    setError(null);
    
    setTimeout(() => {
      const registeredUsersList = JSON.parse(localStorage.getItem("mosquito_scan_users_list") || "[]");
      let matched = registeredUsersList.find((u: User) => u.email === preset.email);
      
      if (!matched) {
        matched = preset;
        registeredUsersList.push(preset);
        localStorage.setItem("mosquito_scan_users_list", JSON.stringify(registeredUsersList));
      }

      if (matched.status === "Suspendu") {
        setError(`Le compte de ${matched.name} est suspendu.`);
        setIsLoading(false);
        return;
      }

      const updatedUser = { ...matched, lastActive: "En ligne" };
      const updatedList = registeredUsersList.map((u: User) => u.id === matched.id ? updatedUser : u);
      localStorage.setItem("mosquito_scan_users_list", JSON.stringify(updatedList));

      saveUserSession(updatedUser);
      setIsLoading(false);
    }, 400);
  };

  const addAuditLog = (category: string, event: string, user: string, status: "SUCCESS" | "BLOCKED" | "WARNING") => {
    try {
      const logs = JSON.parse(localStorage.getItem("mosquito_scan_audit_logs") || "[]");
      const newLog = {
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toLocaleString("fr-FR"),
        event,
        category,
        user,
        ip: "192.168.1." + Math.floor(Math.random() * 254),
        status,
        signature: "sha256-" + Math.random().toString(16).substr(2, 8) + "...",
      };
      localStorage.setItem("mosquito_scan_audit_logs", JSON.stringify([newLog, ...logs].slice(0, 50)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      addAuditLog("AUTH", `Déconnexion de l'utilisateur ${currentUser.email}`, currentUser.email, "SUCCESS");
      
      try {
        const registeredUsersList = JSON.parse(localStorage.getItem("mosquito_scan_users_list") || "[]");
        const updatedList = registeredUsersList.map((u: User) => {
          if (u.id === currentUser.id) {
            return { ...u, lastActive: "Il y a quelques secondes" };
          }
          return u;
        });
        localStorage.setItem("mosquito_scan_users_list", JSON.stringify(updatedList));
      } catch (e) {}
    }
    localStorage.removeItem("mosquito_scan_user");
    setCurrentUser(null);
    if (onUserChange) onUserChange(null);
  };

  if (currentUser) {
    return (
      <AuthContext.Provider value={{ currentUser, logout: handleLogout, setCurrentUser, addAuditLog }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden text-slate-100 font-sans">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-md w-full space-y-6 relative z-10">
        
        {/* LOGO */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-teal-600/30">
            <LucideIcons.ShieldAlert className="w-6 h-6 text-teal-100" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            MosquitoScan™ Pro
            <span className="text-[10px] bg-teal-950 text-teal-400 font-bold px-2 py-0.5 rounded border border-teal-900/50">
              PRO
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Portail de diagnostic de bio-vigilance acoustique
          </p>
        </div>

        {/* AUTH CARD */}
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 p-6 rounded-2xl shadow-2xl space-y-6">
          
          {/* Header tabs inside card */}
          <div className="flex border-b border-slate-700/60 pb-1">
            <button
              onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
              className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                mode === "login" ? "border-teal-500 text-teal-400" : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
              className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                mode === "signup" ? "border-teal-500 text-teal-400" : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              Créer un Compte
            </button>
          </div>

          {/* Form alert states */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2 leading-relaxed">
              <LucideIcons.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2 leading-relaxed">
              <LucideIcons.CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* LOGIN MODE */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">Adresse Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nicolas.perbost@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-300 block">Mot de Passe</label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[10px] text-teal-400 hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/10 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <LucideIcons.Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <LucideIcons.LogIn className="w-4 h-4" />
                )}
                Se connecter
              </button>
            </form>
          )}

          {/* SIGNUP MODE */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">Nom complet</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">Adresse Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean.dupont@corp.com"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">Rôle assigné (Simulé)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Shield className="w-4 h-4" />
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-teal-500 transition-all appearance-none"
                  >
                    <option value="Client_Standard">Client Standard (Maquettes & Simulations)</option>
                    <option value="Technicien">Technicien Terrain (Capteurs IoT & Alarmes)</option>
                    <option value="Auditeur_Tiers">Auditeur Tiers (Génération de rapports ZIP)</option>
                    <option value="Super-Admin">Super-Admin (Console & Gestion complète)</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 pointer-events-none">
                    <LucideIcons.ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">Mot de Passe</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/10 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <LucideIcons.Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <LucideIcons.UserPlus className="w-4 h-4" />
                )}
                S'inscrire et démarrer
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Saisissez votre email. Nous vous enverrons un lien temporaire pour simuler la réinitialisation de votre accès.
                </p>
                <label className="text-[11px] font-bold text-slate-300 block">Adresse Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <LucideIcons.Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nicolas.perbost@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all text-center"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && <LucideIcons.Loader className="w-4 h-4 animate-spin" />}
                  Réinitialiser
                </button>
              </div>
            </form>
          )}

          {/* QUICK PRESET LOGINS SECTION */}
          <div className="pt-4 border-t border-slate-700/60 text-center space-y-3">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
              ⚡ Connexion Rapide (Profils Tests)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickLogin(user)}
                  className="w-full bg-slate-900/60 border border-slate-700/30 hover:border-teal-500/50 hover:bg-slate-900 p-2.5 rounded-xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${user.avatarColor} flex items-center justify-center text-[10px] font-bold font-mono shadow-sm`}>
                      {user.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-slate-200 group-hover:text-white transition-colors">{user.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider text-slate-300 border border-slate-700/40 bg-slate-800`}>
                      {user.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Outer credit info */}
        <p className="text-center text-[10px] text-slate-500">
          Système autonome • Les modifications de profils et d'accès sont mémorisées localement.
        </p>

      </div>
    </div>
  );
}

// Global Context hook so components can retrieve and call auth functions
export const AuthContext = React.createContext<{
  currentUser: User;
  logout: () => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  addAuditLog: (category: string, event: string, user: string, status: "SUCCESS" | "BLOCKED" | "WARNING") => void;
} | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthGate provider");
  }
  return context;
}
