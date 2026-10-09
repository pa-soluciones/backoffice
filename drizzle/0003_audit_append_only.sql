-- audit_log es append-only (spec/03 RF-AUD-02): nadie puede editar ni borrar registros.
CREATE FUNCTION audit_log_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_sin_cambios BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_inmutable();
