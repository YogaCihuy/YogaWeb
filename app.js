(function () {
  "use strict";

  const DEFAULT_PROFILE = {
    name: "Yoga",
    role: "Developer & Gamer",
    about:
      "Halo! Gw Yoga. Gw suka ngoding (Web & Game Dev Roblox), main game, dan nonton anime.",
    birthday: "",
    hobby: "",
    favoriteSong: "",
    favoriteMovie: "",
    favoriteSeries: "",
    favoriteFood: "",
    wishlist: ""
  };
  const LS_KEYS = { profile: "yoga_profile_v2", friends: "yoga_friends_v2" };
  const PROFILE_DOC = { collection: "site", id: "profile" };
  const FRIENDS_COLLECTION = "friends";
  const DEMO_DELAY = 650;
  const LIMITS = {
    name: 60,
    role: 80,
    about: 600,
    desc: 300,
    birthday: 40,
    hobby: 80,
    favoriteSong: 80,
    favoriteMovie: 80,
    favoriteSeries: 80,
    favoriteFood: 80,
    wishlist: 300
  };

  const BIO_FIELDS = [
    { key: "birthday", label: "Ulang Tahun", icon: "cake" },
    { key: "hobby", label: "Hobby", icon: "sparkles" },
    { key: "favoriteSong", label: "Lagu Favorit", icon: "music" },
    { key: "favoriteMovie", label: "Film Favorit", icon: "film" },
    { key: "favoriteSeries", label: "Series Favorit", icon: "tv" },
    { key: "favoriteFood", label: "Makanan Favorit", icon: "utensils" },
    { key: "wishlist", label: "Wishlist", icon: "star", wide: true }
  ];

  const BIO_INPUT_IDS = {
    birthday: "edit-birthday",
    hobby: "edit-hobby",
    favoriteSong: "edit-fav-song",
    favoriteMovie: "edit-fav-movie",
    favoriteSeries: "edit-fav-series",
    favoriteFood: "edit-fav-food",
    wishlist: "edit-wishlist"
  };

  const ADMIN_UID = String(window.ADMIN_UID || "").trim();
  const UID_CONFIGURED = ADMIN_UID.length > 0 && !/PASTE/i.test(ADMIN_UID);

  const state = {
    mode: "demo",
    profile: { ...DEFAULT_PROFILE },
    friends: [],
    editingId: null,
    adminUser: null,
    adminReady: false
  };

  const $ = (id) => document.getElementById(id);

  /* --------------------------------------------------------
     Helpers
     -------------------------------------------------------- */

  function initials(name) {
    const clean = String(name || "").trim();
    if (!clean) return "??";
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  let toastTimer = null;

  function notify(message, isError) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    const label = btn.querySelector("span");
    if (busy) {
      if (label) {
        btn.dataset.idleLabel = label.textContent;
        label.textContent = busyText || "Menyimpan...";
      }
      btn.disabled = true;
    } else {
      if (label && btn.dataset.idleLabel) {
        label.textContent = btn.dataset.idleLabel;
        delete btn.dataset.idleLabel;
      }
      btn.disabled = false;
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  /* --------------------------------------------------------
     Stores: demo (read-only fallback) / Firestore
     -------------------------------------------------------- */

  function createDemoStore() {
    let profile = readJson(LS_KEYS.profile, null) || { ...DEFAULT_PROFILE };
    let friends = readJson(LS_KEYS.friends, []);
    if (!Array.isArray(friends)) friends = [];

    const subs = { profile: new Set(), friends: new Set() };

    const emit = (kind) => {
      subs[kind].forEach((fn) => {
        try {
          fn(kind === "profile" ? { ...profile } : friends.slice());
        } catch (err) {
          console.error(err);
        }
      });
    };

    window.setTimeout(() => {
      emit("profile");
      emit("friends");
    }, DEMO_DELAY);

    return {
      mode: "demo",
      watchProfile(cb) {
        subs.profile.add(cb);
      },
      watchFriends(cb) {
        subs.friends.add(cb);
      }
    };
  }

  function createFirestoreStore(db) {
    const profileRef = db.collection(PROFILE_DOC.collection).doc(PROFILE_DOC.id);
    const friendsCollection = db.collection(FRIENDS_COLLECTION);

    return {
      mode: "firestore",
      watchProfile(cb) {
        profileRef.onSnapshot(
          (snap) => cb(snap.exists ? snap.data() : { ...DEFAULT_PROFILE }),
          (err) => {
            console.error("[firestore] profile:", err);
            notify("Gagal sync profile: " + err.message, true);
            cb({ ...DEFAULT_PROFILE });
          }
        );
      },
      watchFriends(cb) {
        friendsCollection.onSnapshot(
          (snap) => {
            const list = snap.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }))
              .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            cb(list);
          },
          (err) => {
            console.error("[firestore] friends:", err);
            notify("Gagal sync teman: " + err.message, true);
            cb([]);
          }
        );
      },
      async saveProfile(next) {
        await profileRef.set({ ...next, updatedAt: Date.now() }, { merge: true });
      },
      async saveFriend(data, id) {
        const payload = {
          name: data.name,
          desc: data.desc || "",
          updatedAt: Date.now()
        };
        if (id) await friendsCollection.doc(id).set(payload, { merge: true });
        else await friendsCollection.add({ ...payload, createdAt: Date.now() });
      },
      async deleteFriend(id) {
        await friendsCollection.doc(id).delete();
      }
    };
  }

  function readFirebaseConfig() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || typeof cfg !== "object") return null;
    const required = ["apiKey", "authDomain", "projectId", "appId"];
    const complete = required.every((key) => {
      const value = cfg[key];
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        !/PASTE/i.test(value)
      );
    });
    return complete ? cfg : null;
  }

  const firebaseConfig = readFirebaseConfig();
  let store;
  let auth = null;
  let initFailed = false;

  if (firebaseConfig && window.firebase && window.firebase.firestore) {
    try {
      window.firebase.initializeApp(firebaseConfig);
      store = createFirestoreStore(window.firebase.firestore());
      if (window.firebase.auth) {
        auth = window.firebase.auth();
        auth
          .setPersistence(window.firebase.auth.Auth.Persistence.SESSION)
          .catch((err) => console.error("[auth] persistence:", err));
      }
    } catch (err) {
      console.error("[firebase] init gagal:", err);
      initFailed = true;
      store = createDemoStore();
    }
  } else {
    store = createDemoStore();
  }
  state.mode = store.mode;

  function showModeBanner() {
    const banner = $("mode-banner");
    if (!banner || store.mode === "firestore") return;

    let text;
    if (initFailed) {
      text =
        "Firebase gagal diinisialisasi — web jalan read-only. Cek config & koneksi.";
    } else {
      text =
        "Firebase belum aktif — web jalan read-only (informasi tetap bisa dilihat).";
    }

    banner.textContent = text;
    banner.classList.add("show");
  }

  /* --------------------------------------------------------
     Render: profile
     -------------------------------------------------------- */

  function renderProfile(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const profile = {
      name: source.name ? String(source.name) : DEFAULT_PROFILE.name,
      role: source.role ? String(source.role) : DEFAULT_PROFILE.role,
      about: source.about ? String(source.about) : ""
    };
    BIO_FIELDS.forEach((field) => {
      profile[field.key] = source[field.key] ? String(source[field.key]) : "";
    });
    state.profile = profile;

    $("display-name").textContent = profile.name;
    $("display-role").textContent = profile.role;

    const aboutEl = $("display-about");
    aboutEl.textContent = profile.about || "Belum ada deskripsi.";
    aboutEl.classList.toggle("is-empty", !profile.about);

    $("avatar-initials").textContent = initials(profile.name);
    document.title = profile.name + " — Manga Site";

    renderBio(profile);
  }

  /* --------------------------------------------------------
     Render: biodata
     -------------------------------------------------------- */

  function renderBioSkeletons() {
    const grid = $("bio-grid");
    if (!grid) return;
    grid.innerHTML = "";

    BIO_FIELDS.forEach((field) => {
      const card = document.createElement("article");
      card.className = "bio-card skeleton-card" + (field.wide ? " bio-wide" : "");
      card.innerHTML =
        '<span class="skeleton sk-sm sk-38"></span>' +
        '<span class="skeleton sk-line sk-70"></span>';
      grid.appendChild(card);
    });
  }

  function renderBio(profile) {
    const grid = $("bio-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const frag = document.createDocumentFragment();
    BIO_FIELDS.forEach((field) => {
      const value = String(profile[field.key] || "").trim();

      const card = document.createElement("article");
      card.className =
        "bio-card" + (field.wide ? " bio-wide" : "") + (value ? "" : " is-empty");

      const label = document.createElement("span");
      label.className = "bio-label";
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", field.icon);
      label.appendChild(icon);
      label.appendChild(document.createTextNode(field.label));

      const text = document.createElement("p");
      text.className = "bio-value";
      text.textContent = value || "Belum diisi";

      card.appendChild(label);
      card.appendChild(text);
      frag.appendChild(card);
    });

    grid.appendChild(frag);
    if (window.lucide) window.lucide.createIcons();
  }

  /* --------------------------------------------------------
     Render: friends
     -------------------------------------------------------- */

  function renderFriendSkeletons(count) {
    const grid = $("friends-grid");
    grid.innerHTML = "";

    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("div");
      card.className = "friend-card skeleton-card";
      card.innerHTML =
        '<div class="friend-head">' +
        '<span class="skeleton sk-avatar"></span>' +
        '<div class="friend-meta sk-meta">' +
        '<span class="skeleton sk-line sk-55"></span>' +
        '<span class="skeleton sk-line sk-sm sk-38"></span>' +
        "</div>" +
        "</div>" +
        '<span class="skeleton sk-quote"></span>';
      grid.appendChild(card);
    }
  }

  function buildFriendCard(friend, index) {
    const card = document.createElement("article");
    card.className = "friend-card";
    card.style.animationDelay = Math.min(index, 10) * 55 + "ms";

    const head = document.createElement("div");
    head.className = "friend-head";

    const badge = document.createElement("div");
    badge.className = "friend-initials";
    badge.textContent = initials(friend.name);

    const meta = document.createElement("div");
    meta.className = "friend-meta";

    const name = document.createElement("h3");
    name.className = "friend-name";
    name.textContent = friend.name || "Tanpa Nama";

    const tag = document.createElement("span");
    tag.className = "friend-tag is-empty";
    tag.textContent = "Friend";

    meta.appendChild(name);
    meta.appendChild(tag);
    head.appendChild(badge);
    head.appendChild(meta);

    const quote = document.createElement("blockquote");
    quote.className = "friend-quote";
    quote.textContent = friend.desc || "Belum ada pendapat.";

    card.appendChild(head);
    card.appendChild(quote);
    return card;
  }

  function buildEmptyState() {
    const wrap = document.createElement("div");
    wrap.className = "empty-state";
    wrap.innerHTML =
      '<div class="empty-zero" aria-hidden="true">0</div>' +
      '<p class="empty-kicker">Panel Kosong</p>' +
      '<h3 class="empty-title">Belum Ada Teman</h3>' +
      '<p class="empty-sub">List pertemanan lu masih kosong. Tambahin temen lewat panel admin.</p>' +
      '<button type="button" class="btn btn-ink" data-action="open-auth">' +
      '<i data-lucide="user-plus"></i><span>Buka Panel Admin</span>' +
      "</button>";

    return wrap;
  }

  function renderFriends(friends) {
    state.friends = Array.isArray(friends) ? friends : [];

    const grid = $("friends-grid");
    grid.innerHTML = "";
    $("friend-count").textContent = state.friends.length + " Teman";

    if (state.friends.length === 0) {
      grid.appendChild(buildEmptyState());
    } else {
      const frag = document.createDocumentFragment();
      state.friends.forEach((friend, index) => {
        frag.appendChild(buildFriendCard(friend, index));
      });
      grid.appendChild(frag);
    }

    renderAdminFriends();
    if (window.lucide) window.lucide.createIcons();
  }

  /* --------------------------------------------------------
     Admin: friend list
     -------------------------------------------------------- */

  function renderAdminFriends() {
    const list = $("admin-friends-list");
    list.innerHTML = "";

    if (state.friends.length === 0) {
      const empty = document.createElement("p");
      empty.className = "admin-empty";
      empty.textContent = "Belum ada teman di list.";
      list.appendChild(empty);
      return;
    }

    state.friends.forEach((friend) => {
      const row = document.createElement("div");
      row.className = "admin-row";

      const info = document.createElement("div");
      info.className = "admin-row-info";

      const name = document.createElement("span");
      name.className = "admin-row-name";
      name.textContent = friend.name || "Tanpa Nama";
      info.appendChild(name);

      const actions = document.createElement("div");
      actions.className = "admin-row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditFriend(friend.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-btn danger";
      deleteBtn.textContent = "Hapus";
      deleteBtn.addEventListener("click", () => deleteFriend(friend.id));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  /* --------------------------------------------------------
     Auth (Firebase email/password, allowlist UID)
     -------------------------------------------------------- */

  function setAuthError(message) {
    const el = $("auth-error");
    if (!message) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    el.textContent = message;
    el.classList.remove("hidden");
  }

  function authErrorMessage(err) {
    const code = err && err.code ? err.code : "";
    switch (code) {
      case "auth/invalid-email":
        return "Format email nggak valid.";
      case "auth/user-disabled":
        return "Akun ini dinonaktifkan.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email atau password salah.";
      case "auth/too-many-requests":
        return "Kebanyakan percobaan login. Coba lagi nanti.";
      case "auth/network-request-failed":
        return "Koneksi bermasalah. Cek internet lu.";
      case "auth/operation-not-allowed":
      case "auth/configuration-not-found":
        return "Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method).";
      case "auth/unauthorized-domain":
        return "Domain ini belum diizinkan di Firebase Auth.";
      case "auth/invalid-api-key":
        return "Config Firebase nggak valid. Cek firebase-config.js.";
      default:
        return err && err.message ? err.message : "Login gagal.";
    }
  }

  function canWriteAdmin() {
    return (
      store.mode === "firestore" &&
      Boolean(state.adminUser) &&
      state.adminReady
    );
  }

  function ensureAdminWrite() {
    if (canWriteAdmin()) return true;
    notify("Akses admin belum aktif. Login & selesaikan setup UID dulu.", true);
    return false;
  }

  function setAdminControlsEnabled(enabled) {
    const profileBtn = $("save-profile-btn");
    const friendBtn = $("save-friend-btn");
    if (profileBtn) profileBtn.disabled = !enabled;
    if (friendBtn) friendBtn.disabled = !enabled;
  }

  function renderAdminSession(user) {
    $("admin-session-email").textContent = user.email || "(tanpa email)";
    $("admin-session-uid").textContent = user.uid;
    $("admin-session").classList.remove("hidden");
  }

  function renderSetupWarning() {
    const warn = $("admin-setup-warning");
    if (!state.adminUser || state.adminReady) {
      warn.classList.add("hidden");
      return;
    }
    warn.classList.remove("hidden");
    $("admin-setup-text").textContent =
      "UID lu: " +
      state.adminUser.uid +
      " — tempel ke window.ADMIN_UID di firebase-config.js DAN ke ADMIN_UID di firestore.rules, lalu publish rules & reload. Selama belum, tombol simpan/hapus dikunci.";
  }

  function handleAuthState(user) {
    state.adminUser = user || null;

    if (!user) {
      state.adminReady = false;
      setAdminControlsEnabled(false);
      $("admin-session").classList.add("hidden");
      $("admin-setup-warning").classList.add("hidden");
      closeAdminModal();
      return;
    }

    if (UID_CONFIGURED && user.uid !== ADMIN_UID) {
      state.adminReady = false;
      auth.signOut();
      setAuthError("Akun ini bukan admin website.");
      openAuthModal();
      return;
    }

    state.adminReady = UID_CONFIGURED;
    renderAdminSession(user);
    setAdminControlsEnabled(state.adminReady);
    renderSetupWarning();
  }

  function openAuthModal() {
    if (store.mode !== "firestore" || !auth) {
      notify("Admin cuma aktif kalau Firebase tersambung.", true);
      return;
    }

    if (state.adminUser) {
      openAdminModal();
      return;
    }

    $("auth-email").value = "";
    $("auth-password").value = "";
    setAuthError("");
    $("auth-modal").classList.add("open");
    window.setTimeout(() => $("auth-email").focus(), 60);
  }

  function closeAuthModal() {
    $("auth-modal").classList.remove("open");
  }

  async function loginAdmin() {
    if (store.mode !== "firestore" || !auth) {
      notify("Admin cuma aktif kalau Firebase tersambung.", true);
      return;
    }

    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;

    if (!email || !password) {
      setAuthError("Email & password wajib diisi.");
      return;
    }

    setAuthError("");
    const btn = $("login-btn");
    setBusy(btn, true, "Login...");

    try {
      await auth.setPersistence(window.firebase.auth.Auth.Persistence.SESSION);
      const cred = await auth.signInWithEmailAndPassword(email, password);
      $("auth-password").value = "";

      if (UID_CONFIGURED && cred.user.uid !== ADMIN_UID) {
        await auth.signOut();
        setAuthError("Akun ini bukan admin website.");
        return;
      }

      state.adminUser = cred.user;
      state.adminReady = UID_CONFIGURED;
      closeAuthModal();
      openAdminModal();
      notify("Login admin berhasil.");
    } catch (err) {
      console.error("[auth]", err);
      setAuthError(authErrorMessage(err));
    } finally {
      setBusy(btn, false);
    }
  }

  async function logoutAdmin() {
    if (!auth) return;
    try {
      await auth.signOut();
      closeAdminModal();
      notify("Logout berhasil.");
    } catch (err) {
      console.error("[auth] logout:", err);
      notify("Gagal logout: " + err.message, true);
    }
  }

  async function copyAdminUid() {
    if (!state.adminUser) return;
    const uid = state.adminUser.uid;
    try {
      await navigator.clipboard.writeText(uid);
      notify("UID admin disalin.");
    } catch (err) {
      notify("UID: " + uid + " (copy manual ya)");
    }
  }

  /* --------------------------------------------------------
     Admin modal
     -------------------------------------------------------- */

  function openAdminModal() {
    if (!state.adminUser) {
      openAuthModal();
      return;
    }

    $("edit-name").value = state.profile.name || "";
    $("edit-role").value = state.profile.role || "";
    $("edit-about").value = state.profile.about || "";

    BIO_FIELDS.forEach((field) => {
      const input = $(BIO_INPUT_IDS[field.key]);
      if (input) input.value = state.profile[field.key] || "";
    });

    resetFriendForm();
    renderAdminSession(state.adminUser);
    renderSetupWarning();
    setAdminControlsEnabled(state.adminReady);
    $("admin-modal").classList.add("open");
  }

  function closeAdminModal() {
    $("admin-modal").classList.remove("open");
  }

  function limitText(value, max) {
    return String(value || "").trim().slice(0, max);
  }

  async function saveProfile() {
    if (!ensureAdminWrite()) return;

    const name = limitText($("edit-name").value, LIMITS.name);
    const role = limitText($("edit-role").value, LIMITS.role);
    const about = limitText($("edit-about").value, LIMITS.about);

    if (!name) {
      notify("Nama wajib diisi!", true);
      $("edit-name").focus();
      return;
    }

    const bio = {};
    BIO_FIELDS.forEach((field) => {
      const input = $(BIO_INPUT_IDS[field.key]);
      bio[field.key] = limitText(
        input ? input.value : "",
        LIMITS[field.key] || 80
      );
    });

    const btn = $("save-profile-btn");
    setBusy(btn, true, "Menyimpan...");

    try {
      await store.saveProfile({
        name,
        role: role || "Developer",
        about,
        ...bio
      });
      notify("Profile berhasil disimpan!");
    } catch (err) {
      console.error(err);
      notify("Gagal simpan profile: " + err.message, true);
    } finally {
      setBusy(btn, false);
    }
  }

  /* --------------------------------------------------------
     Admin: friends CRUD
     -------------------------------------------------------- */

  function setFriendFormMode(editing) {
    const title = $("friend-form-mode");
    const cancel = $("friend-cancel");
    const label = $("save-friend-btn").querySelector("span");
    const editingFriend = editing
      ? state.friends.find((f) => f.id === state.editingId)
      : null;

    title.textContent = editing
      ? "Mode Edit: " + ((editingFriend && editingFriend.name) || "Tanpa Nama")
      : "Tambah Teman Baru";
    cancel.classList.toggle("hidden", !editing);
    if (label) label.textContent = editing ? "Update Teman" : "Simpan Teman";
    delete $("save-friend-btn").dataset.idleLabel;
  }

  function resetFriendForm() {
    state.editingId = null;
    $("friend-id").value = "";
    $("friend-name").value = "";
    $("friend-desc").value = "";
    setFriendFormMode(false);
  }

  function startEditFriend(id) {
    if (!ensureAdminWrite()) return;

    const friend = state.friends.find((item) => item.id === id);
    if (!friend) return;

    state.editingId = id;
    $("friend-id").value = id;
    $("friend-name").value = friend.name || "";
    $("friend-desc").value = friend.desc || "";

    setFriendFormMode(true);
    $("friend-name").focus();
    $("friend-form-mode").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveFriend() {
    if (!ensureAdminWrite()) return;

    const id = $("friend-id").value || null;
    const name = limitText($("friend-name").value, LIMITS.name);
    const desc = limitText($("friend-desc").value, LIMITS.desc);

    if (!name) {
      notify("Nama teman wajib diisi!", true);
      $("friend-name").focus();
      return;
    }

    const btn = $("save-friend-btn");
    setBusy(btn, true, "Menyimpan...");

    try {
      await store.saveFriend({ name, desc }, id);
      notify(id ? "Data teman diperbarui!" : "Teman baru ditambahkan!");
      resetFriendForm();
    } catch (err) {
      console.error(err);
      notify("Gagal simpan teman: " + err.message, true);
    } finally {
      setBusy(btn, false);
    }
  }

  async function deleteFriend(id) {
    if (!ensureAdminWrite()) return;

    const friend = state.friends.find((item) => item.id === id);
    const label = friend && friend.name ? '"' + friend.name + '"' : "teman ini";

    if (!window.confirm("Hapus " + label + " dari list?")) return;

    try {
      await store.deleteFriend(id);
      notify("Teman dihapus dari list.");
      if (state.editingId === id) resetFriendForm();
    } catch (err) {
      console.error(err);
      notify("Gagal hapus teman: " + err.message, true);
    }
  }

  /* --------------------------------------------------------
     UI wiring (no inline JS, CSP-friendly)
     -------------------------------------------------------- */

  const ACTIONS = {
    "open-auth": openAuthModal,
    "close-auth": closeAuthModal,
    "login-admin": loginAdmin,
    "close-admin": closeAdminModal,
    "save-profile": saveProfile,
    "save-friend": saveFriend,
    "reset-friend": resetFriendForm,
    "logout-admin": logoutAdmin,
    "copy-uid": copyAdminUid
  };

  document.addEventListener("click", (event) => {
    const target = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!target) return;
    const handler = ACTIONS[target.dataset.action];
    if (!handler) return;
    event.preventDefault();
    handler();
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("open");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
      closeAdminModal();
    }
    if (
      event.key === "Enter" &&
      $("auth-modal").classList.contains("open") &&
      (document.activeElement === $("auth-email") ||
        document.activeElement === $("auth-password"))
    ) {
      loginAdmin();
    }
  });

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */

  showModeBanner();
  renderBioSkeletons();
  renderFriendSkeletons(4);
  store.watchProfile(renderProfile);
  store.watchFriends(renderFriends);

  if (auth) {
    auth.onAuthStateChanged(handleAuthState);
  } else {
    setAdminControlsEnabled(false);
  }

  if (window.lucide) window.lucide.createIcons();
})();
