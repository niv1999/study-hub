use sakila;
select * from sakila.actor; -- select all columns from table
select first_name, last_name from actor; -- select specific columns  by comma
select first_name fname from actor; -- alias
select distinct first_name  from actor; -- remove duplicate
select distinct first_name  from actor order by first_name; -- order result set by name 


select * from customer where store_id = 1;
select * from customer where store_id = 1 and first_name = 'LINDA';
select * from customer where store_id = 1 and first_name like 'mar%';
select address_id,first_name,last_name from customer where address_id = 5  or address_id = 11;
select address_id,first_name,last_name from customer where address_id in (5,11);
