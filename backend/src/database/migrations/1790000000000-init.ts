import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790000000000 implements MigrationInterface {
  name = 'Init1790000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('donneur','hopital','crt','direction','admin');
CREATE TYPE user_status AS ENUM ('actif','suspendu');
CREATE TYPE blood_group AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE sex AS ENUM ('homme','femme');
CREATE TYPE eligibility_status AS ENUM ('en_attente','eligible','temporaire','definitif');
CREATE TYPE donation_type AS ENUM ('sang_total','plaquettes','plasma');
CREATE TYPE donation_source AS ENUM ('urgence','evenement');
CREATE TYPE institution_type AS ENUM ('hopital','banque_sang','centre_transfusion');
CREATE TYPE validation_status AS ENUM ('en_attente','valide','rejete');
CREATE TYPE urgency_level AS ENUM ('normale','urgente','critique');
CREATE TYPE request_status AS ENUM ('en_revue','active','couverte','cloturee','expiree');
CREATE TYPE response_type AS ENUM ('je_viens','ne_peut_pas');
CREATE TYPE event_status AS ENUM ('publie','annule','termine');
CREATE TYPE registration_status AS ENUM ('inscrit','present','absent','annule');
CREATE TYPE notification_type AS ENUM ('urgence','evenement','rappel');
CREATE TYPE notification_status AS ENUM ('en_attente','envoyee','echec','lue');

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  type institution_type NOT NULL,
  validation_status validation_status NOT NULL DEFAULT 'en_attente',
  address text,
  position geography(Point,4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  phone varchar(20) NOT NULL UNIQUE,
  full_name varchar(120),
  password_hash text NOT NULL,
  phone_verified boolean NOT NULL DEFAULT false,
  status user_status NOT NULL DEFAULT 'actif',
  fcm_token text,
  institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donors (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blood_group blood_group NOT NULL,
  blood_group_confirmed boolean NOT NULL DEFAULT false,
  sex sex,
  position geography(Point,4326),
  zone varchar(80),
  available boolean NOT NULL DEFAULT true,
  eligibility_status eligibility_status NOT NULL DEFAULT 'en_attente',
  reeval_date date,
  last_donation_date date,
  next_donation_possible_date date,
  max_radius_km integer NOT NULL DEFAULT 20,
  notif_prefs jsonb NOT NULL DEFAULT '{"alertsEnabled":true,"quietHours":null}',
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eligibility_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(user_id) ON DELETE CASCADE,
  answers_encrypted text NOT NULL,
  result eligibility_status NOT NULL,
  questionnaire_version varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES donors(user_id) ON DELETE CASCADE,
  type donation_type NOT NULL,
  donated_at date NOT NULL,
  place varchar(160),
  source donation_source NOT NULL,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  blood_group blood_group NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  urgency urgency_level NOT NULL DEFAULT 'urgente',
  deadline timestamptz NOT NULL,
  initial_radius_km integer NOT NULL DEFAULT 10,
  current_radius_km integer NOT NULL DEFAULT 10,
  max_radius_km integer NOT NULL DEFAULT 30,
  status request_status NOT NULL DEFAULT 'active',
  anomaly_score numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE request_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  wave_number integer NOT NULL,
  radius_km integer NOT NULL,
  sent_to integer NOT NULL DEFAULT 0,
  coverage numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, wave_number)
);

CREATE TABLE request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES donors(user_id) ON DELETE CASCADE,
  response response_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES users(id),
  title varchar(160) NOT NULL,
  place_name varchar(160) NOT NULL,
  address text,
  position geography(Point,4326),
  event_date date NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]',
  capacity integer NOT NULL CHECK (capacity > 0),
  target_groups blood_group[],
  conditions text,
  status event_status NOT NULL DEFAULT 'publie',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES donors(user_id) ON DELETE CASCADE,
  slot varchar(20) NOT NULL,
  status registration_status NOT NULL DEFAULT 'inscrit',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, donor_id)
);

CREATE TABLE stocks (
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  blood_group blood_group NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  alert_threshold integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, blood_group)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  status notification_status NOT NULL DEFAULT 'en_attente',
  request_id uuid REFERENCES blood_requests(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action varchar(80) NOT NULL,
  entity varchar(60),
  entity_id varchar(64),
  ip varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_donors_position ON donors USING GIST (position);
CREATE INDEX idx_institutions_position ON institutions USING GIST (position);
CREATE INDEX idx_events_position ON events USING GIST (position);
CREATE INDEX idx_donors_selection ON donors (blood_group, eligibility_status, next_donation_possible_date);
CREATE INDEX idx_donations_donor_date ON donations (donor_id, donated_at DESC);
CREATE INDEX idx_requests_status ON blood_requests (status);
CREATE INDEX idx_events_date ON events (event_date);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_log (created_at);
-- une seule alerte d'urgence par donneur et par demande (F3.7)
CREATE UNIQUE INDEX uq_notifications_urgence_once
  ON notifications (user_id, request_id) WHERE type = 'urgence' AND request_id IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
DROP TABLE IF EXISTS audit_log, notifications, stocks, event_registrations, events,
  request_responses, request_waves, blood_requests, donations, eligibility_forms,
  donors, users, institutions CASCADE;
DROP TYPE IF EXISTS notification_status, notification_type, registration_status, event_status,
  response_type, request_status, urgency_level, validation_status, institution_type,
  donation_source, donation_type, eligibility_status, sex, blood_group, user_status, user_role;
    `);
  }
}
