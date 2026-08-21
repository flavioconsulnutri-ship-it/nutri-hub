REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_financial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_clinical() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_commercial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_financial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_clinical() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_commercial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
