-- Etapa 6.2 — dedupe + unique parcial (1 PENDING por entidade)

DELETE FROM verification_requests a
USING verification_requests b
WHERE a."entityType" = b."entityType"
  AND a."entityId" = b."entityId"
  AND a.status = 'PENDING'
  AND b.status = 'PENDING'
  AND (a."requestedAt" > b."requestedAt" OR (a."requestedAt" = b."requestedAt" AND a."createdAt" > b."createdAt"));

CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_one_pending_per_entity
ON verification_requests ("entityType", "entityId")
WHERE status = 'PENDING';