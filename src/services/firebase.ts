import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut,
  type Auth,
  type User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Firestore
} from 'firebase/firestore';
import { LessonProgress, AudioSegment, VocabularyItem, PracticeHistoryEntry } from '../types';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (window as any).__FIREBASE_CONFIG__?.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (window as any).__FIREBASE_CONFIG__?.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (window as any).__FIREBASE_CONFIG__?.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (window as any).__FIREBASE_CONFIG__?.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (window as any).__FIREBASE_CONFIG__?.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (window as any).__FIREBASE_CONFIG__?.appId
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const toAuthUser = (user: User): AuthUser => {
  const provider = user.providerData?.find((entry) => entry.photoURL || entry.displayName || entry.email);
  return {
    uid: user.uid,
    displayName: user.displayName || provider?.displayName || null,
    email: user.email || provider?.email || null,
    photoURL: user.photoURL || provider?.photoURL || null
  };
};

export const subscribeToAuth = (callback: (user: AuthUser | null, error?: any) => void) => {
  if (!auth) {
    callback(null);
    return () => undefined;
  }

  // Handle pending redirect results (if any)
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        callback(toAuthUser(result.user));
      }
    })
    .catch((error) => {
      console.error('Redirect sign-in error:', error);
      callback(null, error);
    });

  return onAuthStateChanged(auth, (user) => {
    callback(user ? toAuthUser(user) : null);
  });
};

export const signInWithGoogle = async () => {
  if (!auth) {
    throw new Error('Firebase is not configured.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return toAuthUser(result.user);
  } catch (error) {
    const code = (error as { code?: string })?.code || '';
    const canRecoverWithRedirect = [
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ].includes(code);

    if (!canRecoverWithRedirect) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return null;
  }
};

export const getFriendlyAuthErrorMessage = (error: any): string => {
  const code = error?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in your Firebase Console.';
    case 'auth/unauthorized-domain':
      return 'Domain not authorized. Add this domain to Authorized Domains in Firebase.';
    case 'auth/popup-blocked':
      return 'Sign-in popup blocked. Please allow popups for this site.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completion.';
    case 'auth/cancelled-popup-request':
      return 'Popup sign-in request cancelled.';
    case 'auth/web-storage-unsupported':
      return 'Third-party cookies/storage are blocked by your browser settings.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    case 'auth/internal-error':
      return 'Firebase internal error. Check project configuration.';
    default:
      return error?.message || 'Google sign-in failed.';
  }
};

export const signOutGoogle = async () => {
  if (!auth) return;
  await signOut(auth);
};

export const loadCloudProgress = async (uid: string) => {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'toeicProgress', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return (data.progress || null) as { [lessonId: string]: LessonProgress } | null;
};

export const saveCloudProgress = async (
  uid: string,
  progress: { [lessonId: string]: LessonProgress }
) => {
  if (!db) return;

  await setDoc(
    doc(db, 'toeicProgress', uid),
    {
      progress,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const loadCloudAudioSegments = async (uid: string) => {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'toeicProgress', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return (data.audioSegments || null) as { [lessonId: string]: AudioSegment[] } | null;
};

export const saveCloudAudioSegments = async (
  uid: string,
  audioSegments: { [lessonId: string]: AudioSegment[] }
) => {
  if (!db) return;

  await setDoc(
    doc(db, 'toeicProgress', uid),
    {
      audioSegments,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const loadCloudVocabulary = async (uid: string) => {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'toeicProgress', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return (data.masteredVocabIds || null) as string[] | null;
};

export const saveCloudVocabulary = async (
  uid: string,
  masteredVocabIds: string[]
) => {
  if (!db) return;

  await setDoc(
    doc(db, 'toeicProgress', uid),
    {
      masteredVocabIds,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const loadCloudCustomVocabulary = async (uid: string) => {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'toeicProgress', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return (data.customVocabItems || null) as VocabularyItem[] | null;
};

export const saveCloudCustomVocabulary = async (
  uid: string,
  customVocabItems: VocabularyItem[]
) => {
  if (!db) return;

  await setDoc(
    doc(db, 'toeicProgress', uid),
    {
      customVocabItems,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const loadCloudHistory = async (uid: string) => {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'toeicProgress', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return (data.history || null) as PracticeHistoryEntry[] | null;
};

export const saveCloudHistory = async (
  uid: string,
  history: PracticeHistoryEntry[]
) => {
  if (!db) return;

  await setDoc(
    doc(db, 'toeicProgress', uid),
    {
      history,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};
