-- Procedure to update user status
DELIMITER $$

CREATE PROCEDURE update_user_status(
    IN user_id INT,
    IN new_status ENUM('active', 'inactive', 'suspended'),
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
    
    SET success = TRUE;
    COMMIT;
END$$

DELIMITER ; 