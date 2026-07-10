-- SET SQL_SAFE_UPDATES = 0;    -- run this to exit from safe update


use sand_box;

-- # 1 In sand_box database create new table: city based on city from database sakila.
-- The new table contains all cities from Spain.


select * from sakila.city limit 10;
select * from sakila.country limit 10;

 

create table city as 
select ci.* 
from sakila.city ci
inner join sakila.country co
on
	ci.country_id = co.country_id
    WHERE co.country = 'spain';
    
select * from city;    

-- # 2 Create also country table and insert into it the data on Spain.
create table country
select * from sakila.country co WHERE co.country = 'spain';



select * from country;


-- #3 On the new tables update the country_id for Spain to 1.


select * from country;
select * from city;

 update    country
 set country_id = 1
 where country_id = 87;


    
 update    city
 set country_id = 1
 where country_id = 87 ;
     
-- # Add column to city table – city_code which value of – city_id + “_” + country_id.
alter table city add column city_code  varchar(10);     

select concat(city_id , '_' , country_id) from city;    

update city
set city_code = concat(city_id , '_' , country_id);


select * from city;
    

    
    
# 5 Delete from the new city table the city with the name - Santiago de Compostela

select * from city where city = 'Santiago de Compostela';
    
delete from city where city = 'Santiago de Compostela';    

select * from city;    
    
# 6    Create a new table city_backup as a copy of the new city table structure only (no data).Then insert into it only cities where the name starts with ‘B’ from sakila.city.

CREATE TABLE sand_box.city_backup SELECT * FROM city limit 0;
CREATE TABLE sand_box.city_backup LIKE city;

INSERT INTO sand_box.city_backup
SELECT *,NULL
FROM sakila.city
WHERE city LIKE 'B%';

# 7 Create a new table city_backup as a copy of the new city table structure only (no data).Then insert into it only cities where the name starts with ‘B’ from sakila.city.
RENAME TABLE sand_box.city_backup TO sand_box.city_b;

    
# 8 Drop all new tables.
drop table city;
drop table country;  
drop table sand_box.city_backup;
drop table sand_box.city_b;  
    
    

 
 
 alter table city add city_code varchar(10);
 

 delete from city where city = 'Santiago de Compostela';
 
 
 
