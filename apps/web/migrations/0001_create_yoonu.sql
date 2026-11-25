CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, area TEXT NOT NULL, detail TEXT, is_stop INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bus_lines (id TEXT PRIMARY KEY, name TEXT NOT NULL, direction TEXT NOT NULL, from_place TEXT NOT NULL, to_place TEXT NOT NULL, duration_min INTEGER NOT NULL, verified INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS bus_stops (id TEXT PRIMARY KEY, line_id TEXT NOT NULL, name TEXT NOT NULL, "order" INTEGER NOT NULL, walk_info TEXT);
CREATE TABLE IF NOT EXISTS saved_items (id TEXT PRIMARY KEY, user_id TEXT, device_id TEXT, kind TEXT NOT NULL, ref_id TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contributions (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL, line_name TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'reçue', points INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS otp_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

INSERT OR IGNORE INTO places (id, name, kind, area, detail, is_stop) VALUES
('castor', 'Castor', 'Quartier', 'Dakar', 'Point de départ · marché et carrefour', 1),
('ism', 'ISM Dakar', 'Établissement', 'Sicap Liberté', 'Institut Supérieur de Management · près Université', 0),
('univ', 'Université UCAD', 'Arrêt', 'Sicap Liberté', 'Arrêt annoncé par le Tata 24 · descente conseillée', 1),
('liberte6', 'Liberté 6', 'Arrêt', 'Sicap Liberté', 'Tu es ici · point de montée', 1),
('castor-marche', 'Castor Marché', 'Arrêt', 'Castor', 'Départ Tata 24', 1),
('mariste', 'Mariste', 'Adresse', 'Hann-Bel Air', 'Rue HB-271, Hann-Bel Air, Grand Dakar', 0),
('niarry', 'Niarry Tally', 'Adresse', 'Grand Dakar', '26, Rue GD-07, Grand Dakar', 0),
('hlm', 'Marché HLM', 'Marché', 'H.L.M, Dakar', 'Marché HLM, Dakar', 0);

INSERT OR IGNORE INTO bus_lines (id, name, direction, from_place, to_place, duration_min, verified) VALUES
('tata24', 'Tata 24', 'Université', 'Castor', 'Université', 27, 1);

INSERT OR IGNORE INTO bus_stops (id, line_id, name, "order", walk_info) VALUES
('s1', 'tata24', 'Castor Marché', 1, 'Point de montée'),
('s2', 'tata24', 'Castor', 2, 'Point de montée'),
('s3', 'tata24', 'Liberté 6', 3, 'Point de montée'),
('s4', 'tata24', 'Derklé', 4, 'Point de montée'),
('s5', 'tata24', 'Sicap Liberté', 5, 'Point de montée'),
('s6', 'tata24', 'Bourguiba', 6, 'Point de montée'),
('s7', 'tata24', 'Université UCAD', 7, 'Descendre ici'),
('s8', 'tata24', 'ISM Dakar', 8, '3 min à pied');
