USE sakila;

DROP PROCEDURE IF EXISTS get_actor_data_proc;
DROP TABLE IF EXISTS proc_log;
CREATE TABLE proc_log(first_name varchar(45), last_name varchar(45),  run_time datetime);

DELIMITER $$
CREATE PROCEDURE get_actor_data_proc(  
	IN in_first_name VARCHAR(45),
	IN in_last_name VARCHAR(45)

)  
BEGIN
	SELECT 
		af.first_name,
		af.last_name,
		COUNT(*) num_of_movies,
		SUM(f.length) total_length
	FROM
		actor_film_vw af
			INNER JOIN
		film f ON af.film_id = f.film_id
	WHERE
		af.first_name = in_first_name
			AND af.last_name = in_last_name
	GROUP BY af.first_name , af.last_name;

	INSERT INTO proc_log (first_name, last_name, run_time) 
    values (in_first_name,in_last_name,now());

END $$
DELIMITER ;

CALL get_actor_data_proc ('ED','CHASE');

select * from proc_log;


 
