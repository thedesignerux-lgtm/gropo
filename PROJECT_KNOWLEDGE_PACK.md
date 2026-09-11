# PROJECT_KNOWLEDGE_PACK.md — MOVIDO

> Este documento se ha reorganizado en **`docs/`** (segunda pasada, 6 de septiembre de 2026).
> El fichero monolítico que había aquí queda **superado**: no lo uses como referencia.

## Empieza por aquí

| Documento | Para qué |
|---|---|
| **`docs/PROJECT_KNOWLEDGE_PACK.md`** | Índice maestro · **SOURCE OF TRUTH** · CRITICAL SYSTEM MAP · **DO NOT ASSUME** · FIRST THINGS TO CHECK · invariantes · dependency map |
| **`docs/CONTINUE_DEVELOPMENT.md`** | **Manual de operación. Léelo antes de modificar nada** |
| **`docs/ALGORITHM.md`** | El motor de precios, adjudicación y cierre |
| `docs/DATABASE.md` | Esquema real de producción |
| `docs/PAYMENTS.md` | Stripe, holds, webhook, idempotencia |
| `docs/SECURITY.md` | Vulnerabilidades clasificadas |
| `docs/API.md` | Endpoints, server actions y RPC desde el cliente |
| `docs/BUSINESS_RULES.md` | 60 reglas con STATUS demostrable |
| `docs/UX_AND_FLOWS.md` | Pantallas, flujos y estados de UI |
| `docs/ARCHITECTURE.md` | Cómo está montado y por qué (16 ADR) |
| `docs/KNOWN_ISSUES.md` | 28 problemas priorizados P0–P3 |
| `docs/TECHNICAL_DEBT.md` | 19 elementos de deuda estructural |

## La regla que no debes olvidar

> **La base de datos de producción es la fuente de verdad.**
> Los ficheros `supabase/*.sql` son **historia**: 7 de 9 están desfasados y
> `prepare_join.sql` está corrupto. No los tomes por la implementación actual.
