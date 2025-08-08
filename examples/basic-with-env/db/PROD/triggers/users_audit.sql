-- Trigger for users audit log in PROD
DELIMITER $$

CREATE TRIGGER users_audit_trigger
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO users_audit_log (
        user_id,
        old_status,
        new_status,
        old_role,
        new_role,
        changed_at,
        changed_by,
        ip_address
    ) VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        OLD.role,
        NEW.role,
        CURRENT_TIMESTAMP,
        USER(),
        (SELECT USER())
    );
END$$

DELIMITER ; 