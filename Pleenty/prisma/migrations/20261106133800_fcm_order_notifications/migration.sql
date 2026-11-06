CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "email" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_role_check" CHECK ("role" IN ('OWNER', 'ORDER_MANAGER')),
  CONSTRAINT "push_subscriptions_token_check" CHECK (char_length("token") BETWEEN 20 AND 4096)
);

CREATE UNIQUE INDEX "push_subscriptions_token_key" ON "push_subscriptions"("token");
CREATE INDEX "push_subscriptions_role_email_idx" ON "push_subscriptions"("role", "email");

CREATE TABLE "notification_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
  CONSTRAINT "notification_events_status_check"
    CHECK ("status" IN ('pending', 'sending', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX "notification_events_order_id_event_type_key"
  ON "notification_events"("order_id", "event_type");
CREATE INDEX "notification_events_status_updated_at_idx"
  ON "notification_events"("status", "updated_at");

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "push_subscriptions" FROM anon, authenticated;
REVOKE ALL ON TABLE "notification_events" FROM anon, authenticated;
