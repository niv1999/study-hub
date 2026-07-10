use sakila;



-- Return all names of all the languages (sorted Z-A)? 
select name from language order by name desc;

-- Return all addresses  from the city ‘Lethbridge’. 

select * from city limit 10;
select * from address limit 10;
select * from city where city = 'Lethbridge'; -- 300
select * from address where city_id = '300';

-- Return the full names (first and last) of all the actors and costumers whose first name is the same as the first name of the actor with ID 8. 

select * from actor limit 10;
select * from customer limit 10;

select first_name,last_name from actor where actor_id = 8;


select first_name,last_name from actor where first_name = 'MATTHEW';
select first_name,last_name from customer where first_name = 'MATTHEW';


select first_name,last_name from actor where first_name = 'MATTHEW'
union
select first_name,last_name from customer where first_name = 'MATTHEW'
order by last_name
;

select first_name,last_name from actor where first_name =
(select first_name from actor where actor_id = 8)
union
select first_name,last_name from customer where first_name = (select first_name from actor where actor_id = 8)
order by last_name;




select first_name from actor where actor_id = 8;

select first_name,last_name from actor where first_name = (select first_name from actor where actor_id = 8) and last_name = (select last_name from actor where actor_id = 8);


select first_name,last_name from actor where first_name != 'MATTHEW';



select first_name,last_name from actor where first_name not in ( 'MATTHEW');