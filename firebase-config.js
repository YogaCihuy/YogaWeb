// ==========================================================
// KONFIGURASI FIREBASE
// ==========================================================
// API key Firebase memang publik (aman ditaruh di client).
// Keamanan data diatur lewat Firebase Auth + firestore.rules.
//
// SETUP KEAMANAN (sekali doang):
// 1. Firebase Console -> Authentication -> Sign-in method
//    -> aktifkan "Email/Password"
// 2. Tab Users -> Add user -> bikin email + password admin
// 3. Copy "User UID" akun itu, tempel di ADMIN_UID bawah
//    (dan di firestore.rules, ganti 'PASTE_ADMIN_UID')
// 4. Publish rules: Firebase Console -> Firestore -> Rules
//    (atau: firebase deploy --only firestore:rules)
// 5. Reload web -> tombol "Lu Yoga Bukan?" -> login pakai akun itu
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

// UID admin (bukan email, bukan password — aman diketahui publik).
window.ADMIN_UID = "PASTE_ADMIN_UID";
