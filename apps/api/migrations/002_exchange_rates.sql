-- Official National Bank of Ukraine EUR→UAH rates, cached so each date is fetched once.
CREATE TABLE exchange_rates (
  rate_date   DATE          PRIMARY KEY,           -- the date the NBU set the rate for
  eur_uah     DECIMAL(10,4) NOT NULL,              -- 1 EUR in UAH
  fetched_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);
