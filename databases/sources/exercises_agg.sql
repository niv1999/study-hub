use sakila;


-- Which first names are not repeated?
select first_name,count(*) from actor group by first_name  having count(*) = 1;

-- Which last names appear more than once?
select last_name,count(*) from actor group by last_name  having count(*) > 1;


-- Which actor has appeared in the most films?
SELECT 
    a.first_name, a.last_name, COUNT(*)
FROM
    film AS f
        INNER JOIN
    film_actor AS fa ON f.film_id = fa.film_id
        INNER JOIN
    actor AS a ON fa.actor_id = a.actor_id
GROUP BY a.first_name , a.last_name
ORDER BY COUNT(*) DESC
LIMIT 1;


-- What is that average running time (length) of all the films?
select avg(length) from film;

-- What are the film with max length?
select title from film where length = (
select max(length) from film);

-- What are the films with shorter length?
select title from film where length = (
select min(length) from film);


-- What is the average length time of films by category?
SELECT 
    c.name, AVG(f.length)
FROM
    film f
        INNER JOIN
    film_category fc ON f.film_id = fc.film_id
        INNER JOIN
    category c ON fc.category_id = c.category_id
GROUP BY c.name
ORDER BY AVG(f.length) DESC;


-- List each film and the number of actors who are listed for that film.

SELECT 
    f.title, COUNT(*)
FROM
    film AS f
        INNER JOIN
    film_actor AS fa ON f.film_id = fa.film_id
    group by f.title    ;
    
    
desc    film; 