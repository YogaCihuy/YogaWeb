// ==========================================================
// KONFIGURASI FIREBASE
// ==========================================================
// API key Firebase memang publik (aman ditaruh di client).
// Keamanan data diatur lewat Firebase Auth + firestore.rules.
//
// SETUP KEAMANAN (sekali doang):
// 1. Firebase Console -> Authentication -> Sign-in method
//    -> aktifkan "Email/Password" (cuma toggle, sekali).
// 2. Akun admin: email-nya tetap admin@yogaweb.local (disembunyikan
//    dari UI, lu cukup ketik password). Akun ini dibuat sekali lewat
//    proses setup, lalu UID-nya ditempel ke ADMIN_UID di bawah dan ke
//    ADMIN_UID di firestore.rules.
// 3. Deploy rules: firebase deploy --only firestore:rules
// 4. Reload web -> tombol "Lu Yoga Bukan?" -> isi password admin.
//
// Selama ADMIN_UID masih "PASTE_ADMIN_UID", panel admin kebuka
// tapi tombol simpan/hapus dikunci (data tetap aman dari tulis).
// ==========================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAR9FwMoywMU5W7KabwCxyr7pCdWBQ4Lck",
  authDomain: "yogaweb-112b6.firebaseapp.com",
  projectId: "yogaweb-112b6",
  storageBucket: "yogaweb-112b6.firebasestorage.app",
  messagingSenderId: "1096187591426",
  appId: "1:1096187591426:web:05bd1df5a206d5fce4e01b"
};

// Email internal akun admin (bukan rahasia, cuma identitas akun).
window.ADMIN_EMAIL = "admin@yogaweb.local";

// UID admin (bukan email, bukan password — aman diketahui publik).
window.ADMIN_UID = "WhuwiT82Mgf1Aadj9Tu9s2a29sJ3";
