-- Function to get user by email
DELIMITER $$

CREATE FUNCTION get_user_by_email(user_email VARCHAR(100))
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE user_id INT;
    
    SELECT id INTO user_id
    FROM users 
    WHERE email = user_email 
    AND status = 'active'
    LIMIT 1;
    
    RETURN user_id;
END$$

DELIMITER ; 