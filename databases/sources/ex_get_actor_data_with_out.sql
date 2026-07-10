USE sakila;

DROP PROCEDURE IF EXISTS get_actor_data_with_out_proc;

DELIMITER $$
CREATE PROCEDURE get_actor_data_with_out_proc(  
 IN in_first_name VARCHAR(45),
 IN in_last_name VARCHAR(45),
 out out_first_name VARCHAR(45),
  out out_last_name VARCHAR(45),
  out out_num_of_movies int,
  out out_total_length int

)  
BEGIN
SELECT 
    af.first_name,
    af.last_name,
    COUNT(*) num_of_movies,
    SUM(f.length) total_length
INTO out_first_name, out_last_name,out_num_of_movies,out_total_length
		
FROM
    actor_film_vw af
        INNER JOIN
    film f ON af.film_id = f.film_id
WHERE
    af.first_name = in_first_name
        AND af.last_name = in_last_name
GROUP BY af.first_name , af.last_name;


END $$
DELIMITER ;




call get_actor_data_proc ('ED','CHASE');

call get_actor_data_with_out_proc ('ED','CHASE',@first_name_out,@last_name_out,@num_out,@length_out);

insert into proc_log (first_name, last_name, run_time) 
select @first_name_out,@last_name_out,now();




select * from proc_log;

