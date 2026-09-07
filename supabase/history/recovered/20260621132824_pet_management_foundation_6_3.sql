-- Etapa 6.3 — Pet Management Foundation

CREATE TYPE "PetGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
CREATE TYPE "PetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

ALTER TABLE pets ADD COLUMN IF NOT EXISTS gender "PetGender";
ALTER TABLE pets ADD COLUMN IF NOT EXISTS size "PetSize";
ALTER TABLE pets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE pets SET description = notes WHERE description IS NULL AND notes IS NOT NULL;
UPDATE pets SET is_active = true WHERE is_active IS NULL;

-- Species: adicionar RODENT e migrar valores legados
ALTER TYPE "Species" ADD VALUE IF NOT EXISTS 'RODENT';

-- ServiceRequest: petId opcional
ALTER TABLE service_requests ALTER COLUMN "petId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS pets_tutor_id_is_active_idx ON pets ("tutorId", is_active);
