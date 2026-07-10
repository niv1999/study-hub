use sand_box;


select * from actor_as_select;


insert into actor_as_select(actor_id,first_name, last_name, last_update)
values(11,'Gal','Omer','2006-02-14');

insert into actor_as_select(actor_id,first_name,last_name)
values(12,'Stas','K');

insert into actor_as_select
select * from actor_as_select limit 3;


update actor_as_select
set first_name = 'EDI', last_update = now()
where actor_id = 3; 

update actor_as_select
set actor_id = actor_id * 2; 


update actor_as_select
set actor_id = actor_id * 2; 

update actor_as_select
set last_update = (select min(last_update) from sakila.actor); 



select min(last_update) from sakila.actor;

delete from actor_as_select
where actor_id = 2;


delete from actor_as_select
where actor_id not in (select actor_id from actor_as_select_2);