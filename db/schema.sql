CREATE TABLE IF NOT EXISTS vision_orders (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS vision_orders_spl_signature
  ON vision_orders ((payload->>'splSignature'))
  WHERE payload->>'splSignature' IS NOT NULL;
