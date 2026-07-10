use sakila;


DROP VIEW IF EXISTS actor_film_vw;

CREATE VIEW actor_film_vw AS
    SELECT 
        actor.actor_id, actor.first_name, actor.last_name, film.film_id ,film.title film_name
    FROM
        actor
            INNER JOIN
        film_actor fa ON actor.actor_id = fa.actor_id
            INNER JOIN
        film ON film.film_id = fa.film_id;
