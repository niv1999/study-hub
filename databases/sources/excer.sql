


use shenkar;

-- drop table course;
-- drop table department;
CREATE TABLE department (
   d_code int,
   d_name CHAR(20),
   d_descr CHAR(100),
   PRIMARY KEY (d_code),
   UNIQUE (d_name));  -- candidate key
      
 CREATE TABLE course (
   c_code int,
   c_name CHAR(20),
   dept_id int,
   c_descr CHAR(100),
   PRIMARY KEY (c_code),
   FOREIGN KEY (dept_id) REFERENCES department ( d_code) ,
   UNIQUE (c_name,dept_id));


insert into department(d_code,d_name) values(1,'computers');
select * from department;

-- insert into course(c_code,c_name,dept_id) values(1,'database #1',3);

insert into course(c_code,c_name,dept_id) values(1,'database #1',1);
-- insert into course(c_code,c_name,dept_id) values(2,'database #1',1);
insert into course(c_code,c_name,dept_id) values(2,'database #2',1);
select * from course;

CREATE TABLE student (
    s_id INTEGER,
    s_name CHAR(20) NOT NULL,
    s_address CHAR(50),
    s_status CHAR(10) DEFAULT 'freshman',
    PRIMARY KEY (s_id));

insert into student (s_id,s_name,s_address) values (1,'oren','kfar saba');
insert into student (s_id,s_name,s_address,s_status) values (2,'meiron','tel aviv','BA');

select * from student;

CREATE TABLE lecturer (
    l_id INTEGER,
    l_name CHAR(20) NOT NULL,
    dept_id int  ,
    PRIMARY KEY (l_id),
    FOREIGN KEY (dept_id) REFERENCES department ( d_code) );
    
insert into lecturer (l_id,l_name,dept_id) values (1,'ronit',1);
insert into lecturer (l_id,l_name,dept_id) values (2,'ola',1);    

CREATE TABLE register (
    c_code INTEGER NOT NULL,
    s_id INTEGER NOT NULL,
    grade int  ,
    semester int,
    PRIMARY KEY (c_code,s_id,semester),
    FOREIGN KEY (c_code) REFERENCES course ( c_code) ,    
	FOREIGN KEY (s_id) REFERENCES student ( s_id) );
    
insert into register(c_code,s_id,grade, semester)    values (1,1,80,1);
select * from register;
-- 1)
select s.s_name,c.c_name,r.semester, r.grade from student s
inner join register r
on
	s.s_id = r.s_id
inner join course c
on
    r.c_code = c.c_code;


-- 2)
select  c.c_name,count(*) cnt from student s
inner join register r
on
	s.s_id = r.s_id
inner join course c
on
    r.c_code = c.c_code
group by c.c_name order by    cnt desc limit 1
    ;    

-- 3)
select  c.c_name   
from course c
left  join register r
on
	c.c_code = r.c_code
  where 
	 r.c_code  is null;
    
-- 4)
select l.l_name,c.c_name from lecturer l
inner join department d
on    
    l.dept_id = d.d_code
inner join course c
on
    d.d_code = c.dept_id		
    ;
    

-- 5
select * from register;
update register
set grade = grade + 10;

-- 6
delete from register where c_code = 1;
delete from course where c_code = 1;


-- select * from register


    