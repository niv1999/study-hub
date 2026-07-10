use sakila;

SET GLOBAL log_bin_trust_function_creators =  1; -- need to run once
DROP FUNCTION IF EXISTS actor_count_fn;

DELIMITER $$
CREATE FUNCTION
	actor_count_fn(in_first_name VARCHAR(45),in_last_name VARCHAR(45))  RETURNS INTEGER
BEGIN
	DECLARE a_count INTEGER default 0;
	SELECT 
		COUNT(*)
	INTO a_count FROM
		actor
			INNER JOIN
		film_actor fa ON actor.actor_id = fa.actor_id
	WHERE
		actor.first_name = in_first_name
			AND actor.last_name = in_last_name;  
	RETURN a_count;

END$$
DELIMITER ;


