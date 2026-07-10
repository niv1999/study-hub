-- SET SQL_SAFE_UPDATES = 0;    -- run this to exit from safe update


use sand_box;

create table actor_as_select
select * from sakila.actor limit 10;



desc actor_as_select;


select * from actor_as_select;


create table actor_as_select_2
select last_name,first_name,actor_id from sakila.actor limit 5;

create table actor_as_select_3
select last_name lname,first_name fname,actor_id aid from sakila.actor limit 5;


select * from sakila.actor limit 10;

alter table actor_as_select_3 add b_day date; 

select * from actor_as_select_3;

alter table actor_as_select_3 drop b_day ; 

desc actor_as_select_3;

alter table actor_as_select_3 modify lname varchar(55) ; 


drop table actor_as_select_3