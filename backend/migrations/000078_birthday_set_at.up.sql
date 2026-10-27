-- Badge "Aniversariante" (internal/badge): a data do aniversário precisa
-- estar cadastrada há 30 dias para valer, senão bastaria trocar a data para
-- hoje. birthday_set_at guarda quando dia ou mês foram definidos pela última
-- vez. O trigger cuida disso em qualquer gravação; mexer só no anúncio ou só
-- no ano não muda (o dia do badge não muda).
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday_set_at TIMESTAMPTZ NULL;

-- Quem já tem data cadastrada não perde nada: vale a criação da conta (o
-- momento mais antigo que se conhece).
UPDATE users SET birthday_set_at = created_at
WHERE birthday_day IS NOT NULL AND birthday_set_at IS NULL;

CREATE OR REPLACE FUNCTION users_birthday_set_at() RETURNS trigger AS $$
BEGIN
    IF NEW.birthday_day IS NULL THEN
        NEW.birthday_set_at := NULL;
    ELSIF TG_OP = 'INSERT'
       OR NEW.birthday_day IS DISTINCT FROM OLD.birthday_day
       OR NEW.birthday_month IS DISTINCT FROM OLD.birthday_month THEN
        NEW.birthday_set_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_birthday_set_at ON users;
CREATE TRIGGER users_birthday_set_at
BEFORE INSERT OR UPDATE OF birthday_day, birthday_month ON users
FOR EACH ROW EXECUTE FUNCTION users_birthday_set_at();
