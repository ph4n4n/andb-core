
-- Demo SQL Dump for Testing

DELIMITER ;;

/*!50003 CREATE PROCEDURE `sp_test`()
BEGIN
  SELECT 1;
END */;;

DELIMITER ;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE VIEW `v_users` AS SELECT * FROM `users`;
