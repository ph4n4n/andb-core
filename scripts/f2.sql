
-- Table 1: Identical
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Table 2: Changed (Added a column)
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) DEFAULT '0.00',
  `stock` int(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Table 3: New
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- View: Removed in f2 (not present here)

-- Procedure: Changed
DELIMITER ;;
CREATE PROCEDURE `get_user`(IN p_id INT)
BEGIN
  -- Change in comment
  SELECT id, username FROM users WHERE id = p_id;
END ;;
DELIMITER ;
