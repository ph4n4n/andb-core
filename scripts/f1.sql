
-- Table 1: Identical
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Table 2: Changed
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- View: Removed in f2
CREATE VIEW `v_users` AS SELECT * FROM `users`;

-- Procedure: Identical
DELIMITER ;;
CREATE PROCEDURE `get_user`(IN p_id INT)
BEGIN
  SELECT * FROM users WHERE id = p_id;
END ;;
DELIMITER ;
