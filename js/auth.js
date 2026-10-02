import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  db,
  serverTimestamp,
} from "./firebase.js";

const loginForm = document.getElementById("loginForm");
const registroForm = document.getElementById("registroForm");
const logoutBtn = document.getElementById("logoutBtn");
const navLogin = document.getElementById("navLogin");
const navRegistro = document.getElementById("navRegistro");
const navPublicar = document.getElementById("navPublicar");
const navMisPublicaciones = document.getElementById("navMisPublicaciones");
const userMenu = document.getElementById("userMenu");
const userNombre = document.getElementById("userNombre");
const loginError = document.getElementById("loginError");
const registroError = document.getElementById("registroError");

const RUTAS_PROTEGIDAS = ["publicar.html", "mis-publicaciones.html"];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (navLogin) navLogin.classList.add("hidden");
    if (navRegistro) navRegistro.classList.add("hidden");
    if (navPublicar) navPublicar.classList.remove("hidden");
    if (navMisPublicaciones) navMisPublicaciones.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (userMenu) userMenu.classList.remove("hidden");

    try {
      const uDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (uDoc.exists()) {
        const d = uDoc.data();
        if (userNombre) {
          userNombre.textContent =
            `${d.nombre || ""} ${d.apellido || ""}`.trim() || user.email;
        }
      } else if (userNombre) {
        userNombre.textContent = user.email;
      }
    } catch (e) {
      if (userNombre) userNombre.textContent = user.email;
    }
  } else {
    if (navLogin) navLogin.classList.remove("hidden");
    if (navRegistro) navRegistro.classList.remove("hidden");
    if (navPublicar) navPublicar.classList.add("hidden");
    if (navMisPublicaciones) navMisPublicaciones.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (userMenu) userMenu.classList.add("hidden");
    if (userNombre) userNombre.textContent = "";

    const path = window.location.pathname.split("/").pop();
    if (RUTAS_PROTEGIDAS.includes(path)) window.location.href = "login.html";
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loginError) loginError.textContent = "";

    const email = document.getElementById("emailLogin").value.trim();
    const password = document.getElementById("passwordLogin").value;

    const btn = e.submitter || loginForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Iniciando...';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (error) {
      let msg = "Error al iniciar sesión. Verifica tus credenciales.";
      if (error.code === "auth/user-not-found") msg = "Usuario no encontrado.";
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential")
        msg = "Contraseña incorrecta.";
      if (error.code === "auth/invalid-email") msg = "Correo electrónico inválido.";
      if (error.code === "auth/too-many-requests")
        msg = "Demasiados intentos. Intenta más tarde.";
      if (loginError) loginError.textContent = msg;
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

if (registroForm) {
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (registroError) registroError.textContent = "";

    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("emailRegistro").value.trim();
    const password = document.getElementById("passwordRegistro").value;
    const password2 = document.getElementById("passwordRegistro2").value;

    if (password !== password2) {
      if (registroError) registroError.textContent = "Las contraseñas no coinciden.";
      return;
    }
    if (password.length < 6) {
      if (registroError)
        registroError.textContent = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    const btn = e.submitter || registroForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registrando...';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nombre,
        apellido,
        telefono,
        email,
        creadoEn: serverTimestamp(),
      });
      window.location.href = "index.html";
    } catch (error) {
      let msg = "Error al registrar usuario.";
      if (error.code === "auth/email-already-in-use")
        msg = "Este correo ya está registrado.";
      if (error.code === "auth/invalid-email") msg = "Correo electrónico inválido.";
      if (error.code === "auth/weak-password") msg = "Contraseña demasiado débil.";
      if (registroError) registroError.textContent = msg;
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error(error);
    }
  });
}
