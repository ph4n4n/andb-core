-- Trigger for users audit log
DELIMITER $$

CREATE TRIGGER users_audit_trigger
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO users_audit_log (
        user_id,
        old_status,
        new_status,
        changed_at,
        changed_by
    ) VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        CURRENT_TIMESTAMP,
        USER()
    );
END$$

DELIMITER ; 