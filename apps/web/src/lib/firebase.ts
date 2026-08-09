import type { Auth } from 'firebase/auth';

let authPromise: Promise<Auth> | null = null;

function firebaseConfig() {
  const required = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Firebase web config missing NEXT_PUBLIC_FIREBASE_* env vars: ${missing.join(', ')}`
    );
  }

  return required;
}

export function getAuthInstance(): Promise<Auth> {
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig());
      const auth = getAuth(app);
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.warn('[FIREBASE] Failed to set local persistence:', err);
      }
      return auth;
    })();
  }
  return authPromise;
}

export async function signInWithGoogle(): Promise<string> {
  const auth = await getAuthInstance();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken(true);
}

export function googleErrorToMessage(error: unknown): string {
  const errObj = error as { code?: string; message?: string };
  const code = errObj?.code ?? '';
  const message = errObj?.message ?? '';

  if (message.includes('Failed to fetch') || message.includes('fetch failed')) {
    return 'Cannot reach API server. Make sure the server is running on http://localhost:3000.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Google sign-in pop-up was blocked by your browser. Please allow pop-ups for localhost and try again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account with this email already exists. Sign in with your password instead.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain (localhost) is not authorized for Firebase sign-in. Please add localhost in Firebase Auth Settings -> Authorized domains.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in provider is disabled in your Firebase Console. Enable Google under Firebase -> Authentication -> Sign-in method.';
  }
  return message || 'Google sign-in failed. Please try again.';
}
