# Cotización — María Celeste Villalba

Contenido listo para cargar en el CRM (`/cotizaciones` → Nueva cotización) y generar el PDF
con el template de siempre (`src/components/cotizacion-pdf-template.tsx`).

- **Tipo de cotización:** `web` (Página Web)
- **Cliente:** María Celeste Villalba — *Capacitaciones en Gestión Pública y Discapacidad*
- **Tel:** 381 402-4675
- **Total:** USD 750 (lista USD 1.150 − USD 400 de descuento por referencia)
- **Modalidad de pago:** 3 pagos mensuales de USD 250

## Documento para el cliente

`celeste-villalba.html` es la propuesta ya maquetada con el mismo diseño del PDF del CRM
(`src/components/cotizacion-pdf-template.tsx`): navy `#101B2A`, acento `#FBC02D`, Montserrat.
Es autocontenido — la tipografía y los logos van embebidos como data URI, así que se ve igual
sin conexión y en cualquier máquina.

Para regenerar el PDF (los `.pdf` no se versionan, ver `.gitignore`):

```sh
chrome --headless --print-to-pdf=Cotizacion_Celeste_Villalba.pdf --no-pdf-header-footer \
  file://$PWD/docs/cotizaciones/celeste-villalba.html
```

---

## Ítems de inversión

| Descripción | Precio (USD) |
|---|---|
| Diseño UX/UI a medida e identidad visual del sitio (5 pantallas) | 220 |
| Desarrollo web responsive, optimización de velocidad y puesta online | 240 |
| Módulo de capacitaciones autoadministrable (catálogo + fichas de curso) | 160 |
| Integración de pasarela de pagos (Mercado Pago: tarjeta, débito y transferencia) | 150 |
| Sistema de agenda: disponibilidad, reserva post-pago y videollamada automática | 190 |
| Panel de inscripciones + emails automáticos de confirmación y recordatorio | 100 |
| SEO técnico, Google Analytics y carga de contenido inicial | 90 |
| Descuento por referencia directa (−35%) | −400 |
| **TOTAL** | **750** |

> El descuento va como ítem con precio negativo: el template suma los ítems y muestra el total,
> así queda a la vista el valor real del trabajo y el beneficio aplicado.

---

## 01. Descripción del Proyecto

Hoy tus capacitaciones se venden de forma manual: el interesado ve un flyer, escribe por WhatsApp, pregunta precio, se coordina el pago, se pasa el comprobante y recién ahí se acuerda una fecha. Cada inscripción te consume tiempo y atención, y muchas consultas se enfrían en el camino porque la respuesta no llega en el momento en que la persona estaba decidida a comprar.

Este proyecto convierte ese proceso en un sistema que trabaja solo. Vas a tener una web propia donde tu marca personal, tu recorrido profesional y tus capacitaciones queden presentados con la jerarquía que corresponde, y donde el interesado pueda leer el programa, entender qué se lleva, pagar con tarjeta o transferencia y elegir el día y horario del encuentro sin que vos intervengas.

La web no es un folleto: es tu canal de ventas y tu secretaria. Vos te ocupás de llevar gente (redes, referidos, instituciones) y de dar las capacitaciones; el sistema se encarga de vender, cobrar, agendar y recordar.

## 02. Alcance y Funcionalidades

**Diseño y marca personal**
- Diseño exclusivo en línea con tu identidad actual (azul institucional y dorado), pensado para transmitir autoridad profesional.
- Sección "Sobre mí" con tu perfil como Administradora Pública, docente y asesora en gestión pública y discapacidad.
- Prueba social: testimonios de participantes, instituciones y organismos con los que trabajaste.
- Diseño 100% responsive, optimizado para el celular, que es de donde va a llegar la mayoría del tráfico desde Instagram.

**Catálogo de capacitaciones**
- Listado de todas tus capacitaciones con su ficha propia: modalidad, duración, contenidos, a quién está dirigida, qué se lleva y certificado.
- Cargador autoadministrable: sumás, editás o pausás una capacitación desde un panel, sin depender de nosotros ni pagar por cada cambio.
- Formatos contemplados: encuentros personalizados 1 a 1 y cupos grupales con fecha fija.
- Preparado para sumar más adelante cursos grabados o material descargable.

**Pagos online**
- Integración con Mercado Pago: tarjeta de crédito, débito, dinero en cuenta y transferencia.
- Precios en pesos, editables por vos desde el panel.
- Confirmación automática del pago: sin comprobantes por WhatsApp ni chequeos manuales.
- Preparado para pagos desde el exterior en una segunda etapa si empezás a vender fuera del país.

**Agenda y videollamada**
- Calendario con tu disponibilidad real: vos definís qué días y en qué franjas horarias podés dar encuentros.
- Apenas se acredita el pago, la persona elige fecha y hora entre tus horarios libres.
- Se genera automáticamente el link de videollamada (Google Meet o Zoom) y se carga el evento en tu Google Calendar y en el de la persona.
- Bloqueo automático del horario ya reservado: no hay superposiciones ni dobles turnos.

**Automatizaciones y gestión**
- Email automático de confirmación con el detalle de la capacitación, la fecha y el link de acceso.
- Recordatorio automático 24 horas antes del encuentro para bajar el ausentismo.
- Panel de inscripciones: quién compró, qué capacitación, cuándo pagó y para qué fecha quedó agendado.
- Base de contactos exportable para tus futuras campañas y lanzamientos.
- Botón de WhatsApp para consultas previas a la compra.

**Posicionamiento y medición**
- SEO técnico: títulos, metadatos, sitemap y velocidad de carga.
- Google Analytics instalado desde el día uno para saber cuánta gente entra, desde dónde y cuántos compran.
- Imágenes de previsualización para que el link se vea profesional al compartirlo en Instagram, WhatsApp o LinkedIn.
- Dominio propio y hosting configurados y funcionando.

## 03. Cronograma de Trabajo

Tiempo estimado total: **5 semanas** desde la aprobación de la propuesta y la entrega del material.

**Semana 1 — Contenido y estructura**
- Reunión de arranque para ordenar tus capacitaciones, precios y disponibilidad horaria.
- Relevamiento de material: fotos, programas, certificados y testimonios.
- Definición del mapa del sitio y del recorrido de compra.

**Semana 2 — Diseño**
- Diseño de las pantallas principales (inicio, capacitaciones, ficha de curso, checkout y agenda).
- Presentación para tu revisión y una ronda de ajustes incluida.

**Semana 3 y 4 — Desarrollo e integraciones**
- Maquetación del sitio y carga del contenido real.
- Conexión de Mercado Pago y pruebas de cobro reales.
- Sistema de agenda conectado a tu calendario y generación automática de videollamadas.
- Emails automáticos de confirmación y recordatorio.

**Semana 5 — Pruebas y lanzamiento**
- Testeo completo del recorrido: compra, pago, agendamiento, mail y videollamada.
- Ajustes finales, revisión en celular y publicación en tu dominio.
- Capacitación en video para que manejes el panel con autonomía.

## 04. Inversión

*(Se completa con la tabla de ítems cargada en el CRM.)*

## 05. Términos y Modalidad de Pago

**Modalidad de pago: 3 pagos mensuales de USD 250**
- Pago 1 — USD 250 al aceptar la propuesta (arranque del proyecto).
- Pago 2 — USD 250 a los 30 días, con el diseño aprobado y el desarrollo en marcha.
- Pago 3 — USD 250 a los 60 días, contra el lanzamiento del sitio.

Los pagos se pueden hacer en pesos al tipo de cambio del día de cada vencimiento.

**Qué incluye**
- Una ronda de ajustes sobre el diseño y una ronda de correcciones sobre el sitio ya desarrollado.
- Carga inicial de hasta 4 capacitaciones con todo su contenido.
- 30 días de soporte sin cargo desde el lanzamiento para dudas, errores o ajustes menores.
- Video-tutorial de uso del panel para que administres precios, fechas, capacitaciones y disponibilidad.

**Qué queda por fuera**
- Dominio anual (aproximadamente USD 15/año) y comisiones de Mercado Pago por venta, que se abonan directamente a cada proveedor.
- Producción de contenido: fotos profesionales, filmación y redacción de los programas de cada capacitación.
- Funcionalidades no listadas en el alcance (aula virtual, cursos grabados con acceso privado, facturación electrónica, app móvil). Se pueden sumar más adelante y se cotizan aparte.

**Mantenimiento (opcional)**
- USD 25 por mes a partir del segundo mes: hosting, backups, actualizaciones de seguridad y hasta 1 hora mensual de cambios. Se puede dar de baja cuando quieras.

**Condiciones generales**
- La propuesta tiene una validez de 15 días.
- El proyecto arranca con el primer pago y la entrega del material.
- Las demoras en la entrega de contenido o en la devolución de feedback corren los plazos del cronograma.
- La web y todo su contenido son de tu propiedad una vez completados los pagos.
- Si el proyecto se cancela una vez iniciado, se abona el trabajo realizado hasta ese momento.

## 06. Conclusión

Tenés algo que muchos profesionales no tienen: capacitaciones armadas, experiencia real en gestión pública y una audiencia que ya te sigue y te consulta. Lo que falta es la infraestructura para que todo eso se convierta en ventas sin que dependa de tu tiempo.

Una web con pagos y agenda automática cambia dos cosas de fondo. La primera es la percepción: una capacitación que se compra en tres clics vale distinto que una que se negocia por chat. La segunda es la escala: hoy tu techo es cuántas conversaciones podés sostener por día; con el sistema andando, el techo pasa a ser cuántos encuentros querés dar.

Con una sola capacitación vendida por semana, la web se paga sola en dos meses y sigue trabajando para vos todos los días, incluso mientras estás dando clase.

## 07. Próximos Pasos

- Confirmás la propuesta por WhatsApp y coordinamos la reunión de arranque.
- Abonás el primer pago de USD 250 y arrancamos.
- Me pasás el material: fotos, programas de cada capacitación, precios y tu disponibilidad horaria.
- En 5 semanas tenés la web publicada, cobrando y agendando sola.

¿Arrancamos?
