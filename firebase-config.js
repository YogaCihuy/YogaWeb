// ==========================================================
// KONFIGURASI FIREBASE
// ==========================================================
// 1. Buka Firebase Console -> Project settings -> General -> Your apps
// 2. Pilih Web app (</>) -> copy object firebaseConfig
// 3. Tempel di bawah, ganti semua nilai "PASTE_..."
//
// Selama masih ada "PASTE_...", web otomatis jalan di Mode Demo
// (data disimpan di localStorage browser).
//
// Firestore yang dipakai:
//   - site/profile   -> { name, role, about, updatedAt }
//   - friends/{id}   -> { name, roblox, desc, createdAt, updatedAt }
// ==========================================================

window.FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
