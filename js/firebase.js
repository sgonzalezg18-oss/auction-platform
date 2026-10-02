import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===== Configuración de Firebase (proyecto: subastas-autos-a56b8) =====
const firebaseConfig = {
  apiKey: "AIzaSyDEy6MCwNCgyYqv0BB7K-lAL6XW9oF4_VA",
  authDomain: "subastas-autos-a56b8.firebaseapp.com",
  projectId: "subastas-autos-a56b8",
  storageBucket: "subastas-autos-a56b8.firebasestorage.app",
  messagingSenderId: "186618860546",
  appId: "1:186618860546:web:bf7a4b2e1c8ec83622031b",
  measurementId: "G-VD7726TD7W",
};
// ================================================================

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
};
