CREATE TABLE IF NOT EXISTS data_trade.daily_module_metrics (
  date date NOT NULL,
  module_code text NOT NULL,
  events_count integer NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  anonymous_users integer NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  calculations_count integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, module_code)
);

CREATE INDEX IF NOT EXISTS daily_module_metrics_module_date_idx
  ON data_trade.daily_module_metrics (module_code, date);

CREATE INDEX IF NOT EXISTS daily_module_metrics_date_idx
  ON data_trade.daily_module_metrics (date);

CREATE TABLE IF NOT EXISTS data_trade.daily_user_metrics (
  date date NOT NULL,
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  events_count integer NOT NULL DEFAULT 0,
  modules_used_count integer NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, user_id)
);

CREATE INDEX IF NOT EXISTS daily_user_metrics_user_date_idx
  ON data_trade.daily_user_metrics (user_id, date);

CREATE INDEX IF NOT EXISTS daily_user_metrics_date_idx
  ON data_trade.daily_user_metrics (date);
