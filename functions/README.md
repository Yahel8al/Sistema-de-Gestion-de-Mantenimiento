# Cloud Functions — Alertas y notificaciones por correo

Esta carpeta contiene las funciones de backend de Pulso, encargadas de enviar
correos automáticos sin que nadie tenga que entrar a la aplicación:

| Función | Se activa | Qué hace |
|---|---|---|
| `alertasDiarias` | Todos los días a las 07:00 (hora de Ecuador) | Envía un correo resumen con órdenes vencidas/próximas, calibraciones por vencer, garantías/contratos por vencer y repuestos con stock bajo |
| `notificarIncidenciaCritica` | Al crear una incidencia con gravedad **alta** | Envía un correo inmediato al equipo de ingeniería |
| `notificarCorrectivoCritico` | Al crear un correctivo con prioridad **alta** | Envía un correo inmediato al equipo de ingeniería |

Los destinatarios son automáticamente todos los usuarios con rol `admin` o
`ingeniero` que tengan `activo: true` en la colección `usuarios` (ver módulo
Usuarios y permisos en la app).

## 1. Requisito: plan Blaze de Firebase

Las funciones programadas (`alertasDiarias`) y el envío de correo saliente
requieren el plan **Blaze (pago por uso)** de Firebase. El plan Blaze sigue
teniendo una capa gratuita generosa; para el volumen de un hospital (unos
pocos correos al día) el costo mensual es prácticamente $0.

En la consola de Firebase: **Configuración del proyecto → Uso y facturación → Modificar plan → Blaze**.

## 2. Elegir un proveedor de correo (SMTP)

Puedes usar cualquier proveedor SMTP. Dos opciones simples:

**Opción A — Gmail / Google Workspace (recomendado para empezar)**
1. Activa la verificación en dos pasos en la cuenta de correo institucional.
2. Genera una "contraseña de aplicación" en https://myaccount.google.com/apppasswords
3. Usa:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465`
   - `SMTP_USER=` tu correo completo
   - `SMTP_PASS=` la contraseña de aplicación de 16 caracteres

**Opción B — Un proveedor transaccional (SendGrid, Resend, Mailgun, etc.)**
Estos son más confiables para producción (mejor entregabilidad, sin límites
de Gmail). Cualquiera de ellos te da credenciales SMTP; solo cambia
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS` en el paso siguiente.

## 3. Configurar los secretos en Firebase

Los datos sensibles (usuario y contraseña SMTP) se guardan como **secretos**,
nunca en el código ni en el repositorio:

```bash
cd functions
npm install
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

La CLI te pedirá el valor de cada uno de forma interactiva (no queda en el
historial de la terminal).

Si necesitas cambiar el host/puerto/nombre remitente (no son secretos), edita
los valores por defecto directamente en `functions/lib/mailer.js`
(`SMTP_HOST`, `SMTP_PORT`, `ALERTS_FROM_NAME`), o defínelos al desplegar:

```bash
firebase deploy --only functions --set-params SMTP_HOST=smtp.tuproveedor.com,SMTP_PORT=587
```

## 4. Desplegar

```bash
firebase deploy --only functions
```

La primera vez, Firebase también activará automáticamente las APIs de Cloud
Scheduler y Cloud Build necesarias para la función programada.

## 5. Probar sin esperar al horario programado

Puedes forzar la ejecución inmediata de la función programada desde la
consola de Google Cloud (**Cloud Scheduler → alertasDiarias → Forzar ejecución**),
o localmente con el emulador:

```bash
firebase emulators:start --only functions,firestore
```

## 6. Ver los registros (logs)

```bash
firebase functions:log
```

También puedes consultar la colección `notificaciones_enviadas` en
Firestore: cada vez que se envía el digest diario, se guarda un registro
con la fecha, el número de alertas y los destinatarios.

## Estructura

```
functions/
  index.js          Las 3 Cloud Functions (digest diario + 2 notificaciones inmediatas)
  lib/
    mailer.js        Configuración de nodemailer y los secretos SMTP
    firestore.js      Helper para obtener los destinatarios (admin/ingeniero, activos)
    templates.js      Plantillas HTML de los correos, con la identidad visual de Pulso
```

## Próximas mejoras posibles

- Permitir que cada usuario elija qué alertas quiere recibir (preferencias de notificación).
- Añadir un resumen semanal además del diario.
- Registrar reintentos si el envío de correo falla.
- Añadir notificaciones push/in-app además del correo (usando Firebase Cloud Messaging).
