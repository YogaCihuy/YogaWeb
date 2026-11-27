(function () {
  "use strict";

  const ADMIN_PASS = "191013";
  const DEFAULT_PROFILE = {
    name: "Yoga",
    role: "Developer & Gamer",
    about:
      "Halo! Gw Yoga. Gw suka ngoding (Web & Game Dev Roblox), main game, dan nonton anime."
  };
  const LS_KEYS = { profile: "yoga_profile_v2", friends: "yoga_friends_v2" };
  const PROFILE_DOC = { collection: "site", id: "profile" };
  const FRIENDS_COLLECTION = "friends";
  const DEMO_DELAY = 650;

  const state = {
    mode: "demo",
    profile: { ...DEFAULT_PROFILE },
    friends: [],
    editingId: null
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
     Stores: demo (localStorage) / Firestore
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
      },
      async saveProfile(next) {
        profile = { ...profile, ...next };
        window.localStorage.setItem(LS_KEYS.profile, JSON.stringify(profile));
        emit("profile");
      },
      async saveFriend(data, id) {
        if (id) {
          friends = friends.map((item) =>
            item.id === id ? { ...item, ...data } : item
          );
        } else {
          friends = friends.concat([
            { id: String(Date.now()), ...data, createdAt: Date.now() }
          ]);
        }
        window.localStorage.setItem(LS_KEYS.friends, JSON.stringify(friends));
        emit("friends");
      },
      async deleteFriend(id) {
        friends = friends.filter((item) => item.id !== id);
        window.localStorage.setItem(LS_KEYS.friends, JSON.stringify(friends));
        emit("friends");
      }
    };
  }

  function createFirestoreStore(config) {
    window.firebase.initializeApp(config);
    const db = window.firebase.firestore();
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
          roblox: data.roblox || "",
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
  let initFailed = false;

  if (firebaseConfig && window.firebase && window.firebase.firestore) {
    try {
      store = createFirestoreStore(firebaseConfig);
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
        "Firebase gagal diinisialisasi — sementara Mode Demo (data disimpan di browser).";
    } else if (firebaseConfig) {
      text =
        "SDK Firebase nggak kebaca — sementara Mode Demo (data disimpan di browser).";
    } else {
      text =
        "Mode Demo — data disimpan di browser. Tempel config Firebase di firebase-config.js buat nyambung ke Firestore.";
    }

    banner.textContent = text;
    banner.classList.add("show");
  }

  /* --------------------------------------------------------
     Render: profile
     -------------------------------------------------------- */

  function renderProfile(raw) {
    const profile = {
      name: raw && raw.name ? String(raw.name) : DEFAULT_PROFILE.name,
      role: raw && raw.role ? String(raw.role) : DEFAULT_PROFILE.role,
      about: raw && raw.about ? String(raw.about) : ""
    };
    state.profile = profile;

    $("display-name").textContent = profile.name;
    $("display-role").textContent = profile.role;

    const aboutEl = $("display-about");
    aboutEl.textContent = profile.about || "Belum ada deskripsi.";
    aboutEl.classList.toggle("is-empty", !profile.about);

    $("avatar-initials").textContent = initials(profile.name);
    document.title = profile.name + " — Manga Site";
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
        '<div class="friend-meta" style="flex:1">' +
        '<span class="skeleton sk-line" style="width:55%"></span>' +
        '<span class="skeleton sk-line sk-sm" style="width:38%"></span>' +
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
    if (friend.roblox) {
      tag.className = "friend-tag";
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", "gamepad-2");
      tag.appendChild(icon);
      tag.appendChild(document.createTextNode(" @" + friend.roblox));
    } else {
      tag.className = "friend-tag is-empty";
      tag.textContent = "Friend";
    }

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
      '<button type="button" class="btn btn-ink" data-action="open-admin">' +
      '<i data-lucide="user-plus"></i><span>Buka Panel Admin</span>' +
      "</button>";

    wrap
      .querySelector('[data-action="open-admin"]')
      .addEventListener("click", openAuthModal);
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

      if (friend.roblox) {
        const user = document.createElement("span");
        user.className = "admin-row-user";
        user.textContent = "@" + friend.roblox;
        info.appendChild(user);
      }

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
     Auth gate
     -------------------------------------------------------- */

  function openAuthModal() {
    $("auth-password").value = "";
    $("auth-error").classList.add("hidden");
    $("auth-modal").classList.add("open");
    window.setTimeout(() => $("auth-password").focus(), 60);
  }

  function closeAuthModal() {
    $("auth-modal").classList.remove("open");
  }

  function checkPassword() {
    const value = $("auth-password").value.replace(/\s+/g, "");
    if (value === ADMIN_PASS) {
      closeAuthModal();
      openAdminModal();
      return;
    }

    $("auth-error").classList.remove("hidden");
    const card = $("auth-modal").querySelector(".modal-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  }

  /* --------------------------------------------------------
     Admin modal
     -------------------------------------------------------- */

  function openAdminModal() {
    $("edit-name").value = state.profile.name || "";
    $("edit-role").value = state.profile.role || "";
    $("edit-about").value = state.profile.about || "";

    resetFriendForm();
    $("admin-modal").classList.add("open");
  }

  function closeAdminModal() {
    $("admin-modal").classList.remove("open");
  }

  async function saveProfile() {
    const name = $("edit-name").value.trim();
    const role = $("edit-role").value.trim();
    const about = $("edit-about").value.trim();

    if (!name) {
      notify("Nama wajib diisi!", true);
      $("edit-name").focus();
      return;
    }

    const btn = $("save-profile-btn");
    setBusy(btn, true, "Menyimpan...");

    try {
      await store.saveProfile({ name, role: role || "Developer", about });
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
    $("friend-roblox").value = "";
    $("friend-desc").value = "";
    setFriendFormMode(false);
  }

  function startEditFriend(id) {
    const friend = state.friends.find((item) => item.id === id);
    if (!friend) return;

    state.editingId = id;
    $("friend-id").value = id;
    $("friend-name").value = friend.name || "";
    $("friend-roblox").value = friend.roblox || "";
    $("friend-desc").value = friend.desc || "";

    setFriendFormMode(true);
    $("friend-name").focus();
    $("friend-form-mode").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveFriend() {
    const id = $("friend-id").value || null;
    const name = $("friend-name").value.trim();
    const roblox = $("friend-roblox").value.trim().replace(/^@+/, "");
    const desc = $("friend-desc").value.trim();

    if (!name) {
      notify("Nama teman wajib diisi!", true);
      $("friend-name").focus();
      return;
    }

    const btn = $("save-friend-btn");
    setBusy(btn, true, "Menyimpan...");

    try {
      await store.saveFriend({ name, roblox, desc }, id);
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
     Global hooks (dipanggil dari inline onclick di HTML)
     -------------------------------------------------------- */

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.checkPassword = checkPassword;
  window.closeAdminModal = closeAdminModal;
  window.saveProfile = saveProfile;
  window.saveFriend = saveFriend;
  window.resetFriendForm = resetFriendForm;

  /* --------------------------------------------------------
     Wiring
     -------------------------------------------------------- */

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
      document.activeElement === $("auth-password")
    ) {
      checkPassword();
    }
  });

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */

  showModeBanner();
  renderFriendSkeletons(4);
  store.watchProfile(renderProfile);
  store.watchFriends(renderFriends);

  if (window.lucide) window.lucide.createIcons();
})();
