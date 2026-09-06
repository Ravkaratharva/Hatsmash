DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hatsmash_scanner') THEN
		CREATE ROLE hatsmash_scanner LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_roles
		WHERE rolname = 'hatsmash_scanner'
			AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
	) THEN
		RAISE EXCEPTION 'hatsmash_scanner has unsafe role attributes';
	END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO hatsmash_scanner;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.scans, public.captured_emails FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.scans, public.captured_emails FROM hatsmash_scanner;
--> statement-breakpoint
GRANT INSERT ON TABLE public.scans, public.captured_emails TO hatsmash_scanner;
--> statement-breakpoint
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.captured_emails ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'scans' AND policyname = 'scanner_insert_scans'
	) THEN
		CREATE POLICY scanner_insert_scans ON public.scans
			FOR INSERT TO hatsmash_scanner WITH CHECK (true);
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public' AND tablename = 'captured_emails' AND policyname = 'scanner_insert_captured_emails'
	) THEN
		CREATE POLICY scanner_insert_captured_emails ON public.captured_emails
			FOR INSERT TO hatsmash_scanner WITH CHECK (true);
	END IF;
END
$$;
