import { initializeApp, getApps } from "firebase/app"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC91bIlpZhPxPtaHayjOZyrXrW_3c1u7oQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "minesweeper-bbc1b.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://minesweeper-bbc1b-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "minesweeper-bbc1b",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "minesweeper-bbc1b.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "558656526052",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:558656526052:web:a45844b80bb32f51267ef1",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const database = getDatabase(app)
export default app
