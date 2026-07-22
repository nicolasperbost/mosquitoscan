// Limite d'essai gratuit pour les utilisateurs SANS compte : 3 sessions
// d'écoute, puis blocage total tant qu'ils ne créent pas de compte.
//
// ⚠️ HONNÊTETÉ TECHNIQUE : c'est une limite côté client (localStorage), pas
// une vraie barrière de sécurité. Elle décourage l'usage informel répété
// (le cas courant : quelqu'un qui utilise l'app normalement), mais quelqu'un
// de déterminé peut la contourner en vidant son cache, en passant en
// navigation privée, ou en changeant de navigateur — il n'y a aucune
// identification d'appareil ni de compte tant qu'aucun compte n'est créé.
// C'est un frein, pas un mur. Une vraie limite anti-contournement
// nécessiterait une identification serveur (IP, empreinte d'appareil), hors
// périmètre de ce correctif.

const STORAGE_KEY = "mosquito_trial_sessions_used";
export const TRIAL_SESSION_LIMIT = 3;

export function getTrialSessionsUsed(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function getTrialSessionsRemaining(): number {
  return Math.max(0, TRIAL_SESSION_LIMIT - getTrialSessionsUsed());
}

export function hasTrialRemaining(): boolean {
  return getTrialSessionsUsed() < TRIAL_SESSION_LIMIT;
}

/** À appeler une fois, au moment où une session d'écoute démarre réellement
 *  (pas à chaque rendu). Retourne le nouveau compteur. */
export function recordTrialSessionUsed(): number {
  if (typeof window === "undefined") return 0;
  const next = getTrialSessionsUsed() + 1;
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}
