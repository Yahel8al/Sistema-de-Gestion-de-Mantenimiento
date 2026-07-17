# Carga masiva de inventario desde CSV

Este script sube muchos equipos de una sola vez al módulo **Inventario de equipos**,
para la primera carga general (o cualquier carga masiva futura), en vez de crearlos
uno por uno desde la aplicación.

Se ejecuta con Node.js desde cualquier terminal (bash, PowerShell, cmd, la terminal de
VS Code, etc. — no importa cuál uses, el comando es el mismo).

## 1. Organización del archivo CSV

El archivo debe tener **exactamente estas columnas, en este orden**, en la primera fila
(el encabezado). Usa la plantilla incluida (`plantilla-inventario.csv`) como punto de
partida: ábrela, bórrale las filas de ejemplo y llénala con tus equipos reales.

| # | Columna | Obligatorio | Qué va aquí | Ejemplo |
|---|---|---|---|---|
| 1 | `codigo` | **Sí** | Código o número de activo, único por equipo | `EQ-0001` |
| 2 | `nombre` | **Sí** | Nombre del equipo | `Monitor de signos vitales UCI 1` |
| 3 | `tipo` | No | Tipo de equipo (texto libre) | `Monitor de signos vitales` |
| 4 | `marca` | No | Marca | `Philips` |
| 5 | `modelo` | No | Modelo | `IntelliVue MX450` |
| 6 | `serie` | No | Número de serie | `SN12345` |
| 7 | `fabricante` | No | Fabricante | `Philips Healthcare` |
| 8 | `fechaCompra` | No | Formato `AAAA-MM-DD` | `2022-03-15` |
| 9 | `fechaInstalacion` | No | Formato `AAAA-MM-DD` | `2022-04-01` |
| 10 | `area` | No | Debe coincidir con una de las áreas del sistema (ver abajo) | `Cuidados Intensivos (UCI)` |
| 11 | `sala` | No | Ubicación específica dentro del área | `Cama 3` |
| 12 | `estado` | No | `activo`, `mantenimiento`, `fuera_servicio` o `baja` (ver equivalencias abajo) | `activo` |
| 13 | `criticidad` | No | `alta`, `media` o `baja` | `alta` |
| 14 | `valorAdquisicion` | No | Solo número, sin símbolo de moneda ni comas | `8500` |
| 15 | `vidaUtilAnios` | No | Solo número | `10` |
| 16 | `hojaVidaUrl` | No | Enlace a la hoja de vida (Drive, etc.) | `https://drive.google.com/...` |

Solo `codigo` y `nombre` son obligatorios; el resto puede quedar vacío y lo completas
después desde la aplicación.

**Áreas reconocidas por el sistema** (si escribes otra cosa, igual se guarda, pero no
hará match con los filtros de Dashboard/Calendario que buscan estos nombres exactos):
`Cuidados Intensivos (UCI)`, `Quirófanos`, `Emergencias`, `Imagenología`,
`Laboratorio Clínico`, `Hemodiálisis`, `Hospitalización`, `Consulta Externa`,
`Esterilización`, `Neonatología`.

**Equivalencias de `estado`** (el script acepta cualquiera de las dos formas, sin
importar mayúsculas/minúsculas):
- `activo` → Activo
- `mantenimiento` o `en mantenimiento` → En mantenimiento
- `fuera_servicio` o `fuera de servicio` → Fuera de servicio
- `baja` o `dado de baja` → Dado de baja

### Cómo guardar el CSV correctamente desde Excel/Google Sheets

- **Excel**: Archivo → Guardar como → elige **"CSV UTF-8 (delimitado por comas)"**
  (no elijas la opción "CSV" simple, esa suele romper las tildes y la Ñ).
- **Google Sheets**: Archivo → Descargar → **Valores separados por comas (.csv)** (ya
  exporta en UTF-8 correctamente).

## 2. Obtener las credenciales de administrador (una sola vez)

1. Ve a la [consola de Firebase](https://console.firebase.google.com/) → tu proyecto.
2. **Configuración del proyecto** (ícono de engranaje) → pestaña **Cuentas de servicio**.
3. Haz clic en **"Generar nueva clave privada"**. Se descargará un archivo `.json`.
4. Renombra ese archivo a `serviceAccountKey.json` y colócalo dentro de esta misma
   carpeta (`scripts/importar-inventario/`).

⚠️ **Este archivo da acceso total a tu base de datos.** Nunca lo subas a GitHub (ya está
protegido por el `.gitignore` de esta carpeta) ni lo compartas.

## 3. Instalar dependencias (una sola vez)

```bash
cd scripts/importar-inventario
npm install
```

## 4. Validar el CSV antes de subir (recomendado)

```bash
node import-inventario.js mi-inventario.csv --dry-run
```

Esto **no sube nada todavía**: solo te muestra cuántos registros están listos y una
lista de avisos/errores (códigos duplicados, filas sin nombre, estados no reconocidos,
etc.) para que corrijas el CSV antes de la carga real.

## 5. Subir de verdad

Cuando el `--dry-run` ya no muestre errores importantes:

```bash
node import-inventario.js mi-inventario.csv
```

Verás el progreso en la terminal y, al final, un resumen con el total de equipos
subidos. Puedes ir directo a la aplicación → módulo **Inventario de equipos** y
verlos aparecer ahí.

## Qué hace el script para protegerte de errores comunes

- **Evita duplicados**: si un `codigo` ya existe en el inventario (o está repetido
  dentro del mismo CSV), esa fila se omite y se avisa en el resumen.
- **Nunca sobre-escribe**: solo *crea* equipos nuevos; no modifica ni borra nada
  existente. Para corregir un equipo ya cargado, edítalo desde la aplicación.
- **Valores por defecto seguros**: si `estado` o `criticidad` vienen vacíos o mal
  escritos, usa `activo` y `media` respectivamente, y te lo avisa para que lo revises.

## Cargas futuras

Puedes volver a usar este mismo script en cualquier momento para cargar equipos
nuevos por lote (por ejemplo, cuando llega un lote de equipos nuevos al hospital),
no es solo para la primera carga.
