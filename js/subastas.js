import {
  auth,
  db,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  onAuthStateChanged,
} from "./firebase.js";

const detalleContainer = document.getElementById("detalleSubasta");

let imagenes = [];
let imgIndex = 0;
let subastaIdActual = null;
let subastaData = null;
let currentUser = null;
let unsubSubasta = null;
let timerInterval = null;
let cerrando = false;

// ================= UTILIDADES =================
function formatQ(v) {
  const n = Number(v || 0);
  return "Q. " + n.toLocaleString("es-GT", { maximumFractionDigits: 0 });
}

function getParamId() {
  return new URLSearchParams(window.location.search).get("id");
}

function fechaLocal(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Estado derivado (aun si nadie ha persistido el cierre)
function estadoDerivado() {
  if (!subastaData) return "activa";
  if (subastaData.estado !== "activa") return subastaData.estado;
  const fin = subastaData.horaFin?.toMillis?.() || 0;
  if (Date.now() >= fin) return subastaData.ganadorUid ? "cerrada" : "desierta";
  return "activa";
}

// Minimo con regla del 10%
function pujaMinima() {
  if (!subastaData) return 0;
  const pb = Number(subastaData.precioBase || 0);
  const pa = Number(subastaData.pujaActual || 0);
  return Math.ceil(Math.max(pb, pa * 1.1) - 0.01);
}

// ================= RENDER =================
function renderDetalle(v) {
  const s = subastaData;
  const badgeDanoHTML =
    v.estadoDano === "verde"
      ? '<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">Daño menor</span>'
      : v.estadoDano === "amarillo"
      ? '<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">Daño medio</span>'
      : v.estadoDano === "rojo"
      ? '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">Daño severo</span>'
      : "";

  detalleContainer.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-8">
      <div>
        <div class="bg-white rounded-2xl border overflow-hidden">
          <div class="relative h-72 md:h-96 bg-gray-100 flex items-center justify-center">
            ${imagenes.length > 0 ? `<img id="carruselImg" src="${imagenes[0]}" class="w-full h-full object-contain" alt="Foto 1">` : '<span class="text-gray-400">Sin imágenes</span>'}
            ${imagenes.length > 1 ? `
              <button id="btnPrev" class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl shadow">&#8249;</button>
              <button id="btnNext" class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl shadow">&#8250;</button>
              <span id="carrContador" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">1 / ${imagenes.length}</span>
            ` : ""}
          </div>
        </div>
        <div id="thumbs" class="flex gap-2 mt-3 overflow-x-auto pb-1"></div>
      </div>

      <div class="space-y-6">
        <div class="bg-white rounded-2xl border p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h1 class="text-2xl font-bold">${v.marca} ${v.modelo} ${v.anio || ""}</h1>
              <p class="text-gray-500 mt-1">${v.tipoArticulo || ""}</p>
            </div>
            ${badgeDanoHTML}
          </div>
          <div id="badgeEstadoPuja" class="mt-4"></div>
        </div>

        <div class="bg-white rounded-2xl border p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-gray-500 text-sm">Precio base</p>
              <p id="precioBase" class="text-lg font-semibold">${formatQ(s.precioBase)}</p>
            </div>
            <div>
              <p class="text-gray-500 text-sm">Estado</p>
              <p id="estadoSubasta" class="font-medium capitalize">${s.estado}</p>
            </div>
          </div>
          <div>
            <p class="text-gray-500 text-sm">Puja actual más alta</p>
            <p id="pujaActual" class="text-3xl font-bold text-blue-700">${formatQ(s.pujaActual)}</p>
            <p class="text-xs text-gray-400 mt-1">Identidad de los ofertantes: privada</p>
          </div>
          <div>
            <p class="text-gray-500 text-sm">Tiempo restante</p>
            <p id="temporizador" class="text-2xl font-mono font-semibold">--:--:--</p>
            <p class="text-xs text-gray-400 mt-1">Cierra: ${fechaLocal(s.horaFin)}</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border p-6">
          <h2 class="font-semibold mb-3">Ficha técnica</h2>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-500">Motor:</span> <span class="font-medium">${v.motor || "-"}</span></div>
            <div><span class="text-gray-500">Transmisión:</span> <span class="font-medium capitalize">${(v.transmision || "-").replace("automatica", "automática")}</span></div>
            <div><span class="text-gray-500">Combustible:</span> <span class="font-medium capitalize">${v.combustible || "-"}</span></div>
            <div><span class="text-gray-500">Tren manejo:</span> <span class="font-medium uppercase">${v.trenManejo || "-"}</span></div>
            <div><span class="text-gray-500">Cilindros:</span> <span class="font-medium">${v.cilindros || "-"}</span></div>
            <div><span class="text-gray-500">Año:</span> <span class="font-medium">${v.anio || "-"}</span></div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border p-6">
          <h2 class="font-semibold mb-3">Realizar oferta</h2>
          <div id="loginRequerido" class="hidden mb-3 text-sm bg-blue-50 text-blue-700 p-3 rounded-lg">
            Debes <a href="login.html" class="underline font-medium">iniciar sesión</a> para ofertar.
          </div>
          <div id="ofertaCerrada" class="hidden mb-3 text-sm bg-gray-100 text-gray-700 p-3 rounded-lg font-medium">
            Oferta cerrada. Esta subasta ya no acepta pujas.
          </div>
          <form id="formPuja" class="space-y-3">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Monto de tu puja (Q.)</label>
              <input type="number" id="montoPuja" step="1" required class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p id="infoMinimo" class="text-xs text-gray-500 mt-1"></p>
            </div>
            <button type="submit" id="btnPujar" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50">Ofertar</button>
          </form>
          <p id="msgPuja" class="text-sm mt-2"></p>
          <p class="text-xs text-gray-500 mt-3">Regla: toda nueva puja debe superar la actual en al menos un <strong>10%</strong>. No se revela la identidad de los ofertantes.</p>
        </div>
      </div>
    </div>
  `;

  renderCarrusel();
  conectarTiempoReal();
  configurarFormPuja();
  actualizarUI();
}

function renderCarrusel() {
  const tCont = document.getElementById("thumbs");
  const carrImg = document.getElementById("carruselImg");
  if (!tCont) return;
  tCont.innerHTML = "";
  imagenes.forEach((src, i) => {
    const t = document.createElement("img");
    t.src = src;
    t.className =
      "w-24 h-16 object-cover rounded border cursor-pointer shrink-0 hover:ring-2 hover:ring-blue-500" +
      (i === 0 ? " ring-2 ring-blue-500" : "");
    t.addEventListener("click", () => {
      imgIndex = i;
      pintarCarrusel();
    });
    tCont.appendChild(t);
  });

  const prev = document.getElementById("btnPrev");
  const next = document.getElementById("btnNext");
  if (prev) prev.addEventListener("click", () => {
    imgIndex = (imgIndex - 1 + imagenes.length) % imagenes.length;
    pintarCarrusel();
  });
  if (next) next.addEventListener("click", () => {
    imgIndex = (imgIndex + 1) % imagenes.length;
    pintarCarrusel();
  });

  function pintarCarrusel() {
    const img = document.getElementById("carruselImg");
    if (img) img.src = imagenes[imgIndex];
    const cont = document.getElementById("carrContador");
    if (cont) cont.textContent = `${imgIndex + 1} / ${imagenes.length}`;
    tCont.querySelectorAll("img").forEach((im, ii) =>
      im.classList.toggle("ring-2", ii === imgIndex)
    );
    tCont.querySelectorAll("img").forEach((im, ii) =>
      im.classList.toggle("ring-blue-500", ii === imgIndex)
    );
  }
}

// ================= TIEMPO REAL =================
function conectarTiempoReal() {
  if (unsubSubasta) unsubSubasta();
  unsubSubasta = onSnapshot(doc(db, "subastas", subastaIdActual), (snap) => {
    if (snap.exists()) {
      const antes = subastaData?.pujaActual;
      subastaData = { id: snap.id, ...snap.data() };
      if (
        antes !== undefined &&
        antes !== subastaData.pujaActual &&
        currentUser &&
        subastaData.ganadorUid !== currentUser.uid
      ) {
        mostrarMsg(
          "¡Tu oferta fue superada! Hay una puja más alta.",
          "superada"
        );
      }
      actualizarUI();
    }
  });

  if (!timerInterval) timerInterval = setInterval(tick, 1000);
}

function actualizarUI() {
  if (!subastaData) return;

  const pa = document.getElementById("pujaActual");
  const est = document.getElementById("estadoSubasta");
  const pb = document.getElementById("precioBase");
  if (pa) pa.textContent = formatQ(subastaData.pujaActual);
  if (pb) pb.textContent = formatQ(subastaData.precioBase);
  const ed = estadoDerivado();
  if (est) est.textContent = ed;

  actualizarBadge();
  actualizarFormPuja();
  tick();
}

function actualizarBadge() {
  const badge = document.getElementById("badgeEstadoPuja");
  if (!badge) return;
  const ed = estadoDerivado();
  if (ed !== "activa") {
    badge.innerHTML = "";
    return;
  }
  if (subastaData.ganadorUid && currentUser && subastaData.ganadorUid === currentUser.uid) {
    badge.innerHTML =
      '<span class="bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-semibold shadow-sm fade-in">¡Vas ganando esta subasta!</span>';
  } else if (subastaData.ganadorUid) {
    badge.innerHTML =
      '<span class="bg-red-100 text-red-700 px-4 py-1.5 rounded-full font-semibold shadow-sm fade-in">Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!</span>';
  } else {
    badge.innerHTML = "";
  }
}

function actualizarFormPuja() {
  const ed = estadoDerivado();
  const loginReq = document.getElementById("loginRequerido");
  const cerrada = document.getElementById("ofertaCerrada");
  const form = document.getElementById("formPuja");
  const btn = document.getElementById("btnPujar");
  const input = document.getElementById("montoPuja");
  const info = document.getElementById("infoMinimo");

  if (loginReq) loginReq.classList.toggle("hidden", !!currentUser);
  if (cerrada) cerrada.classList.toggle("hidden", ed === "activa");
  if (form) form.classList.toggle("hidden", ed !== "activa");

  const min = pujaMinima();
  if (input) {
    input.min = min;
    if (!input.value) input.value = min;
  }
  if (info)
    info.textContent = `Mínimo requerido (incremento del 10%): Q. ${min.toLocaleString("es-GT")}`;

  if (btn) btn.disabled = !currentUser || ed !== "activa";
}

function tick() {
  const el = document.getElementById("temporizador");
  if (!el || !subastaData) return;
  const ed = estadoDerivado();
  const fin = subastaData.horaFin?.toMillis?.() || 0;
  let diff = fin - Date.now();

  if (diff <= 0) {
    el.textContent = ed === "desierta" ? "Subasta desierta" : "Oferta cerrada";
    el.className = "text-xl font-semibold text-gray-600";
    intentarCierrePersistente();
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  el.textContent = (d > 0 ? `${d}d ` : "") + `${pad(h)}:${pad(m)}:${pad(s)}`;
  el.className = "text-2xl font-mono font-semibold text-blue-700";
}

// Persiste el cierre cuando vence el tiempo (validado por Firestore Rules)
async function intentarCierrePersistente() {
  if (!currentUser || cerrando || !subastaData) return;
  if (subastaData.estado !== "activa") return;
  const fin = subastaData.horaFin?.toMillis?.() || 0;
  if (Date.now() < fin) return;
  cerrando = true;
  try {
    const nuevo = subastaData.ganadorUid ? "cerrada" : "desierta";
    await updateDoc(doc(db, "subastas", subastaIdActual), { estado: nuevo });
  } catch (e) {
    // Reloj del cliente un poco atrasado: se reintenta en el proximo tick
    console.log("Cierre pendiente:", e.message);
  } finally {
    setTimeout(() => (cerrando = false), 5000);
  }
}

// ================= PUJA =================
function mostrarMsg(texto, tipo) {
  const msg = document.getElementById("msgPuja");
  if (!msg) return;
  msg.textContent = texto;
  msg.className =
    "text-sm mt-2 fade-in " +
    (tipo === "ok" ? "text-green-600" : tipo === "superada" ? "text-orange-600" : "text-red-600");
}

function configurarFormPuja() {
  const form = document.getElementById("formPuja");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      mostrarMsg("Debes iniciar sesión para ofertar.", "error");
      return;
    }
    if (!subastaData) return;

    const ed = estadoDerivado();
    if (ed !== "activa") {
      mostrarMsg("La subasta ya está cerrada.", "error");
      return;
    }

    const monto = Number(document.getElementById("montoPuja").value);
    const min = pujaMinima();
    const pb = Number(subastaData.precioBase || 0);
    const pa = Number(subastaData.pujaActual || 0);

    if (isNaN(monto) || monto <= 0) {
      mostrarMsg("Monto inválido.", "error");
      return;
    }
    if (monto < pb) {
      mostrarMsg(`La oferta no puede ser menor al precio base (${formatQ(pb)}).`, "error");
      return;
    }
    if (monto <= pa) {
      mostrarMsg(`Debes superar la oferta actual (${formatQ(pa)}).`, "error");
      return;
    }
    if (monto < min) {
      mostrarMsg(
        `El incremento mínimo es del 10%. Mínimo requerido: ${formatQ(min)}.`,
        "error"
      );
      return;
    }

    const btn = e.submitter;
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ofertando...';

    try {
      const batch = writeBatch(db);
      const pujaRef = doc(collection(db, "pujas"));
      batch.set(pujaRef, {
        subastaId: subastaIdActual,
        monto,
        timestamp: serverTimestamp(),
      });
      batch.update(doc(db, "subastas", subastaIdActual), {
        pujaActual: monto,
        ganadorUid: currentUser.uid,
        ultimaPujaEn: serverTimestamp(),
      });
      await batch.commit();
      mostrarMsg(`¡Puja de ${formatQ(monto)} registrada con éxito!`, "ok");
      const input = document.getElementById("montoPuja");
      if (input) input.value = "";
    } catch (error) {
      console.error(error);
      let m = "No se pudo registrar la puja.";
      if (error.code === "permission-denied")
        m = "Puja rechazada por las reglas: verifica el incremento del 10%, el precio base y que el tiempo no haya finalizado.";
      else if (error.message) m = error.message;
      mostrarMsg(m, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      actualizarFormPuja();
    }
  });
}

// ================= CARGA =================
async function cargarDetalle() {
  const vehiculoId = getParamId();
  if (!detalleContainer) return;
  if (!vehiculoId) {
    detalleContainer.innerHTML =
      '<div class="bg-white p-8 rounded-2xl border text-center text-red-600">Vehículo no encontrado.</div>';
    return;
  }
  subastaIdActual = vehiculoId;

  try {
    const vSnap = await getDoc(doc(db, "vehiculos", vehiculoId));
    if (!vSnap.exists()) {
      detalleContainer.innerHTML =
        '<div class="bg-white p-8 rounded-2xl border text-center text-red-600">Vehículo no encontrado.</div>';
      return;
    }
    const v = vSnap.data();

    const sSnap = await getDoc(doc(db, "subastas", vehiculoId));
    if (!sSnap.exists()) {
      detalleContainer.innerHTML = `
        <div class="bg-white p-8 rounded-2xl border text-center">
          <h2 class="text-xl font-bold">${v.marca} ${v.modelo} ${v.anio || ""}</h2>
          <p class="text-gray-500 mt-2">Este vehículo aún no tiene una subasta activa.</p>
          <a href="index.html" class="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">Volver al inventario</a>
        </div>`;
      return;
    }
    subastaData = { id: sSnap.id, ...sSnap.data() };

    // Fotos 2..5
    const extras = [];
    const fotosSnap = await getDocs(collection(db, "vehiculos", vehiculoId, "fotos"));
    fotosSnap.forEach((d) => extras.push({ orden: d.data().orden, data: d.data().data }));
    extras.sort((a, b) => a.orden - b.orden);
    imagenes = [v.portada, ...extras.map((f) => f.data)].filter(Boolean);

    renderDetalle(v);

    onAuthStateChanged(auth, (u) => {
      currentUser = u;
      actualizarBadge();
      actualizarFormPuja();
      intentarCierrePersistente();
    });
  } catch (e) {
    console.error(e);
    detalleContainer.innerHTML =
      '<div class="bg-white p-8 rounded-2xl border text-center text-red-600">Error al cargar la subasta.</div>';
  }
}

if (window.location.pathname.includes("subasta.html")) {
  cargarDetalle();
}

window.addEventListener("beforeunload", () => {
  if (unsubSubasta) unsubSubasta();
  if (timerInterval) clearInterval(timerInterval);
});
