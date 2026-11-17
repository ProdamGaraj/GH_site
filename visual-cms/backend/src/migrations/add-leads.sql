-- Заявки с сайта (формы обратного звонка, проекта и планировки).
--
-- Заявка сначала пишется сюда, потом уходит в MacroCRM (estateBuy/create).
-- Если CRM недоступна или отказала, заявка остаётся со статусом failed и
-- переотправляется скриптом scripts/retry-leads.ts — лид не теряется.
--
-- payload — ровно то тело, что ушло (или уйдёт) в CRM: повторная отправка
-- шлёт его же, а не собирает заново из изменившегося каталога.

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  name varchar(200) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL,
  "pagePath" varchar(500) NOT NULL DEFAULT '',
  lang varchar(10) NOT NULL DEFAULT '',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  "crmId" varchar(64),
  "crmResponse" jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  ip varchar(64),
  "userAgent" varchar(500),
  "sentAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Защита от двойной отправки: поиск свежей заявки того же телефона.
CREATE INDEX IF NOT EXISTS "IDX_leads_phone_created" ON leads (phone, "createdAt");
-- Переотправка: неотправленные по возрасту.
CREATE INDEX IF NOT EXISTS "IDX_leads_status_created" ON leads (status, "createdAt");
