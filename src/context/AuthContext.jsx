import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const ref = doc(db, "usuarios", firebaseUser.uid);
          const snap = await getDoc(ref);
          const data = snap.exists() ? snap.data() : null;
          if (data && data.activo === false) {
            // La cuenta fue desactivada por un administrador: se cierra la sesión de inmediato.
            setAccessError("Tu cuenta ha sido desactivada. Contacta al administrador del sistema.");
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setUser(firebaseUser);
          setProfile(data);
        } catch (e) {
          console.error("Error cargando perfil de usuario:", e);
          setUser(firebaseUser);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    setAccessError("");
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, nombre, rol = "clinico") => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nombre, email, rol, activo: true, creadoEn: serverTimestamp(),
    });
    setProfile({ nombre, email, rol, activo: true });
    return cred;
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, register, accessError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
