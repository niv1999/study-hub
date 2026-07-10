drop database sand_box;
CREATE DATABASE sand_box;

USE sand_box;

CREATE TABLE members (
member_id INT AUTO_INCREMENT,  
name VARCHAR(100),
PRIMARY KEY (member_id)
);



CREATE TABLE students (
student_id INT AUTO_INCREMENT,  
name VARCHAR(100),
PRIMARY KEY (student_id)
);

truncate table  members;
truncate table students;
delete from members;
delete from students;
INSERT INTO members(name)  VALUES('John'),('Jane'),('Mary'),('David'),('Amelia');



INSERT INTO students(name)  VALUES('John'),('Mary'),('Amelia'),('Joe');

select * from members;
select * from students;


SELECT *  FROM `sand_box`.`students`;







SELECT  m1.name
FROM
members as m1
inner join students c2 
on
	m1.name = c2.name;
    

SELECT 
    m.member_id,
    m.name memmber_name,
    c.student_id,
    c.name student_name
FROM
    members AS m
        INNER JOIN
    students AS c ON m.name = c.name;
    
    
SELECT     
m.member_id,    
m.name memmber_name,    
c.student_id,    
c.name student_name
FROM    members AS m        
INNER JOIN    
students AS c 
USING (name); 


    
SELECT
*
FROM
members 
inner join students  
on
	members.name = students.name;
    



SELECT
*
FROM
members 
inner join students  
using(name);
    
    
    
    
SELECT
*
FROM
members 
left join students  
on
	members.name = students.name;


select * from students;
select * from members;

/*
memmbers
John   *
Jane
Mary  *
David 
Amelia *
*/
/*

John
Mary
Amelia
Joe


*/

SELECT
*
FROM
members 
inner join students  
on
	members.name = students.name;



SELECT
*
FROM
members 
left join students  
on
	members.name = students.name;
    
SELECT
*
FROM
members 
left join students  
using(name);    
    
    
 --  WHERE students.committee_id IS NOT NULL;      
  
SELECT
*
FROM
members 
inner join students  
on
	members.name = students.name  ;         
  
    
    

SELECT
name,
 m.member_id 
 -- ,m.name  member
 ,c.committee_id
-- c.name committee
FROM
members m
left join students c using(name) ;
 -- WHERE m.member_id = 1 and c.committee_id = 3 ;    
 
 
SELECT
m.name, c.name,
 m.member_id 
 -- ,m.name  member
 ,c.committee_id
-- c.name committee
FROM
members m
left join students c 
ON
	c.name = m.name;
 -- WHERE m.member_id = 1 and c.committee_id = 3 ;    
 



SELECT
*
FROM
members 
left join students  
on
	members.name = students.name;
    
    
/*
memmbers
John   
Jane
Mary  
David 
Amelia 
*/
/*

John *
Mary *
Amelia  *
Joe   *


*/    
SELECT
*
FROM
members 
right join students  
on
	members.name = students.name ;
    
    -- where members.name is not null;    


select name from members;
select name from students;


-- John
-- Mary
-- Amelia
-- Joe

-- John
-- Jane
 -- Mary
-- David
-- Amelia


SELECT
m.name,c.name
FROM
members m 
cross join students c 
where m.name = c.name
;

SELECT  m.member_id,   m.name  member,  c.committee_id,  c.name committee FROM members m left join students c using(name);




SELECT
name,
 m.member_id 
 -- ,m.name  member
 ,c.committee_id
-- c.name committee
FROM
members m
right join students c using(name) ;




SELECT
 m.member_id, 
 m.name member1 ,
 c.committee_id, 
 c.name committee
FROM
members m
CROSS join students c
-- where m.member_id = 5

;

SELECT
m.member_id,
m.name member1,
c.committee_id,
c.name committee
FROM
members m 
cross join students c;





