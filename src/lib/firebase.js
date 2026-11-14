import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, onSnapshot, updateDoc, collection, query, orderBy, addDoc, writeBatch, serverTimestamp, setDoc, getDocs, arrayUnion, where, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDzCDKimwd5FiXR4pydso6ikqLyYijD0kI",
  authDomain: "roqi-apartments.firebaseapp.com",
  databaseURL: "https://roqi-apartments-default-rtdb.firebaseio.com",
  projectId: "roqi-apartments",
  storageBucket: "roqi-apartments.firebasestorage.app",
  messagingSenderId: "1020177078202",
  appId: "1:1020177078202:web:2e04bad2dcc425cc1a6f83",
  measurementId: "G-7LG0T6YZGD"
};

const app = initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);

// Re-export Firestore functions for consistent imports
export { 
  doc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where,
  orderBy, 
  addDoc, 
  writeBatch, 
  serverTimestamp,
  setDoc,
  getDocs,
  arrayUnion,
  deleteDoc
};

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // connectFirestoreEmulator(db, 'localhost', 8080);
}
