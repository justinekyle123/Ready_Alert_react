// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = firebaseConfigData;

// Initialize Firebase app singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID if present
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Initialize Firebase Messaging dynamically if supported in runtime environment
export const getFirebaseMessaging = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

export default app;

