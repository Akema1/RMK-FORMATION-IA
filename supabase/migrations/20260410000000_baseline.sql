


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_settings_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "text" NOT NULL,
    "author" "text" NOT NULL,
    "initials" "text" NOT NULL,
    "date" "text" NOT NULL,
    "text" "text" NOT NULL,
    "seminar_tag" "text" NOT NULL,
    "participant_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_posts_text_check" CHECK (("char_length"("text") <= 2000))
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "amount" integer NOT NULL,
    "seminar" "text",
    "paid" boolean DEFAULT false NOT NULL,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" >= 0))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "nom" "text" NOT NULL,
    "entreprise" "text",
    "contact" "text",
    "source" "text",
    "status" "text" DEFAULT 'froid'::"text",
    "notes" "text",
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['froid'::"text", 'tiede'::"text", 'chaud'::"text", 'signé'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "nom" "text" NOT NULL,
    "prenom" "text" NOT NULL,
    "email" "text" NOT NULL,
    "tel" "text",
    "societe" "text" NOT NULL,
    "fonction" "text" NOT NULL,
    "seminar" "text" NOT NULL,
    "amount" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment" "text",
    "notes" "text",
    CONSTRAINT "participants_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "participants_email_format" CHECK (("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")),
    CONSTRAINT "participants_payment_check" CHECK ((("payment" IS NULL) OR ("payment" = ANY (ARRAY['pending'::"text", 'partial'::"text", 'paid'::"text", 'refunded'::"text"])))),
    CONSTRAINT "participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'waitlist'::"text"])))
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seminars" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "week" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "color" "text" NOT NULL,
    "seats" integer NOT NULL,
    "targets" "jsonb" DEFAULT '[]'::"jsonb",
    "sectors" "jsonb" DEFAULT '[]'::"jsonb",
    "flyer_subtitle" "text",
    "flyer_highlight" "text",
    "flyer_bullets" "jsonb" DEFAULT '[]'::"jsonb",
    "flyer_image" "text",
    "dates" "jsonb",
    "status" "text",
    "venue_id" "text",
    "speaker_ids" "text"[],
    CONSTRAINT "seminars_seats_check" CHECK (("seats" > 0))
);


ALTER TABLE "public"."seminars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."speakers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "expertise" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "linkedin_url" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "tarif_demi_journee" integer NOT NULL,
    "tarif_journee" integer NOT NULL,
    "disponible" boolean DEFAULT true NOT NULL,
    "langues" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_initials" "text" DEFAULT ''::"text" NOT NULL,
    "biography" "text",
    "formations_history" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "speakers_tarif_demi_journee_check" CHECK (("tarif_demi_journee" >= 0)),
    CONSTRAINT "speakers_tarif_journee_check" CHECK (("tarif_journee" >= 0))
);


ALTER TABLE "public"."speakers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "task" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "deadline" "text",
    "seminar" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'todo'::"text",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'RMK operational tasks — reshaped for upstream merge 2026-04-13';



CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "zone" "text" NOT NULL,
    "stars" integer NOT NULL,
    "capacity_max" integer NOT NULL,
    "capacity_seminar" integer NOT NULL,
    "tarif_demi_journee" integer NOT NULL,
    "tarif_journee" integer NOT NULL,
    "tarif_semaine" integer NOT NULL,
    "contact_name" "text" DEFAULT ''::"text" NOT NULL,
    "contact_phone" "text" DEFAULT ''::"text" NOT NULL,
    "contact_email" "text" DEFAULT ''::"text" NOT NULL,
    "services" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venues_capacity_max_check" CHECK (("capacity_max" >= 0)),
    CONSTRAINT "venues_capacity_seminar_check" CHECK (("capacity_seminar" >= 0)),
    CONSTRAINT "venues_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5))),
    CONSTRAINT "venues_tarif_demi_journee_check" CHECK (("tarif_demi_journee" >= 0)),
    CONSTRAINT "venues_tarif_journee_check" CHECK (("tarif_journee" >= 0)),
    CONSTRAINT "venues_tarif_semaine_check" CHECK (("tarif_semaine" >= 0))
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seminars"
    ADD CONSTRAINT "seminars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."speakers"
    ADD CONSTRAINT "speakers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "participants_email_idx" ON "public"."participants" USING "btree" ("email");



CREATE UNIQUE INDEX "participants_email_seminar_active_udx" ON "public"."participants" USING "btree" ("lower"("email"), "seminar") WHERE ("status" <> 'cancelled'::"text");



CREATE INDEX "participants_seminar_idx" ON "public"."participants" USING "btree" ("seminar");



CREATE INDEX "seminars_venue_id_idx" ON "public"."seminars" USING "btree" ("venue_id");



CREATE OR REPLACE TRIGGER "settings_set_updated_at" BEFORE UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_settings_updated_at"();



ALTER TABLE ONLY "public"."seminars"
    ADD CONSTRAINT "seminars_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



CREATE POLICY "Allow public read seminars" ON "public"."seminars" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public registration inserts" ON "public"."participants" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users self read" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("email" = ("auth"."jwt"() ->> 'email'::"text")));



ALTER TABLE "public"."community_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_posts_public_read" ON "public"."community_posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "community_posts_service_role_only_write" ON "public"."community_posts" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses admin all" ON "public"."expenses" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads admin all" ON "public"."leads" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "participants admin all" ON "public"."participants" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "participants self read" ON "public"."participants" FOR SELECT TO "authenticated" USING (("email" = ("auth"."jwt"() ->> 'email'::"text")));



ALTER TABLE "public"."seminars" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seminars admin all" ON "public"."seminars" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings admin all" ON "public"."settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."speakers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "speakers_admin_all" ON "public"."speakers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks admin all" ON "public"."tasks" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venues_admin_all" ON "public"."venues" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."is_admin"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."is_admin"() FROM "anon";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_settings_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."community_posts" TO "anon";
GRANT ALL ON TABLE "public"."community_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_posts" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "anon";
GRANT ALL ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";



GRANT ALL ON TABLE "public"."seminars" TO "anon";
GRANT ALL ON TABLE "public"."seminars" TO "authenticated";
GRANT ALL ON TABLE "public"."seminars" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."speakers" TO "anon";
GRANT ALL ON TABLE "public"."speakers" TO "authenticated";
GRANT ALL ON TABLE "public"."speakers" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







