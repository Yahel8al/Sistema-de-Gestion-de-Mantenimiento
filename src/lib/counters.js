import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Genera el siguiente número de orden de trabajo (OT-0001, OT-0002, ...)
 * usando una transacción de Firestore para evitar que dos técnicos que
 * crean una orden al mismo tiempo obtengan el mismo número.
 */
export async function getNextOrderNumber() {
  const counterRef = doc(db, "contadores", "ordenes_trabajo");
  const nuevoNumero = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const actual = snap.exists() ? Number(snap.data().ultimo || 0) : 0;
    const siguiente = actual + 1;
    tx.set(counterRef, { ultimo: siguiente }, { merge: true });
    return siguiente;
  });
  return `OT-${String(nuevoNumero).padStart(4, "0")}`;
}
