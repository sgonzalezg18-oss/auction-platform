# Plataforma Web de Subastas de Vehículos en Tiempo Real (Caso Copart)

Sistema desacoplado (Frontend + API + Base de Datos) de subastas de vehículos en tiempo real.

## Sitio Web Publicado

**https://subastas-autos-a56b8.web.app**

## Stack (100% GRATIS - Plan Spark de Firebase, sin tarjeta de crédito)

| Capa | Tecnología | Costo |
|---|---|---|
| Frontend | HTML5 + Tailwind CSS (CDN) + JavaScript (ES Modules) | Gratis |
| Autenticación | Firebase Authentication (Correo/Contraseña) | Gratis |
| Base de datos | Cloud Firestore (tiempo real con `onSnapshot`) | Gratis |
| Reglas de negocio | Firestore Security Rules (validación en servidor) | Gratis |
| Imágenes | Firestore (JPEG comprimido en el cliente, máx. 5 por vehículo) | Gratis |
| Despliegue | Firebase Hosting | Gratis |

**Nota sobre arquitectura:** las reglas de negocio críticas (incremento mínimo del 10%,
precio base mínimo Q. 20,000, límite de tiempo, autenticación obligatoria) se validan
**en el servidor** mediante Firestore Security Rules, por lo que no es posible saltarlas
desde el navegador. No se requieren Cloud Functions ni AWS S3 (servicios que exigen plan
de pago), por lo que el proyecto completo funciona en el plan gratuito sin tarjeta.

## Requisitos funcionales cubiertos

- Login obligatorio para ofertar/publicar (invitados solo leen el inventario).
- Registro: Nombre, Apellido, Correo, Teléfono y Contraseña.
- Publicación de vehículos: ficha técnica completa, clasificación de daño (Verde/Amarillo/Rojo), mínimo 5 fotografías, precio base (mín. Q. 20,000), fecha/hora de inicio y cierre.
- Edición y búsqueda de mis publicaciones.
- Home con filtros multitarea (búsqueda por texto, Año, Marca, Modelo, Combustible, Transmisión, Nivel de daño).
- Detalle con carrusel de imágenes y ficha técnica.
- Puja: nunca menor al precio base ni a la puja actual; incremento mínimo del **10%**.
- Privacidad: no se revela identidad de ofertantes, solo el monto más alto.
- Tiempo real sin recargar (F5): actualización de montos, temporizador y badges.
- Badge verde "¡Vas ganando esta subasta!" / badge rojo "Tu oferta ha sido superada...".
- Oferta cerrada al terminar el tiempo; subasta desierta si no alcanza el precio base.

## Usuarios de prueba

| Correo | Contraseña |
|---|---|
| usuario1@prueba.com | prueba123 |
| usuario2@prueba.com | prueba123 |
| usuario3@prueba.com | prueba123 |

*(Se crearán desde el registro web al finalizar el proyecto)*

## Estructura

```
auction-platform/
├── .firebaserc
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── README.md
├── css/estilos.css
├── js/
│   ├── firebase.js      # Config + exports
│   ├── auth.js          # Login/Registro/Sesión
│   ├── vehiculos.js     # Publicar, editar, filtros, subastas
│   └── subastas.js      # Detalle, carrusel, pujas en tiempo real
├── index.html           # Home / Inventario
├── login.html
├── registro.html
├── publicar.html
├── mis-publicaciones.html
└── subasta.html
```

## Despliegue

```bash
firebase login
firebase deploy --only firestore:rules
firebase deploy --only hosting
```
