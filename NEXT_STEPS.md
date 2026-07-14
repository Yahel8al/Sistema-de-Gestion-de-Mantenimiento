# Próximos pasos — hoja de ruta sugerida

Este documento resume qué profundizar en cada módulo ahora que el esqueleto completo
de navegación y datos está funcionando. Puedes pedir cualquiera de estos puntos en
tu siguiente mensaje y se construirá en profundidad.

## Alta prioridad (flujo operativo diario)
- **Órdenes de trabajo**: firma electrónica (técnico + usuario clínico) al cerrar una orden,
  adjuntar fotos/evidencia real (Firebase Storage) en vez de solo un enlace.
- **Mantenimientos preventivos**: generación automática de Órdenes de trabajo según la
  frecuencia configurada (mensual/trimestral/semestral/anual) usando Cloud Functions o un
  job programado, en vez de crearlas manualmente.
- **Calendario**: arrastrar y soltar (drag & drop) para reprogramar, vista semanal/diaria.

## Media prioridad (calidad y cumplimiento)
- **Cumplimiento normativo**: checklist estructurado por norma con ítems individuales
  marcables, en vez de un solo registro de texto libre.
- **Incidencias**: flujo de aprobación multi-etapa y notificación automática al reportar
  un evento adverso grave.
- **Calibraciones**: adjuntar el PDF del certificado directamente (Storage) y alerta
  automática 30/15/7 días antes del vencimiento (correo o notificación push).

## Media-baja prioridad (analítica y reportes)
- **KPIs**: refinar el cálculo de MTBF/MTTR con fechas reales de inicio/fin de falla en
  vez de solo horas de downtime declaradas manualmente.
- **Reportes**: generar el PDF con una librería como `jspdf` o `pdf-lib` en vez de depender
  del diálogo de impresión del navegador, con logo y encabezado institucional.
- **Dashboard**: agregar filtro por rango de fechas y por área para todos los gráficos.

## Infraestructura y seguridad
- ✅ **Completado**: Cloud Functions para enviar correos de alerta (digest diario +
  notificaciones inmediatas de incidencias/correctivos críticos). Ver `functions/README.md`.
- ✅ **Completado**: numeración atómica de órdenes de trabajo (`src/lib/counters.js`),
  evita colisiones cuando dos técnicos crean una orden al mismo tiempo.
- Pendiente: respaldos programados de Firestore (Cloud Function adicional con
  exportación hacia un bucket de Cloud Storage, con retención configurable).
- Pendiente: reglas de Firestore más granulares por módulo (ahora mismo son por grupo
  de rol amplio, ver `firestore.rules`).
- Pendiente: migrar el estado de sesión a un listener persistente con `onIdTokenChanged`
  para refrescar permisos si cambia el rol de un usuario sin tener que cerrar sesión.

## Multiusuario / colaboración en tiempo real
- Notificaciones dentro de la app (campanita con contador) además de la vista de Alertas.
- Comentarios/hilo de conversación dentro de cada Orden de trabajo.

---

Dime con cuál de estos quieres continuar y lo desarrollamos a fondo, módulo por módulo.
