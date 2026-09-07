-- Extensões para busca de texto, geolocalização e cálculo de distância
-- pg_trgm: busca por similaridade de texto (nomes de profissionais, serviços)
-- unaccent: busca sem acentos para matches em português
-- cube + earthdistance: cálculo de distância geoespacial para ranking local
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;