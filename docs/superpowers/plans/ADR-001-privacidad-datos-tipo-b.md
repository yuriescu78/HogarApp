# ADR-001: Bloqueo de datos Tipo B hasta infraestructura NAS

**Estado:** ACEPTADO
**Fecha:** 2026-05-28
**Contexto:** Revisión de producto /office-hours + análisis de seguridad /autoplan

---

## Decisión

Los datos de Tipo B NO se almacenan en Supabase cloud NI se envían a Gemini
ni a ningún otro proveedor externo de IA.

El agent ejecuta un precheck de contenido sensible **antes** de cualquier
llamada al LLM. Si se detecta contenido Tipo B, el flujo se interrumpe:
no se llama a Gemini, no se guarda contenido, y solo se registra el evento
`unsupported_sensitive_data` en `voice_logs` sin incluir ningún fragmento
del contenido original.

---

## Las 4 reglas no negociables

1. **Los datos Tipo B no se almacenan en Supabase cloud.**
   Las tablas `knowledge_entries`, `investment_notes` y `kb_attachments`
   permanecen vacías hasta que exista NAS doméstico configurado y verificado.

2. **Los datos Tipo B no se envían a Gemini ni a ningún proveedor externo de IA.**
   Ni en el mensaje del usuario, ni en el system prompt, ni en el contexto
   de conversación. Si el mensaje contiene datos Tipo B, se interrumpe antes
   de llamar al LLM.

3. **El precheck sensible se ejecuta antes de cualquier llamada LLM.**
   En `loop.ts`, antes de `runGeminiLoop()`, se llama a `containsSensitiveData(text)`.
   Si devuelve `true`, el flujo se corta ahí.

4. **Si se detecta Tipo B: sin LLM, sin persistencia, log neutro.**
   - No se llama a `runGeminiLoop()`.
   - No se guarda nada en ninguna tabla de contenido.
   - Se inserta en `voice_logs`: `{ parsed_intent: 'unsupported_sensitive_data', success: false, raw_input: null }`.
   - JARVIS responde: *"Disculpe, no puedo procesar datos sensibles en este momento.
     Esta función estará disponible cuando la infraestructura local esté configurada."*

---

## Definición de datos Tipo B

- DNI, NIE, número de Seguridad Social
- IBAN, números de tarjeta, datos bancarios
- Pólizas de seguro (número de póliza, condiciones)
- Contraseñas, PINs
- Documentos legales escaneados

Detección mediante `agent/src/utils/masking.ts` (patrones DNI + IBAN ya implementados).
Ampliar con patrones adicionales en Phase 2 antes de activar `knowledge_entries`.

---

## Datos Tipo A (permitidos en cloud desde Phase 0)

Lista de la compra, eventos de calendario, recordatorios de mascotas,
recetas, tareas domésticas, diario de mascotas, logs de voz.

---

## Consecuencias para el plan de Phase 0

- `loop.ts` Task 7 debe incluir el precheck antes de `runGeminiLoop()`.
- `masking.ts` ya tiene los patrones DNI e IBAN — reutilizarlos para detección.
- `voice_logs` registra `unsupported_sensitive_data` sin contenido sensible.
- Phase 2 está bloqueada hasta que NAS esté operativo.

---

## Alternativa rechazada

Cifrado en cliente antes de enviar a Supabase cloud. Rechazada para Phase 0-1 porque:
- añade complejidad de gestión de claves;
- no resuelve el problema si el contenido se envía antes a un proveedor externo de IA;
- el objetivo de Phase 0-1 es validar datos Tipo A, no construir un vault sensible;
- NAS/local-first es la opción que se evaluará antes de Phase 2.

---

## Revisión

Este ADR se revisa cuando el NAS esté operativo o en Phase 2, lo que ocurra primero.
