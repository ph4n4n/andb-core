-- Procedure to update user status for PROD
DELIMITER $$

CREATE PROCEDURE update_user_status(
    IN user_id INT,
    IN new_status ENUM('active', 'inactive', 'suspended'),
    IN reason VARCHAR(255),
    OUT success BOOLEAN
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET success = FALSE;
        ROLLBACK;
    END;
    
    START TRANSACTION;
    
    UPDATE users 
    SET status = new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    -- Log the status change
    INSERT INTO user_status_log (
        user_id,
        old_status,
        new_status,
        reason,
        changed_at,
        changed_by
    ) VALUES (
        user_id,
        (SELECT status FROM users WHERE id = user_id),
        new_status,
        reason,
        CURRENT_TIMESTAMP,
        USER()
    );
    
    SET success = TRUE;
    COMMIT;
END$$

DELIMITER ; 