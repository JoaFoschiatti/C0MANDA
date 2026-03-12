DO $$
DECLARE
  duplicate_emails TEXT;
BEGIN
  SELECT string_agg(normalized_email, ', ' ORDER BY normalized_email)
  INTO duplicate_emails
  FROM (
    SELECT lower(btrim(email)) AS normalized_email
    FROM usuarios
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) duplicated;

  IF duplicate_emails IS NOT NULL THEN
    RAISE EXCEPTION 'Se detectaron emails de usuario duplicados al normalizar: %', duplicate_emails;
  END IF;
END $$;

UPDATE usuarios
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_email_canonical_chk
  CHECK (email = lower(btrim(email)));
