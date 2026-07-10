

--  ### 1 -------------------------------------------------------------





select * from city limit 10;
select * from address limit 10;
 
 
 
 --  
select a.address, c.city_id, c.city city_name
FROM
   address  a
        INNER JOIN
    city c 
    ON a.city_id = c.city_id
where c.city = 'Lethbridge';


--  ### 2 -------------------------------------------------------------

select * from actor limit 10;
select * from customer limit 10;


select 
a1.first_name,
a1.last_name ,
c1.first_name c_first_name,
c1.last_name c_last_name
from 
actor a1
left join customer c1
on
	a1.first_name = c1.first_name
where 
		c1.first_name is not  null
   
    ;
    



SELECT 
    actor.first_name, actor.last_name, customer.last_name
FROM
    actor
        INNER JOIN
    customer USING (first_name);



--  ### 3 -------------------------------------------------------------

SELECT 
    cu.first_name,
    cu.last_name,
    a.address,
	c.city_id,
    c.city city_name
FROM
	customer cu
     INNER JOIN address a
     ON a.address_id = cu.address_id
	INNER JOIN
    city c 
    ON a.city_id = c.city_id
     
  
 WHERE
     c.city   = 'Sasebo'
        AND (a.address =  '1913 Hanoi Way' OR a.address2 LIKE '1913%');
        
        
--  ### 4 -------------------------------------------------------------  
use sakila;

select * from film limit 10 ;
select * from film_category limit 10;
select * from category limit 10;

SELECT 
    f.title, f.description
FROM
    category c
        INNER JOIN
    film_category fc ON c.category_id = fc.category_id
        INNER JOIN
    film f ON fc.film_id = f.film_id
WHERE
    c.name = 'Family'
        
;


--  ### 5 -------------------------------------------------------------  
use sakila;

select * from film limit 10 ;
select * from film_category limit 10;
select * from category limit 10;
select * from actor limit 10;
select * from film_actor limit 10;

SELECT 
    f.title, f.description, a.first_name, a.last_name
FROM
    category c
        INNER JOIN
    film_category fc ON c.category_id = fc.category_id
        INNER JOIN
    film f ON fc.film_id = f.film_id
        INNER JOIN
    film_actor fa ON f.film_id = fa.film_id
        INNER JOIN
    actor a ON fa.actor_id = a.actor_id
WHERE
    c.name = 'Family'
        
;

--  ### 5 -------------------------------------------------------------     
