import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc } from 'firebase/firestore';

// Placeholder config - user needs to replace this if automatic setup failed
const firebaseConfig = {
  apiKey: "TODO_KEYHERE",
  authDomain: "TODO_AUTH_DOMAIN",
  projectId: "TODO_PROJECT_ID",
  appId: "TODO_APP_ID",
  firestoreDatabaseId: "TODO_FIRESTORE_DATABASE_ID"
};

let app: any = null;
let auth: any = null;
let db: any = null;

try {
  if (firebaseConfig.apiKey !== "TODO_KEYHERE") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("Firebase config is using placeholders. Firebase will not be initialized.");
  }
} catch (error) {
  console.error("Firebase initialization error", error);
}

export { auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
export { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc };
