-- Создание расширения для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Создание ENUM типов для приложения
CREATE TYPE IF NOT EXISTS bookformat AS ENUM ('epub', 'fb2', 'pdf', 'other');
CREATE TYPE IF NOT EXISTS readingstatus AS ENUM ('new', 'reading', 'finished', 'abandoned');
CREATE TYPE IF NOT EXISTS goaltype AS ENUM ('pages_per_day', 'minutes_per_day');

-- Создание пользователя если не существует (для совместимости)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = 'litera_user'
   ) THEN
      CREATE ROLE litera_user WITH LOGIN PASSWORD 'litera_pass';
   END IF;
END
$do$;

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE litera_db TO litera_user;
