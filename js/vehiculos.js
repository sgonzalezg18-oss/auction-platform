import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
  Timestamp,
  onAuthStateChanged,
} from "./firebase.js";

// ================= REFERENCIAS DOM =================
const formPublicar = document.getElementById("formPublicar");
const previewContainer = document.getElementById("previewContainer");
const inputFotos = document.getElementById("fotos");
const errorPublicar = document.getElementById("errorPublicar");
const successPublicar = document.getElementById("successPublicar");
const gridVehiculos = document.getElementById("gridVehiculos");
const gridMisPublicaciones = document.getElementById("gridMisPublicaciones");

const busqueda = document.getElementById("busqueda");
const filtroAnio = document.getElementById("filtroAnio");
const filtroMarca = document.getElementById("filtroMarca");
const filtroModelo = document.getElementById("filtroModelo");
const filtroCombustible = document.getElementById("filtroCombustible");
const filtroTransmision = document.getElementById("filtroTransmision");
const filtroDano = document.getElementById("filtroDano");
const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn");

let archivosFotos = [];
let vehiculosCache = [];
let modoEdicion = false;
let vehiculoEditandoId = null;

// ================= UTILIDADES =================
function formatQ(v) {
  const n = Number(v || 0);
  return "Q. " + n.toLocaleString("es-GT", { maximumFractionDigits: 0 });
}

function badgeDano(estadoDano) {
  if (estadoDano === "verde")
    return '<span class="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Daño menor</span>';
  if (estadoDano === "amarillo")
    return '<span class="bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Daño medio</span>';
  if (estadoDano === "rojo")
    return '<span class="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Daño severo</span>';
  return "";
}

// ================= COMPRECION DE IMAGENES (gratuito: se guardan en Firestore) =================
async function comprimirImagen(file, maxAncho = 900, calidad = 0.72) {
  let img;
  try {
    img = await createImageBitmap(file);
  } catch (e) {
    img = await new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const i = new Image();
      i.onload = () => {
        URL.revokeObjectURL(url);
        res(i);
      };
      i.onerror = () => {
        URL.revokeObjectURL(url);
        rej(new Error("No se pudo leer la imagen"));
      };
      i.src = url;
    });
  }

  const escala = Math.min(1, maxAncho / img.width);
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  if (img.close) img.close();

  let q = calidad;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > 940000 && q > 0.35) {
    q -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

// ================= PREVIEW DE FOTOS =================
if (inputFotos) {
  inputFotos.addEventListener("change", (e) => {
    archivosFotos = Array.from(e.target.files).slice(0, 5);
    renderPreview();
  });
}

function renderPreview() {
  if (!previewContainer) return;
  previewContainer.innerHTML = "";
  archivosFotos.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const div = document.createElement("div");
      div.className = "relative group";
      div.innerHTML = `
        <img src="${ev.target.result}" class="w-full h-32 object-cover rounded-lg border" alt="Foto ${i + 1}">
        <button type="button" data-idx="${i}" class="btn-quitar absolute top-1 right-1 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition">Quitar</button>
      `;
      previewContainer.appendChild(div);
      previewContainer.querySelectorAll(".btn-quitar").forEach((b) => {
        b.addEventListener("click", (e2) => {
          archivosFotos.splice(parseInt(e2.target.dataset.idx), 1);
          renderPreview();
          if (archivosFotos.length === 0 && inputFotos) inputFotos.value = "";
        });
      });
    };
    reader.readAsDataURL(file);
  });
}

// ================= PUBLICAR / EDITAR VEHICULO =================
if (formPublicar) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const editarId = params.get("editar");
    if (editarId) cargarParaEditar(editarId);
  });

  formPublicar.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorPublicar) errorPublicar.textContent = "";
    if (successPublicar) successPublicar.textContent = "";

    const user = auth.currentUser;
    if (!user) {
      if (errorPublicar) errorPublicar.textContent = "Debes iniciar sesión.";
      return;
    }
    if (modoEdicion) {
      if (archivosFotos.length > 0 && archivosFotos.length < 5) {
        if (errorPublicar)
          errorPublicar.textContent =
            "Si reemplazas las fotografías debes seleccionar las 5. Si no deseas cambiarlas, deja el campo vacío.";
        return;
      }
    } else if (archivosFotos.length < 5) {
      if (errorPublicar)
        errorPublicar.textContent = "Debes seleccionar mínimo 5 fotografías.";
      return;
    }

    const btn = e.submitter || formPublicar.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      if (modoEdicion) {
        await actualizarVehiculo();
        if (successPublicar) successPublicar.textContent = "¡Publicación actualizada!";
        setTimeout(() => (window.location.href = "mis-publicaciones.html"), 1000);
      } else {
        await publicarVehiculo(user);
        if (successPublicar) successPublicar.textContent = "¡Vehículo publicado correctamente!";
        setTimeout(() => (window.location.href = "mis-publicaciones.html"), 1200);
      }
    } catch (error) {
      console.error(error);
      let msg = "Error al guardar. Verifica todos los datos.";
      if (error.code === "permission-denied")
        msg = "No tienes permiso (las reglas de seguridad lo bloquearon). Verifica precio base (mín. Q.20,000), fechas y fotografías.";
      else if (error.message) msg = error.message;
      if (errorPublicar) errorPublicar.textContent = msg;
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

function leerFicha() {
  return {
    anio: parseInt(document.getElementById("anio").value),
    tipoArticulo: document.getElementById("tipoArticulo").value.trim(),
    marca: document.getElementById("marca").value.trim(),
    modelo: document.getElementById("modelo").value.trim(),
    motor: document.getElementById("motor").value.trim(),
    transmision: document.getElementById("transmision").value,
    combustible: document.getElementById("combustible").value,
    trenManejo: document.getElementById("trenManejo").value,
    cilindros: document.getElementById("cilindros").value.trim(),
    estadoDano: document.querySelector('input[name="estadoDano"]:checked')?.value,
  };
}

function leerSubasta() {
  const precioBase = Number(document.getElementById("precioBase").value);
  const inicio = document.getElementById("horaInicio").value;
  const fin = document.getElementById("horaFin").value;

  if (isNaN(precioBase) || precioBase < 20000)
    throw new Error("El precio base mínimo es Q. 20,000.");
  if (!inicio || !fin) throw new Error("Debes indicar fecha y hora de inicio y cierre.");
  const hi = new Date(inicio);
  const hf = new Date(fin);
  if (isNaN(hi.getTime()) || isNaN(hf.getTime()))
    throw new Error("Fechas inválidas.");
  if (hf <= hi)
    throw new Error("La fecha de cierre debe ser posterior a la de inicio.");
  if (hf.getTime() <= Date.now())
    throw new Error("La fecha de cierre debe ser futura.");
  return { precioBase, hi, hf };
}

async function publicarVehiculo(user) {
  const ficha = leerFicha();
  const sub = leerSubasta();

  const vehRef = doc(collection(db, "vehiculos"));
  const vehiculoId = vehRef.id;

  const btn = document.querySelector("#formPublicar button[type='submit']");
  if (btn) btn.innerHTML = '<span class="spinner"></span> Comprimiendo fotos...';

  const portada = await comprimirImagen(archivosFotos[0], 900, 0.72);
  const batch = writeBatch(db);

  batch.set(vehRef, {
    ...ficha,
    publicadorId: user.uid,
    portada,
    imagenes: 5,
    publicado: true,
    creadoEn: serverTimestamp(),
  });

  // Subasta en la misma transaccion (id del doc = id del vehiculo)
  batch.set(doc(db, "subastas", vehiculoId), {
    vehiculoId,
    precioBase: sub.precioBase,
    pujaActual: sub.precioBase,
    ganadorUid: null,
    horaInicio: Timestamp.fromDate(sub.hi),
    horaFin: Timestamp.fromDate(sub.hf),
    estado: "activa",
    ultimaPujaEn: null,
    creadaEn: serverTimestamp(),
    creadaPor: user.uid,
  });

  // Fotos 2..5 en subcoleccion
  for (let i = 1; i < archivosFotos.length; i++) {
    const data = await comprimirImagen(archivosFotos[i], 900, 0.7);
    batch.set(doc(db, "vehiculos", vehiculoId, "fotos", "f" + (i + 1)), {
      orden: i + 1,
      data,
    });
  }

  await batch.commit();
}

async function actualizarVehiculo() {
  const ficha = leerFicha();
  await updateDoc(doc(db, "vehiculos", vehiculoEditandoId), ficha);

  if (archivosFotos.length === 5) {
    const btn = document.querySelector("#formPublicar button[type='submit']");
    if (btn) btn.innerHTML = '<span class="spinner"></span> Comprimiendo fotos...';
    const portada = await comprimirImagen(archivosFotos[0], 900, 0.72);
    await updateDoc(doc(db, "vehiculos", vehiculoEditandoId), { portada });
    for (let i = 1; i < archivosFotos.length; i++) {
      const data = await comprimirImagen(archivosFotos[i], 900, 0.7);
      await setDoc(
        doc(db, "vehiculos", vehiculoEditandoId, "fotos", "f" + (i + 1)),
        { orden: i + 1, data },
        { merge: true }
      );
    }
  }
}

async function cargarParaEditar(id) {
  try {
    const snap = await getDoc(doc(db, "vehiculos", id));
    if (!snap.exists()) {
      if (errorPublicar) errorPublicar.textContent = "Vehículo no encontrado.";
      return;
    }
    modoEdicion = true;
    vehiculoEditandoId = id;
    const v = snap.data();

    document.getElementById("anio").value = v.anio || "";
    document.getElementById("tipoArticulo").value = v.tipoArticulo || "";
    document.getElementById("marca").value = v.marca || "";
    document.getElementById("modelo").value = v.modelo || "";
    document.getElementById("motor").value = v.motor || "";
    document.getElementById("transmision").value = v.transmision || "";
    document.getElementById("combustible").value = v.combustible || "";
    document.getElementById("trenManejo").value = v.trenManejo || "";
    document.getElementById("cilindros").value = v.cilindros || "";
    const radio = document.querySelector(
      `input[name="estadoDano"][value="${v.estadoDano || ""}"]`
    );
    if (radio) radio.checked = true;

    // Parametros de subasta: solo lectura al editar
    const sSnap = await getDoc(doc(db, "subastas", id));
    if (sSnap.exists()) {
      const s = sSnap.data();
      const pb = document.getElementById("precioBase");
      const hi = document.getElementById("horaInicio");
      const hf = document.getElementById("horaFin");
      if (pb) {
        pb.value = s.precioBase;
        pb.disabled = true;
      }
      if (hi) {
        hi.value = toLocalInput(s.horaInicio);
        hi.disabled = true;
      }
      if (hf) {
        hf.value = toLocalInput(s.horaFin);
        hf.disabled = true;
      }
      const nota = document.getElementById("notaSubasta");
      if (nota)
        nota.classList.remove("hidden");
    }

    const titulo = document.getElementById("tituloForm");
    if (titulo) titulo.textContent = "Editar Publicación";
    const btn = formPublicar.querySelector('button[type="submit"]');
    if (btn) btn.textContent = "Guardar Cambios";
    if (successPublicar)
      successPublicar.textContent = "Editando publicación. Las fotos se conservan si no seleccionas nuevas (mínimo 5 para reemplazar).";
  } catch (e) {
    console.error(e);
    if (errorPublicar) errorPublicar.textContent = "Error al cargar el vehículo.";
  }
}

function toLocalInput(ts) {
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ================= HOME / INVENTARIO =================
async function cargarVehiculosHome() {
  if (!gridVehiculos) return;
  gridVehiculos.innerHTML =
    '<div class="col-span-full text-center py-10 text-gray-500">Cargando vehículos...</div>';

  try {
    const snap = await getDocs(collection(db, "vehiculos"));
    vehiculosCache = [];
    snap.forEach((d) => vehiculosCache.push({ id: d.id, ...d.data() }));
    vehiculosCache.sort(
      (a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0)
    );
    renderVehiculos(vehiculosCache);
    poblarFiltros();
  } catch (e) {
    console.error(e);
    gridVehiculos.innerHTML =
      '<div class="col-span-full text-center py-10 text-red-600">Error al cargar vehículos.</div>';
  }
}

function renderVehiculos(lista) {
  if (!gridVehiculos) return;
  if (lista.length === 0) {
    gridVehiculos.innerHTML =
      '<div class="col-span-full text-center py-10 text-gray-500">No hay vehículos que coincidan con la búsqueda.</div>';
    return;
  }

  gridVehiculos.innerHTML = lista
    .map((v) => {
      const img = v.portada || "";
      return `
      <a href="subasta.html?id=${v.id}" class="bg-white rounded-2xl shadow-sm border overflow-hidden card-hover flex flex-col fade-in">
        <div class="relative h-52 bg-gray-100">
          ${img ? `<img src="${img}" alt="${v.marca} ${v.modelo}" class="w-full h-full object-cover">` : ""}
          <div class="absolute top-3 left-3">${badgeDano(v.estadoDano)}</div>
        </div>
        <div class="p-5 flex-1 flex flex-col">
          <h2 class="text-lg font-bold">${v.marca} ${v.modelo} ${v.anio || ""}</h2>
          <p class="text-gray-500 text-sm mt-1">${v.motor || ""} · ${v.transmision || ""} · ${v.combustible || ""}</p>
          <p class="text-gray-500 text-sm">${v.trenManejo || ""} · ${v.cilindros || ""} cil.</p>
          <div class="mt-auto pt-4">
            <span class="text-sm text-gray-500">${v.tipoArticulo || ""}</span>
            <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg mt-2 font-medium">Ver subasta</button>
          </div>
        </div>
      </a>`;
    })
    .join("");
}

function poblarFiltros() {
  const uniq = (f) => [...new Set(vehiculosCache.map(f).filter(Boolean))];
  const anios = uniq((v) => v.anio).sort((a, b) => b - a);
  const marcas = uniq((v) => v.marca).sort();
  const modelos = uniq((v) => v.modelo).sort();
  const combustibles = uniq((v) => v.combustible).sort();
  const transmisiones = uniq((v) => v.transmision).sort();

  const fill = (el, etiqueta, vals) => {
    if (el)
      el.innerHTML =
        `<option value="">${etiqueta}</option>` +
        vals.map((x) => `<option value="${x}">${x}</option>`).join("");
  };
  fill(filtroAnio, "Todos los años", anios);
  fill(filtroMarca, "Todas las marcas", marcas);
  fill(filtroModelo, "Todos los modelos", modelos);
  fill(filtroCombustible, "Todos los combustibles", combustibles);
  fill(filtroTransmision, "Todas las transmisiones", transmisiones);
}

function aplicarFiltros() {
  let res = [...vehiculosCache];
  const txt = (busqueda?.value || "").trim().toLowerCase();
  if (txt)
    res = res.filter((v) =>
      `${v.marca} ${v.modelo} ${v.tipoArticulo || ""} ${v.motor || ""}`
        .toLowerCase()
        .includes(txt)
    );
  if (filtroAnio?.value) res = res.filter((v) => String(v.anio) === filtroAnio.value);
  if (filtroMarca?.value) res = res.filter((v) => v.marca === filtroMarca.value);
  if (filtroModelo?.value) res = res.filter((v) => v.modelo === filtroModelo.value);
  if (filtroCombustible?.value)
    res = res.filter((v) => v.combustible === filtroCombustible.value);
  if (filtroTransmision?.value)
    res = res.filter((v) => v.transmision === filtroTransmision.value);
  if (filtroDano?.value) res = res.filter((v) => v.estadoDano === filtroDano.value);
  renderVehiculos(res);
}

[busqueda, filtroAnio, filtroMarca, filtroModelo, filtroCombustible, filtroTransmision, filtroDano].forEach(
  (el) => {
    if (el) el.addEventListener("input", aplicarFiltros);
    if (el) el.addEventListener("change", aplicarFiltros);
  }
);
if (limpiarFiltrosBtn)
  limpiarFiltrosBtn.addEventListener("click", () => {
    [busqueda, filtroAnio, filtroMarca, filtroModelo, filtroCombustible, filtroTransmision, filtroDano].forEach(
      (el) => {
        if (el) el.value = "";
      }
    );
    renderVehiculos(vehiculosCache);
  });

if (window.location.pathname.includes("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("/")) {
  cargarVehiculosHome();
}

// ================= MIS PUBLICACIONES =================
async function cargarMisPublicaciones() {
  if (!gridMisPublicaciones) return;
  const user = auth.currentUser;
  if (!user) return;
  gridMisPublicaciones.innerHTML =
    '<div class="col-span-full text-center py-10 text-gray-500">Cargando...</div>';

  try {
    const q = query(
      collection(db, "vehiculos"),
      where("publicadorId", "==", user.uid)
    );
    const snap = await getDocs(q);
    let lista = [];
    snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));

    if (lista.length === 0) {
      gridMisPublicaciones.innerHTML =
        '<div class="col-span-full text-center py-10 text-gray-500">No tienes publicaciones aún. <a class="text-blue-600 underline" href="publicar.html">Publica tu primer vehículo</a></div>';
      return;
    }

    gridMisPublicaciones.innerHTML = lista
      .map((v) => {
        const img = v.portada || "";
        return `
        <div class="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col fade-in">
          <div class="h-48 bg-gray-100">${img ? `<img src="${img}" class="w-full h-full object-cover" alt="">` : ""}</div>
          <div class="p-5 flex-1 flex flex-col">
            <h3 class="font-bold">${v.marca} ${v.modelo} ${v.anio || ""}</h3>
            <p class="text-sm text-gray-500 capitalize">Daño: ${v.estadoDano || "-"}</p>
            <div class="mt-auto pt-4 flex flex-col gap-2">
              <a href="subasta.html?id=${v.id}" class="w-full bg-blue-600 text-white py-2 rounded-lg text-center">Ver subasta</a>
              <a href="publicar.html?editar=${v.id}" class="w-full border border-blue-600 text-blue-600 py-2 rounded-lg text-center">Editar</a>
              <button class="w-full border border-red-600 text-red-600 py-2 rounded-lg btn-eliminar" data-id="${v.id}">Eliminar</button>
            </div>
          </div>
        </div>`;
      })
      .join("");

    gridMisPublicaciones.querySelectorAll(".btn-eliminar").forEach((b) => {
      b.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const sSnap = await getDoc(doc(db, "subastas", id));
        if (sSnap.exists()) {
          alert(
            "No puedes eliminar un vehículo que ya tiene una subasta creada."
          );
          return;
        }
        if (!confirm("¿Eliminar este vehículo y sus fotografías?")) return;
        try {
          const fotosSnap = await getDocs(collection(db, "vehiculos", id, "fotos"));
          const batch = writeBatch(db);
          fotosSnap.forEach((f) => batch.delete(f.ref));
          batch.delete(doc(db, "vehiculos", id));
          await batch.commit();
          cargarMisPublicaciones();
        } catch (err) {
          console.error(err);
          alert("Error al eliminar.");
        }
      });
    });
  } catch (e) {
    console.error(e);
    gridMisPublicaciones.innerHTML =
      '<div class="col-span-full text-center py-10 text-red-600">Error al cargar publicaciones.</div>';
  }
}

if (window.location.pathname.includes("mis-publicaciones.html")) {
  onAuthStateChanged(auth, (u) => {
    if (u) cargarMisPublicaciones();
    else window.location.href = "login.html";
  });
}
