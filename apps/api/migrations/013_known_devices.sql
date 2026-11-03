-- Brief 064. Devices that have logged in successfully as a user. A locked username doesn't block them; their own
-- device lock and the IP lock still do (auth/throttle.ts). Never pruned: a user has a handful. Times are the app's
-- clock, UTC.
CREATE TABLE IF NOT EXISTS known_devices (
  user_id         INT UNSIGNED NOT NULL,
  device_id       VARCHAR(64)  NOT NULL,              -- the app's random per-install id (login body deviceId)
  first_login_at  DATETIME     NOT NULL,              -- first successful login from it as this user
  last_login_at   DATETIME     NOT NULL,              -- latest successful login from it as this user
  PRIMARY KEY (user_id, device_id),
  CONSTRAINT fk_known_devices_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
