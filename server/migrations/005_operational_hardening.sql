-- New public registrations retain compatibility with users.role while also
-- receiving the normalized MEMBER user_roles assignment.
CREATE OR REPLACE FUNCTION assign_default_user_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_roles (user_id, role_id)
    SELECT NEW.id, id FROM roles WHERE code = NEW.role
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_assign_default_role ON users;
CREATE TRIGGER users_assign_default_role
AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION assign_default_user_role();

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code='reports.read' WHERE r.code='FINANCE'
ON CONFLICT DO NOTHING;

INSERT INTO system_settings(key,value,is_public) VALUES
 ('churchName', '""'::jsonb, TRUE), ('contactEmail','""'::jsonb, TRUE),
 ('contactPhone','""'::jsonb, TRUE), ('address','""'::jsonb, TRUE)
ON CONFLICT(key) DO NOTHING;
