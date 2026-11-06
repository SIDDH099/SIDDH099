import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { Product, DesignItem } from '../types';

// ============================================================================
// 🔑 येथे तुमचे FIREBASE CONFIGURATION KEYS टाका (PASTE YOUR FIREBASE KEYS HERE)
// ============================================================================
// पायरी १: console.firebase.google.com वर जा आणि मोफत प्रोजेक्ट तयार करा.
// पायरी २: Firestore Database 'Start in test mode' निवडून तयार करा.
// पायरी ३: Project Settings > General > Your Apps > Web App (</>) वर क्लिक करून
//         खालील firebaseConfig मध्ये तुमच्या कीज टाका (किंवा Vercel Environment Variables मध्ये टाका).
// ============================================================================

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCVXCU6NiB0WsmWGkoiDkIWXfPtwDz0MeM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "manisha-boutique-a35a9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "manisha-boutique-a35a9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "manisha-boutique-a35a9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "527419786804",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:527419786804:web:5ec1ac75010d336bafac61",
  measurementId: "G-CSMLTYTLYG"
};

// Check if valid Firebase configuration is provided
export const isFirebaseConfigured = (): boolean => {
  return (
    Boolean(firebaseConfig.apiKey) &&
    firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
    Boolean(firebaseConfig.projectId) &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

export { app, db };

// ============================================================================
// 🔄 REAL-TIME FIRESTORE LISTENERS & CRUD (onSnapshot)
// ============================================================================

/**
 * साडी आणि ब्लाऊज कॅटलॉगसाठी रिअल-टाइम श्रोता (Real-time Catalogue Listener)
 * एका फोनवरून मालकाने नवीन उत्पादन टाकले की सर्व ग्राहकांच्या फोनवर आपोआप दिसेल.
 */
export const subscribeToProductsRealtime = (
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): Unsubscribe | null => {
  if (!db || !isFirebaseConfigured()) return null;

  try {
    const productsRef = collection(db, 'products');
    return onSnapshot(
      productsRef,
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as Omit<Product, 'id'>) });
        });
        onData(items);
      },
      (err) => {
        console.error('Firestore Products onSnapshot error:', err);
        if (onError) onError(err);
      }
    );
  } catch (error: any) {
    console.error('Error attaching products listener:', error);
    if (onError) onError(error);
    return null;
  }
};

/**
 * ब्लाऊज डिझाईन्ससाठी रिअल-टाइम श्रोता (Real-time Design Library Listener)
 */
export const subscribeToDesignsRealtime = (
  onData: (designs: DesignItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe | null => {
  if (!db || !isFirebaseConfigured()) return null;

  try {
    const designsRef = collection(db, 'designs');
    return onSnapshot(
      designsRef,
      (snapshot) => {
        const items: DesignItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as Omit<DesignItem, 'id'>) });
        });
        onData(items);
      },
      (err) => {
        console.error('Firestore Designs onSnapshot error:', err);
        if (onError) onError(err);
      }
    );
  } catch (error: any) {
    console.error('Error attaching designs listener:', error);
    if (onError) onError(error);
    return null;
  }
};

/**
 * कॅटलॉग उत्पादन क्लाउडवर सेव्ह करा (Save Product to Cloud Firestore)
 */
export const saveProductToFirestore = async (product: Product): Promise<void> => {
  if (!db || !isFirebaseConfigured()) return;
  const docRef = doc(db, 'products', product.id);
  await setDoc(docRef, product, { merge: true });
};

/**
 * कॅटलॉग उत्पादन क्लाउडवरून हटवा (Delete Product from Cloud Firestore)
 */
export const deleteProductFromFirestore = async (productId: string): Promise<void> => {
  if (!db || !isFirebaseConfigured()) return;
  const docRef = doc(db, 'products', productId);
  await deleteDoc(docRef);
};

/**
 * नवीन डिझाईन क्लाउडवर सेव्ह करा (Save Design to Cloud Firestore)
 */
export const saveDesignToFirestore = async (design: DesignItem): Promise<void> => {
  if (!db || !isFirebaseConfigured()) return;
  const docRef = doc(db, 'designs', design.id);
  await setDoc(docRef, design, { merge: true });
};

/**
 * डिझाईन क्लाउडवरून हटवा (Delete Design from Cloud Firestore)
 */
export const deleteDesignFromFirestore = async (designId: string): Promise<void> => {
  if (!db || !isFirebaseConfigured()) return;
  const docRef = doc(db, 'designs', designId);
  await deleteDoc(docRef);
};

/**
 * स्थानिक सर्व उत्पादने आणि डिझाईन्स एकाच वेळी फायरस्टोअर क्लाउडवर अपलोड करा (One-click Bulk Sync to Cloud)
 */
export const syncAllLocalToFirestore = async (
  products: Product[],
  designs: DesignItem[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!db || !isFirebaseConfigured()) {
    return { success: false, count: 0, error: 'Firebase कॉन्फिगरेशन उपलब्ध नाही.' };
  }

  try {
    let count = 0;
    for (const prod of products) {
      const docRef = doc(db, 'products', prod.id);
      await setDoc(docRef, prod, { merge: true });
      count++;
    }
    for (const des of designs) {
      const docRef = doc(db, 'designs', des.id);
      await setDoc(docRef, des, { merge: true });
      count++;
    }
    return { success: true, count };
  } catch (err: any) {
    console.error('Error syncing local to Firestore:', err);
    return { success: false, count: 0, error: err.message || 'Error syncing data' };
  }
};
