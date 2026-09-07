ALTER TABLE pets RENAME COLUMN is_active TO "isActive";
DROP INDEX IF EXISTS pets_tutor_id_is_active_idx;
CREATE INDEX IF NOT EXISTS pets_tutor_id_is_active_idx ON pets ("tutorId", "isActive");
