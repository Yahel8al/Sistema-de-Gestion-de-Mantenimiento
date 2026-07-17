# Pulso — Sistema de Gestión de Mantenimiento Biomédico Hospitalario

CMMS (Computerized Maintenance Management System) para ingeniería biomédica hospitalaria.
Construido con **React + Vite**, **Firebase** (Auth + Firestore + Storage) y **Tailwind CSS**.

## Estado de este entregable

El esqueleto completo de navegación y los 17 módulos está terminado, y los siguientes
módulos ya fueron profundizados con reglas de negocio reales (segunda fase):

- **Inventario de equipos**: incluye el apartado "Hoja de vida" (enlace externo por equipo),
  visible en la ficha, la tabla y en Historial.
- **Mantenimientos preventivos**: checklist dinámico marcable, cálculo automático de la
  próxima fecha según la frecuencia, semáforo de estado (vencido/próximo/vigente) y botón
  para generar la Orden de trabajo correspondiente con un clic.
- **Mantenimientos correctivos**: cálculo automático del tiempo fuera de servicio (downtime)
  a partir de la fecha/hora de la falla y de la reparación, y generación de Orden de trabajo.
- **Órdenes de trabajo**: firma electrónica (técnico + usuario clínico) obligatoria para
  cerrar una orden, con fecha y hora de conformidad registradas; se ve el origen (preventivo,
  correctivo o calibración) que generó cada orden.
- **Historial del equipo**: línea de tiempo unificada (preventivos, correctivos, calibraciones,
  incidencias y órdenes), enlace a la hoja de vida, desglose de costos/horas/downtime y
  exportación del historial completo a PDF.
- **Gestión documental**: pestañas por tipo de documento y semáforo de vigencia (vencido /
  por vencer / vigente) para garantías, contratos y certificados.
- **Calibraciones**: periodicidad configurable con cálculo automático del vencimiento,
  semáforo de estado y botón para generar la Orden de trabajo de la próxima calibración.
- **Repuestos**: catálogo + libro de movimientos (entradas/salidas) con actualización
  atómica del stock mediante transacciones de Firestore, e historial de movimientos por repuesto.
- **Reportes e indicadores**: más tipos de reporte (costos por equipo, calibraciones vencidas,
  indicadores gerenciales), filtro por rango de fechas y exportación a **PDF real** (jsPDF),
  ya no depende del diálogo de impresión del navegador.
- **Usuarios y permisos**: activación/desactivación de cuentas (una cuenta desactivada no
  puede iniciar sesión), y una matriz de permisos de referencia visible en el propio módulo.

Los demás módulos (Repuestos/Proveedores auxiliares, Incidencias, Cumplimiento normativo,
Alertas, Trazabilidad) siguen funcionando con CRUD real en tiempo real contra Firestore.

**Dashboard**: ahora con filtro por área, lista de mantenimientos programados para los
próximos 7 días (con enlace directo al Calendario) y un feed de actividad reciente del
sistema (alimentado por la Trazabilidad).

**Calendario**: ahora puedes **arrastrar y soltar** un mantenimiento a otro día para
reprogramarlo al instante, filtrar por tipo (preventivo/correctivo/calibración) además
de por área, y hacer clic en cualquier evento para ver su detalle rápido.

## Carga masiva del inventario desde un CSV (primera carga general)

En vez de registrar cada equipo uno por uno desde la aplicación, puedes hacer la
primera carga completa del inventario (o cualquier carga masiva futura) con un script
de línea de comandos:

```bash
cd scripts/importar-inventario
npm install
node import-inventario.js mi-inventario.csv --dry-run   # valida sin subir nada
node import-inventario.js mi-inventario.csv              # sube de verdad
```

La guía completa —incluyendo cómo obtener las credenciales, el orden exacto de las
columnas del CSV, y los valores válidos para área/estado/criticidad— está en
[`scripts/importar-inventario/README.md`](./scripts/importar-inventario/README.md).
Ahí también encontrarás `plantilla-inventario.csv`, lista para usar como punto de partida.

## Infraestructura: notificaciones automáticas por correo (Cloud Functions)

Se agregó la carpeta `functions/` con 3 Cloud Functions:

- **`alertasDiarias`**: todos los días a las 07:00 envía un correo resumen con órdenes
  vencidas/próximas, calibraciones por vencer, garantías/contratos por vencer y repuestos
  con stock bajo, a todos los administradores e ingenieros clínicos activos.
- **`notificarIncidenciaCritica`**: envía un correo inmediato cuando se reporta una
  incidencia de gravedad **alta**.
- **`notificarCorrectivoCritico`**: envía un correo inmediato cuando se reporta un
  correctivo de prioridad **alta**.

También se agregó numeración atómica de órdenes de trabajo (`src/lib/counters.js`), que
usa una transacción de Firestore para que dos técnicos no puedan generar el mismo número
de orden aunque trabajen al mismo tiempo.

**La guía completa de configuración de correo (SMTP, secretos, despliegue) está en
[`functions/README.md`](./functions/README.md).** En resumen:

```bash
cd functions
npm install
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase deploy --only functions
```

> Nota: las funciones programadas y el envío de correo requieren el plan **Blaze** de
> Firebase (pago por uso). Para el volumen de un hospital, el costo mensual real es
> prácticamente $0 gracias a la capa gratuita.

## 1. Requisitos previos

- Node.js 18 o superior
- Una cuenta de [Firebase](https://console.firebase.google.com/)
- Una cuenta de GitHub

## 2. Configurar el proyecto de Firebase

1. Entra a la [consola de Firebase](https://console.firebase.google.com/) y crea un proyecto nuevo.
2. Ve a **Compilación → Authentication → Comenzar** y habilita el proveedor **Correo electrónico/contraseña**.
3. Ve a **Compilación → Firestore Database → Crear base de datos** (modo producción, elige la región más cercana a tu hospital).
4. Ve a **Compilación → Storage** y actívalo (se usa para adjuntar evidencias en el futuro).
5. Ve a **Configuración del proyecto → General → Tus apps → Web (`</>`)** y registra una app web.
   Copia el objeto `firebaseConfig` que te muestra.

## 3. Configurar las variables de entorno

En la raíz del proyecto, copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Y completa cada valor con los datos de tu `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

El archivo `.env` nunca se sube a GitHub (ya está en `.gitignore`).

## 4. Publicar las reglas de seguridad de Firestore

Este proyecto incluye `firestore.rules` con permisos diferenciados por rol
(administrador, ingeniero clínico, técnico biomédico, supervisor, usuario clínico, auditor).

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # selecciona tu proyecto de Firebase
firebase deploy --only firestore:rules
```

## 5. Crear el primer usuario administrador

Como el módulo de Usuarios está protegido (solo se ve estando autenticado), el primer
usuario administrador se crea manualmente la primera vez:

1. En la consola de Firebase, ve a **Authentication → Users → Add user** y crea el correo/contraseña del administrador.
2. Copia el **UID** generado.
3. Ve a **Firestore Database → Iniciar colección** y crea la colección `usuarios` con un documento
   cuyo ID sea ese mismo UID, con estos campos:
   - `nombre` (string): nombre del administrador
   - `email` (string): su correo
   - `rol` (string): `admin`
   - `activo` (boolean): `true`

A partir de ahí, ese administrador puede crear el resto de usuarios desde el propio módulo de Usuarios.

## 6. Ejecutar en desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con el usuario administrador que creaste.

## 7. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Sistema Pulso: esqueleto completo de módulos CMMS biomédico"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

## 8. Desplegar a producción (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

También puedes desplegar en Vercel o Netlify apuntando el build command a `npm run build`
y el output directory a `dist`.

## 9. Activar las notificaciones automáticas por correo (opcional pero recomendado)

Ver la guía completa en [`functions/README.md`](./functions/README.md). Resumen rápido:

```bash
cd functions
npm install
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase deploy --only functions
```

## Estructura del proyecto

```
src/
  components/       Layout, UI compartida (Badge, Modal, Card...) y el motor genérico CollectionManager
  context/          AuthContext (Firebase Auth + rol desde Firestore)
  lib/              firebase.js (config), modules.js (navegación/roles), audit.js (trazabilidad)
  pages/            Un archivo por cada uno de los 17 módulos + Dashboard + Login
firestore.rules     Reglas de seguridad por rol
firebase.json       Configuración de Hosting/Firestore para la CLI de Firebase
```

## Módulos incluidos

1. Inventario de equipos
2. Mantenimientos preventivos
3. Mantenimientos correctivos
4. Órdenes de trabajo (vista Kanban)
5. Gestión de calibraciones
6. Gestión documental
7. Historial del equipo
8. Repuestos e inventario
9. Gestión de proveedores
10. Alertas y notificaciones
11. Indicadores (KPIs)
12. Reportes (con exportación a PDF)
13. Gestión de usuarios (con roles)
14. Gestión de incidencias
15. Cumplimiento normativo (IEC 60601, ISO 13485, ISO 14971, autoridad sanitaria local)
16. Trazabilidad / auditoría
17. Calendario de mantenimientos por área
18. Panel de control (Dashboard)

## Próximos pasos sugeridos

Ver `NEXT_STEPS.md` para el detalle de qué profundizar en cada módulo.
