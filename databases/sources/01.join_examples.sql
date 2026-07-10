use sand_box;

SELECT     
	m.member_id,    
	m.name memmber_name,    
	c.student_id,    
	c.name student_name
FROM    members AS m        
INNER JOIN    
students AS c 
ON m.name = c.name;

SELECT     
	m.member_id,    
	m.name memmber_name,    
	c.student_id,    
	c.name student_name
FROM    members AS m        
INNER JOIN    
students AS c 
USING (name); 


use sakila;

SELECT
t1.city_id,t1.city,
t2.address_id,t2.address,t2.city_id
FROM
city t1
INNER JOIN address t2
ON t1.city_id = t2.city_id;

SELECT
	t1.city_id,t1.city,
	t2.address_id,t2.address,t2.city_id
FROM
city t1
INNER JOIN address t2
USING(city_id);

-- 3 tables
SELECT
t1.city_id,t1.city,t2.address_id,t2.address,t2.city_id,
t1.country_id, t3.country_id,t3.country
FROM
city t1
INNER JOIN address t2
ON
t1.city_id = t2.city_id
INNER JOIN
country t3
ON
t1.country_id = t3.country_id;


-- with <>
SELECT
	t1.city_id,
	t1.city,
	t2.address_id,t2.address,
	t2.city_id,t1.country_id, t3.country_id,t3.country
FROM
city t1
INNER JOIN address t2
ON 	t1.city_id = t2.city_id
INNER JOIN country t3
ON 	t1.country_id = t3.country_id    
AND    t3.country <> 'Argentina';

use sand_box;

SELECT
	m.member_id,  
	m.name AS member,  
	c.student_id,  
	c.name AS 'student name'
FROM
members m
left join 
students c using(name);


use sakila;


INSERT INTO customer
(store_id,first_name,last_name,
email,address_id,active,create_date,last_update)
VALUES
(
1,
'boaz',
'sch',
'boaz.schneider@shenkar.ac.il',
1,
1,
'2024-04-01',
CURRENT_TIMESTAMP);

-- left join
SELECT 
	C1.first_name,
    C1.last_name,
    R1.rental_date

FROM 
customer C1
LEFT JOIN rental R1
ON
	C1.customer_id = R1.customer_id
where R1.customer_id    is null;

-- right join
use sand_box;

SELECT
m.member_id,  m.name as member,  c.student_id,  c.name student
FROM
members m
right join students c on c.name = m.name;


-- cross join
SELECT
m.member_id,  m.name as member,  c.student_id,  c.name student
FROM
members m
CROSS join students c;



