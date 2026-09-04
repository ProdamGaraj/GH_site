-- Числовой идентификатор проекта во внешней системе (CRM), по которому
-- тянутся квартиры отдельным запросом на страницу проекта.
--
-- NULL = не сопоставлен. Именно NULL, а не 0: у запроса с пустым ID нет
-- осмысленного поведения, и деплой должен уметь отличить «не задан» от
-- «задан нулём». UNIQUE допускает несколько NULL и запрещает два проекта
-- с одним внешним ID — иначе квартиры разъедутся не по тем страницам.

ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "externalId" integer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_complexes_external_id
  ON complexes ("externalId") WHERE "externalId" IS NOT NULL;
