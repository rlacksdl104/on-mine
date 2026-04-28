import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import app from "./firebase"

export const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, provider)
    return result.user
  } catch (e) {
    console.error("Google sign-in failed", e)
    return null
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
