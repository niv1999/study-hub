USE sakila;

DROP PROCEDURE IF EXISTS category_summary_out_proc;


DELIMITER $$
CREATE PROCEDURE category_summary_out_proc(  
IN in_category_name VARCHAR(20) ,
OUT category_name VARCHAR(20),
OUT num_of_movies INT,
OUT total_length INT)
BEGIN
	SELECT      c.name category_name, count(*) num_of_movies, sum(film.length) total_length
	INTO category_name,num_of_movies,total_length
		FROM
			film
				INNER JOIN
			film_category fc ON film.film_id = fc.film_id
				INNER JOIN
			category c ON fc.category_id = c.category_id
			WHERE 
			c.name = in_category_name
			GROUP BY C.NAME;
END $$
DELIMITER ;


call category_summary_out_proc ('Children',@cat,@num,@length);
select @cat,@num,@length;